import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MessageCircle, Search, CircleDot, Circle } from "lucide-react";
import { formatDistance } from "date-fns";
import type { TicketWithRelations as BaseTicketWithRelations } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

type TicketWithRelations = BaseTicketWithRelations;

interface TicketTableProps {
  tickets: TicketWithRelations[];
  title: string;
  showCreateButton?: boolean;
  onSearch?: (search: string) => void;
  onStatusFilter?: (status: string) => void;
  onPriorityFilter?: (priority: string) => void;
  isLoading?: boolean;
}

export function TicketTable({ 
  tickets, 
  title, 
  showCreateButton = false,
  onSearch,
  onStatusFilter,
  onPriorityFilter,
  isLoading = false
}: TicketTableProps) {
  const [dense, setDense] = useState(false);
  const visibleTickets = tickets;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300";
      case "low":
        return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300";
      case "in_progress":
        return "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
      case "resolved":
        return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
      case "closed":
        return "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatPriority = (priority: string) => 
    priority.charAt(0).toUpperCase() + priority.slice(1);

  const priorityDot = (priority: string) => {
    const base = "h-2.5 w-2.5";
    switch (priority) {
      case 'high':
        return <CircleDot className={`${base} text-red-500`} />
      case 'medium':
        return <CircleDot className={`${base} text-yellow-500`} />
      default:
        return <Circle className={`${base} text-green-500`} />
    }
  };

  const handleSearch = (value: string) => {
    onSearch?.(value);
  };

  const safeDistance = (input: any) => {
    if (!input) return "—";
    return formatDistance(new Date(input), new Date(), { addSuffix: true });
  };

  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardHeader className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={dense ? "default" : "outline"}
              size="sm"
              onClick={() => setDense((v) => !v)}
              className="hidden sm:inline-flex"
            >
              {dense ? "Comfortable" : "Compact"}
            </Button>
            {showCreateButton && (
              <Link href="/create-ticket">
                <Button className="bg-primary-500 hover:bg-primary-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search tickets..."
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select onValueChange={(value) => onStatusFilter?.(value === "all" ? "" : value)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => onPriorityFilter?.(value === "all" ? "" : value)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { 
              onSearch?.(""); 
              onStatusFilter?.(""); 
              onPriorityFilter?.(""); 
            }}
          >
            Reset
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden md:table-cell">Accepted By</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    {Array.from({ length: 8 }).map((_, cidx) => (
                      <TableCell key={cidx}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[200px] text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="text-sm text-gray-500">No tickets found</p>
                      {showCreateButton && (
                        <Link href="/create-ticket">
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Ticket
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">
                      {ticket.ticketNumber || ticket.id}
                    </TableCell>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {ticket.department?.name || ''}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {ticket.assignedTo
                        ? ([ticket.assignedTo.firstName, ticket.assignedTo.lastName].filter(Boolean).join(' ') || ticket.assignedTo.email || ticket.assignedTo.id)
                        : <span className="text-muted-foreground">Unassigned</span>
                      }
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityBadge(ticket.priority)}>
                        {formatPriority(ticket.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(ticket.status)}>
                        {formatStatus(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {safeDistance(ticket.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/tickets/${ticket.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
