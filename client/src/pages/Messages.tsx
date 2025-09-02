import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@/components/SimpleLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistance } from 'date-fns';

type TeamUser = { id: string; firstName?: string; lastName?: string; email?: string };

export default function Messages() {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const [activeId, setActiveId] = useState<number | null>(null);
	const [message, setMessage] = useState('');
	const [search, setSearch] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Recent conversations
	const { data: convs = [], refetch: refetchConvs } = useQuery<any[]>({ queryKey: ['/api/messages/conversations'] });

	// Team users (for name lookup and search)
	const { data: teamUsers = [] } = useQuery<TeamUser[]>({
		queryKey: ['/api/messages/users', { q: search, department_id: user?.department }],
		enabled: !!user,
	});
	const teamMap = useMemo(() => {
		const m = new Map<string, TeamUser>();
		(teamUsers || []).forEach(u => m.set(u.id, u));
		return m;
	}, [teamUsers]);

	// Messages in active conversation
	const { data: convMessages = [], refetch: refetchMessages } = useQuery<any[]>({
		queryKey: activeId ? [`/api/messages/conversations/${activeId}`] : ['noop'],
		enabled: !!activeId,
	});

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [convMessages]);

	const startConversation = useMutation({
		mutationFn: async (userId: string) => {
			return apiRequest('POST', '/api/messages/conversations', { userId });
		},
		onSuccess: async (res) => {
			try {
				const conv = await (res as Response).json();
				setActiveId(conv.id);
			} catch {}
			await refetchConvs();
			await queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
		},
	});

	const sendMessage = useMutation({
		mutationFn: async () => {
			if (!activeId || !message.trim()) return;
			return apiRequest('POST', `/api/messages/conversations/${activeId}`, { message });
		},
		onSuccess: async () => {
			setMessage('');
			await refetchMessages();
			await refetchConvs();
			await queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
		},
	});

	const otherUserId = (c: any): string => {
		const a = c.member_a_id as string;
		const b = c.member_b_id as string;
		const me = user?.employee_id;
		if (!me) return a || b;
		if (a === me) return b;
		if (b === me) return a;
		return a || b;
	};

	const displayName = (u?: TeamUser | null) => {
		if (!u) return '';
		const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
		return name || u.email || u.id;
	};

	return (
		<Layout>
			<div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
				<Card className="lg:col-span-1 overflow-hidden flex flex-col">
					<CardHeader>
						<CardTitle>Messages</CardTitle>
						<CardDescription>Chat with your team</CardDescription>
					</CardHeader>
					<CardContent className="p-0 flex-1 flex flex-col">
						<div className="p-4 flex items-center gap-2">
							<div className="relative w-full">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
								<Input placeholder="Search teammates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
							</div>
						</div>
						{/* Show recommendations only when searching */}
						{search.trim() && (
							<div className="px-4 pb-2 space-y-1">
								{(teamUsers || []).length === 0 ? (
									<div className="text-xs text-muted-foreground">No results</div>
								) : (
									(teamUsers || []).map(u => (
										<div key={u.id} className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
											onClick={() => { setSearch(''); startConversation.mutate(u.id); }}>
											<div className="flex items-center gap-3">
												<Avatar className="h-7 w-7"><AvatarFallback>{(displayName(u)[0] || 'U')}</AvatarFallback></Avatar>
												<div className="min-w-0">
													<div className="text-sm font-medium truncate">{displayName(u)}</div>
												</div>
											</div>
										</div>
									))
								)}
							</div>
						)}
						<ScrollArea className="flex-1">
							<div className="divide-y divide-gray-100 dark:divide-gray-700">
								{convs.length === 0 && (
									<div className="p-4 text-xs text-muted-foreground">No recent chats</div>
								)}
								{convs.map((c: any) => {
									const id = otherUserId(c);
									const u = teamMap.get(id) || { id } as TeamUser;
									return (
										<div key={c.id} className={`p-4 cursor-pointer ${activeId === c.id ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`} onClick={() => setActiveId(c.id)}>
											<div className="flex items-center gap-3">
												<Avatar className="h-8 w-8"><AvatarFallback>{displayName(u)[0]}</AvatarFallback></Avatar>
												<div className="min-w-0">
													<p className="font-medium truncate">{displayName(u)}</p>
													<p className="text-xs text-muted-foreground truncate">{c.last_message || 'No messages yet'}</p>
												</div>
												<div className="ml-auto text-xs text-muted-foreground">{c.last_at ? formatDistance(new Date(c.last_at), new Date(), { addSuffix: true }) : ''}</div>
										</div>
									</div>
								);
								})}
							</div>
						</ScrollArea>
					</CardContent>
				</Card>

				<Card className="lg:col-span-2 overflow-hidden flex flex-col">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Conversation</CardTitle>
								{activeId && (() => {
									const conv = (convs as any[]).find(c => c.id === activeId);
									if (!conv) return null;
									const id = otherUserId(conv);
									const u = teamMap.get(id) || { id } as TeamUser;
									return (
										<div className="text-sm text-muted-foreground mt-1">Chatting with {displayName(u)}</div>
									);
								})()}
							</div>
						</div>
					</CardHeader>
					<CardContent className="flex-1 flex flex-col p-0">
						<ScrollArea className="flex-1 p-6">
							<div className="space-y-4">
								{!activeId ? (
									<div className="text-center text-muted-foreground">Select a conversation or start a new one.</div>
								) : (
									convMessages.map((m: any) => {
										const isSelf = m.sender_id === user?.employee_id;
										return (
											<div key={m.id} className={`flex items-end gap-3 ${isSelf ? 'justify-end' : 'justify-start'}`}>
												{!isSelf && (
													<Avatar className="h-8 w-8"><AvatarFallback>{(m.sender_id || 'U')[0]}</AvatarFallback></Avatar>
												)}
												<div className={`max-w-[70%] rounded-lg px-3 py-2 ${isSelf ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
													<div className={`text-[10px] opacity-70 mb-1 ${isSelf ? 'text-blue-100' : 'text-muted-foreground'}`}>{formatDistance(new Date(m.created_at), new Date(), { addSuffix: true })}</div>
													<div className="whitespace-pre-wrap break-words text-sm">{m.message}</div>
												</div>
												{isSelf && (
													<Avatar className="h-8 w-8"><AvatarFallback>{(user?.first_name?.[0] || user?.employee_id?.[0] || 'U')}</AvatarFallback></Avatar>
												)}
											</div>
										);
									})
								)}
								<div ref={messagesEndRef} />
							</div>
						</ScrollArea>
						<div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
							<Input placeholder="Type a message..." value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage.mutate(); } }} />
							<Button onClick={() => sendMessage.mutate()} disabled={!activeId || !message.trim() || sendMessage.isPending}>
								<Send className="h-4 w-4" />
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
} 