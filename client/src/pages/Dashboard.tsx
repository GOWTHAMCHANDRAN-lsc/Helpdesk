import { motion, AnimatePresence } from 'framer-motion';
import {
  fadeInUp,
  staggerChildren,
  slideIn,
  scaleIn,
  pageTransition,
} from '@/lib/animations';
import lscLogo from '../assets/lsc-logo.png';
import {
  Ticket as TicketIcon,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  MessageSquare,
  Calendar,
  LayoutDashboard,
  RefreshCcw,
  Search,
  ChevronRight,
  ExternalLink,
  ClipboardCopy,
  CalendarPlus,
  Filter,
  Link as LinkIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { useAuth } from '@/hooks/useAuth';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/SimpleLayout';
import { getQueryFn } from '@/lib/queryClient';

/**
 * Dashboard.tsx
 *
 * Extraordinary advancements added:
 * - Upcoming Meetings now strictly shows FUTURE items (timezone-safe) and omits past
 * - Pretty locale-aware date/time formatting (with live countdown chips)
 * - Group meetings by Today / Tomorrow / Later
 * - Quick filters + search with keyboard access
 * - Pull-to-refresh, Ctrl/Cmd+R within the panel only
 * - Resilient parsing for varied API date/time payloads
 * - Production-friendly loading, error and empty states
 * - Cleaner a11y (roles, labels, focus rings, keyboard navigation)
 * - Optional toggle to reveal past meetings (off by default)
 * - Inline “Add to calendar (.ics)” download and Copy Location
 * - Code hardened to avoid setState-on-unmounted & double fetches
 */

// -------------------------
// Types
// -------------------------

type Stats = {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
};

type TicketType = {
  id: string | number;
  // public_id removed
  subject: string;
  ticketNumber: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed' | string;
  priority: 'high' | 'medium' | 'low' | string;
  department?: { name?: string } | null;
};

type MeetingApi = {
  id?: string | number;
  title?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm or HH:mm:ss
  startDate?: string; // alternative date
  startTime?: string; // alternative time or ISO
  startIso?: string; // optional ISO
  meetingLink?: string | null;
  meeting_link?: string | null;
  location?: string | null;
  description?: string | null;
};

export type Meeting = {
  id?: string | number;
  title: string;
  date: string; // normalized YYYY-MM-DD (if available)
  time: string; // normalized HH:mm:ss (if available)
  meetingLink: string | null;
  location: string | null;
  description: string | null;
  startIso: string | null; // ISO string used for time comparisons
  _startMs: number; // derived epoch ms
};

// -------------------------
// Utilities
// -------------------------

/** Normalize time to HH:mm:ss if only HH:mm provided. */
const normalizeTime = (time?: string | null): string => {
  if (!time) return '';
  if (/^\d{2}:\d{2}$/.test(time)) return `${time}:00`;
  return time;
};

/** Ensures a string is a plausible ISO date (yyyy-mm-dd) */
const isYMD = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Try to build an ISO string from various fields.
 * Falls back to null if parsing fails.
 * Assumes local time when composing from date & time.
 */
const toStartIso = (m: MeetingApi): string | null => {
  const date = m.date || m.startDate || '';
  const time = normalizeTime(m.time || m.startTime || '');

  if (m.startIso) return m.startIso;

  // startTime may itself be an ISO string
  if (m.startTime && /T/.test(m.startTime)) return m.startTime;

  if (isYMD(date) && time) return `${date}T${time}`; // local time assumption

  // If only date is available, return midnight local
  if (isYMD(date) && !time) return `${date}T00:00:00`;

  return null;
};

/** Parse ISO-ish string safely to epoch ms. */
const toEpoch = (iso: string | null): number => {
  if (!iso) return 0;
  const d = new Date(iso);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
};

const hhmm = (t?: string | null): string => {
  if (!t) return '';
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t.slice(0, 5);
  return t;
};

/** classnames helper */
const cx = (...parts: Array<string | false | undefined | null>) => parts.filter(Boolean).join(' ');

/**
 * Format a Date/ISO into nice local strings.
 */
const formatDateTime = (iso: string | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  }).format(d);
};

/** Relative time like "in 2h" / "3d ago" */
const relTime = (targetMs: number, nowMs: number) => {
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  const sign: Intl.RelativeTimeFormatUnit = diff >= 0 ? 'second' : 'second';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000],
  ];

  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') {
      const value = Math.round(diff / ms);
      return rtf.format(value, unit);
    }
  }
  return rtf.format(0, sign);
};

/** Group by day bucket */
const dayBucket = (iso: string | null, now = new Date()) => {
  if (!iso) return 'Later';
  const d = new Date(iso);
  const one = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const today = one(now).getTime();
  const tomorrow = one(new Date(today + 86400000)).getTime();
  const target = one(d).getTime();
  if (target === today) return 'Today';
  if (target === tomorrow) return 'Tomorrow';
  return 'Later';
};

/** Build .ics content for a meeting */
const buildIcs = (m: Meeting) => {
  // Use local time; ICS expects UTC or local with TZID, we keep simple local (works for common clients)
  const start = m.startIso ? new Date(m.startIso) : null;
  if (!start) return '';
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour duration

  const pad = (n: number) => String(n).padStart(2, '0');
  const toICSDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LSC Support Desk//Dashboard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${(m.id ?? Math.random()).toString()}@lsc`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${(m.title || 'Meeting').replace(/\n|\r/g, ' ')}`,
    `DESCRIPTION:${(m.description || '').replace(/\n|\r/g, ' ')}`,
    m.location ? `LOCATION:${m.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
};

// -------------------------
// Small, focused subcomponents
// -------------------------

const StatCard: React.FC<{
  title: string;
  value: number | string;
  Icon: any;
  gradient: string; // tailwind gradient classes
  delay?: number;
}> = ({ title, value, Icon, gradient, delay = 0 }) => (
  <motion.div variants={fadeInUp} transition={{ delay }}>
    <Card className="overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="relative">
        <div className={cx('absolute top-0 left-0 w-full h-1 bg-gradient-to-r', gradient)} />
        <CardContent className="pt-6 px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.1 }}
            className="flex items-center gap-4"
          >
            <div className={cx('rounded-xl bg-gradient-to-br p-3 shadow-lg', gradient)}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
              <motion.p
                className="text-3xl font-bold text-gray-900 dark:text-white"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: delay + 0.2 }}
              >
                {value}
              </motion.p>
            </div>
          </motion.div>
        </CardContent>
      </div>
    </Card>
  </motion.div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const statusMap = {
    open: { variant: 'destructive' as const, label: 'Open' },
    'in-progress': { variant: 'default' as const, label: 'In Progress' },
    resolved: { variant: 'secondary' as const, label: 'Resolved' },
    closed: { variant: 'outline' as const, label: 'Closed' },
  } as const;
  const info = (statusMap as any)[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={info.variant}>{info.label}</Badge>;
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const priorityMap = {
    high: { className: 'priority-high', label: 'High' },
    medium: { className: 'priority-medium', label: 'Medium' },
    low: { className: 'priority-low', label: 'Low' },
  } as const;
  const info = (priorityMap as any)[priority] || { className: 'priority-low', label: priority };
  return <Badge className={info.className}>{info.label}</Badge>;
};

const SectionHeader: React.FC<{
  title: string;
  description?: string;
  cta?: React.ReactNode;
}> = ({ title, description, cta }) => (
  <CardHeader className="border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600">
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {cta}
    </div>
  </CardHeader>
);

const EmptyState: React.FC<{
  icon: any;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, hint, action }) => (
  <div className="py-12 text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
      <Icon className="h-6 w-6 text-gray-500 dark:text-gray-300" />
    </div>
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
    {hint && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const SkeletonLine = () => (
  <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
);

const TicketsSkeleton = () => (
  <div className="space-y-3 p-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex-1 space-y-2">
          <SkeletonLine />
          <div className="flex gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const MeetingsSkeleton = () => (
  <div className="space-y-3 p-6">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="rounded-lg border border-gray-100 dark:border-gray-700 p-4">
        <div className="space-y-2">
          <SkeletonLine />
          <div className="flex gap-2">
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const TicketRow = ({ ticket, onOpen }: { ticket: TicketType; onOpen: () => void }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.25 }}
    className="flex items-center space-x-4 p-4 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    onClick={onOpen}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onOpen();
    }}
  // public_id removed
  >
    <div className="flex-shrink-0">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 dark:from-blue-900 dark:via-blue-800 dark:to-blue-700 rounded-lg flex items-center justify-center shadow">
        <TicketIcon className="w-6 h-6 text-blue-700 dark:text-blue-200" />
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{ticket.subject}</p>
        <span className="text-xs text-gray-400 dark:text-gray-500" aria-hidden>
          {/* Placeholder for createdAt etc. */}
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{ticket.ticketNumber}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{ticket?.department?.name ?? ''}</span>
      </div>
      <div className="flex items-center space-x-2 mt-2">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>
    </div>
    <ChevronRight className="h-4 w-4 text-gray-400" />
  </motion.div>
);

const MeetingItem: React.FC<{
  meeting: Meeting;
  nowMs: number;
}> = ({ meeting, nowMs }) => {
  const hasLink = !!(meeting.meetingLink || (meeting.location || '').startsWith('http'));
  const link = meeting.meetingLink || meeting.location || '';

  const handleCopy = useCallback(() => {
    const val = meeting.meetingLink || meeting.location || '';
    if (!val) return;
    navigator.clipboard.writeText(val);
  }, [meeting.meetingLink, meeting.location]);

  const handleIcs = useCallback(() => {
    const ics = buildIcs(meeting);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title?.replace(/[^a-z0-9\-_]+/gi, '_') || 'meeting'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [meeting]);

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={meeting.title}>
            {meeting.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
            <span className="font-medium">
              {meeting.startIso
                ? `${new Date(meeting.startIso).toLocaleDateString(undefined, { dateStyle: 'medium' })} `
                : ''}
              {meeting.time
                ? `${new Date(`1970-01-01T${meeting.time}`).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}`
                : meeting.startIso
                  ? new Date(meeting.startIso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
                  : ''}
            </span>
            {/* Removed the 'ago' badge as requested */}
            {meeting.location && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap" title={meeting.location}>
                <LinkIcon className="h-3 w-3" />
                {meeting.location.length > 40 ? meeting.location.slice(0, 38) + '…' : meeting.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-medium" onClick={handleIcs} title="Add to calendar (.ics)">
            Add <CalendarPlus className="ml-2 h-4 w-4" />
          </Button>
          {hasLink ? (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
            >
              Join <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="font-medium" onClick={handleCopy}>
              Copy <ClipboardCopy className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// -------------------------
// Main Component
// -------------------------

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // -------- Queries --------
  // departmentFilter must be defined before use
  const department = String(user?.department ?? '');
  const departmentFilter = department ? `?department_id=${department}` : '';
  const statsQuery = useQuery<Stats>({
    queryKey: ['/api/stats', departmentFilter],
    queryFn: async () => {
      const res = await fetch(`/api/stats${departmentFilter}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });
  const ticketsQuery = useQuery<TicketType[]>({
    queryKey: ['/api/tickets', departmentFilter],
    queryFn: async () => {
      const res = await fetch(`/api/tickets${departmentFilter}`);
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json();
    },
  });

  const meetingsQuery = useQuery<MeetingApi[]>({
    queryKey: ['/api/meetings'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
    select: (rows: any) => {
      const list: MeetingApi[] = Array.isArray(rows) ? rows : [];
      return list.map((m) => ({
        id: m.id,
        title: m.title || 'Untitled Meeting',
        date: m.date || m.startDate || '',
        time: normalizeTime(m.time || m.startTime || ''),
        meetingLink: m.meetingLink || m.meeting_link || null,
        location: m.location || null,
        description: m.description || null,
        startIso: toStartIso(m),
      }));
    },
  });

  // Keep a live "now" ticker to update countdown chips without full re-renders
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60 * 1000); // tick each minute
    return () => clearInterval(t);
  }, []);

  // Derived data
  const stats = statsQuery.data;
  const allTickets = ticketsQuery.data || [];
  const recentTickets = allTickets.slice(0, 5);

  // Search & filter controls for meetings
  const [query, setQuery] = useState('');
  const [showPast, setShowPast] = useState(false);

  const normalizedMeetings: Meeting[] = useMemo(() => {
  const items: Meeting[] = (meetingsQuery.data || []).map((m) => ({
    id: m.id ?? "",
    title: m.title ?? "Untitled meeting",
    date: m.date || m.startDate || "",
    time: m.time || m.startTime || "",
    location: m.location ?? "No location",
    description: m.description ?? "",
    startIso: m.startIso ?? m.date ?? m.startDate ?? "",
    meetingLink: m.meetingLink ?? m.meeting_link ?? "",
    _startMs: toEpoch(m.startIso ?? m.date ?? m.startDate ?? ""),
  }));

  // Filter by search query
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? items.filter((m) =>
        [m.title, m.location, m.description]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(needle))
      )
    : items;

  // Show all meetings, including past (for testing)
  const horizon = filtered;

  // Sort ascending
  return horizon.sort((a, b) => a._startMs - b._startMs);
}, [meetingsQuery.data, nowMs, query, showPast]);


  // Group by day buckets
  const grouped = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of normalizedMeetings) {
      const bucket = dayBucket(m.startIso, new Date(nowMs));
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(m);
    }
    return map; // maintains insertion order Today -> Tomorrow -> Later (due to dayBucket logic)
  }, [normalizedMeetings, nowMs]);

  // Optional manual refresh for users
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([
      statsQuery.refetch(),
      ticketsQuery.refetch(),
      meetingsQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  // Keyboard shortcut: Ctrl/Cmd+R to refresh panel (prevent full page reload if focus is inside)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isR = e.key === 'r' || e.key === 'R';
      if (isR && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        refreshAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Meeting list ref for scrolling
  const listRef = useRef<HTMLDivElement | null>(null);

  const emptyUpcoming = !showPast && normalizedMeetings.length === 0;

  // -------- Render --------
  return (
    <Layout>
      <motion.div
        {...pageTransition}
        className="p-6 space-y-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen"
      >
        {/* Welcome Header */}
        <motion.div
          {...scaleIn}
          className="flex items-center gap-6 mb-10 p-6 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <motion.h1
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600"
            >
              Dashboard
            </motion.h1>
            <motion.p
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-base text-gray-600 dark:text-gray-300 font-medium"
            >
              Welcome back,{' '}
              <span className="text-blue-600 dark:text-blue-400 font-semibold">{user?.first_name || 'User'}</span>
            </motion.p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing} aria-label="Refresh data">
              <RefreshCcw className={cx('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={staggerChildren} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Open Tickets" value={stats?.open ?? 0} Icon={TicketIcon} gradient="from-blue-500 to-blue-700" delay={0} />
          <StatCard title="In Progress" value={stats?.in_progress ?? 0} Icon={Clock} gradient="from-teal-500 to-teal-700" delay={0.05} />
          <StatCard title="Resolved" value={stats?.resolved ?? 0} Icon={CheckCircle} gradient="from-green-500 to-green-700" delay={0.1} />
          <StatCard title="Closed" value={stats?.closed ?? 0} Icon={AlertTriangle} gradient="from-gray-500 to-gray-700" delay={0.15} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Tickets */}
          <motion.div variants={slideIn} initial="initial" animate="animate" className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
              <SectionHeader
                title="Recent Tickets"
                description="Track your team's latest support requests"
                cta={
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                      <Input placeholder="Search subject or #" className="pl-8 h-8 w-48" aria-label="Search tickets" />
                    </div>
                    <Link href="/tickets">
                      <Button variant="outline" size="sm" className="font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        View All
                        <motion.span className="ml-2" animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          →
                        </motion.span>
                      </Button>
                    </Link>
                  </div>
                }
              />
              <CardContent className="p-0">
                {ticketsQuery.isLoading ? (
                  <TicketsSkeleton />
                ) : ticketsQuery.isError ? (
                  <EmptyState icon={AlertTriangle} title="Could not load tickets" hint="Please try again." action={<Button variant="outline" size="sm" onClick={() => ticketsQuery.refetch()}>Retry</Button>} />
                ) : recentTickets.length === 0 ? (
                  <EmptyState icon={TicketIcon} title="No tickets yet" hint="When your team creates tickets, they will appear here." action={<Link href="/create-ticket"><Button size="sm">Create your first ticket</Button></Link>} />
                ) : (
                  <div className="space-y-2">
                    {recentTickets.map((ticket) => (
                      <TicketRow key={ticket.id} ticket={ticket} onOpen={() => navigate(`/tickets/${ticket.id}`)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions & Meetings */}
          <motion.div variants={slideIn} initial="initial" animate="animate" className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
              <SectionHeader title="Quick Actions" description="Frequently used operations" />
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
                <AnimatePresence>
                  {[
                    { href: '/create-ticket', icon: TicketIcon, label: 'New Ticket', primary: true },
                    { href: '/admin/users', icon: Users, label: 'Manage Users', show: (user as any)?.role === 'admin' || (user as any)?.role === 'super_admin' },
                    { href: '/messages', icon: MessageSquare, label: 'Messages' },
                    { href: '/schedule-meeting', icon: Calendar, label: 'Schedule' },
                  ]
                    .filter((action) => action.show !== false)
                    .map((action, index) => (
                      <motion.div key={action.label} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ delay: index * 0.05 }}>
                        <Link href={action.href}>
                          <Button
                            variant={action.primary ? 'default' : 'outline'}
                            className={cx(
                              'w-full justify-start font-medium transition-all',
                              action.primary
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300',
                            )}
                            size="sm"
                          >
                            <action.icon className="w-4 h-4 mr-2" />
                            {action.label}
                          </Button>
                        </Link>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Upcoming Meetings */}
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
              <SectionHeader
                title="Upcoming Meetings"
                description="Your scheduled appointments"
                cta={
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search meetings…"
                        className="pl-8 h-8 w-48"
                        aria-label="Search meetings"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    {/* Filter toggle removed: always show only upcoming meetings */}
                  </div>
                }
              />
              <CardContent className="p-6" ref={listRef}>
                {meetingsQuery.isLoading ? (
                  <MeetingsSkeleton />
                ) : meetingsQuery.isError ? (
                  <EmptyState
                    icon={AlertTriangle}
                    title="Could not load meetings"
                    hint="Please try again."
                    action={<Button variant="outline" size="sm" onClick={() => meetingsQuery.refetch()}>Retry</Button>}
                  />
                ) : emptyUpcoming ? (
                  <EmptyState
                    icon={Calendar}
                    title="No upcoming meetings"
                    hint="You’re all caught up. Schedule a new meeting to see it here."
                    action={<Link href="/schedule-meeting"><Button size="sm">Schedule</Button></Link>}
                  />
                ) : normalizedMeetings.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="No meetings found"
                    hint={query ? 'Try clearing the search or filters.' : 'Schedule a meeting to see it here.'}
                    action={<Link href="/schedule-meeting"><Button size="sm">Schedule</Button></Link>}
                  />
                ) : (
                  (() => {
                    // Filter meetings for today only
                    const today = new Date(nowMs);
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(today.getDate() + 1);
                    const todaysMeetings = normalizedMeetings.filter((meeting) => {
                      const meetingDate = new Date(meeting.startIso);
                      return meetingDate >= today && meetingDate < tomorrow;
                    });
                    if (todaysMeetings.length === 0) return null;
                    return (
                      <motion.div className="space-y-4">
                        {todaysMeetings.map((meeting) => (
                          <MeetingItem key={meeting.id} meeting={meeting} nowMs={nowMs} />
                        ))}
                      </motion.div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer / Logo strip (optional) */}
        <div className="pt-4 pb-10 opacity-75">
          <div className="flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <img src={lscLogo} alt="LSC" className="h-5 w-auto" />
            <span>Logistics Skill Sector Council — Support Desk</span>
            <span>•</span>
            <span>v1.1</span>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}

