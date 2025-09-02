import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/SimpleLayout";
import { TicketChat } from "@/components/TicketChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ReassignTicketModal } from "@/components/ReassignTicketModal";
import {
  ArrowLeft,
  Download,
  FileText,
  Image,
  Video,
  UserPlus,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatDistance } from "date-fns";
// Avoid strict coupling to server types to handle MySQL-mapped shapes
type TicketDetailResponse = any;

export default function TicketDetail() {
  const [, params] = useRoute<{ id: string }>("/tickets/:id");
  const routeId = params?.id ?? "0";
  const ticketId = Number.parseInt(routeId, 10) || 0;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);

  const { data: ticket, isLoading, error } = useQuery<TicketDetailResponse | null>({
    queryKey: [`/api/tickets/${ticketId}`],
    enabled: !!ticketId,
  });

  const displayUser = (u?: any) => {
    if (!u) return "";
    const name = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    if (name) return `${name} ${u.id ? `(${u.id})` : ""}`.trim();
    return u.email || u.id || "";
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest("PATCH", `/api/tickets/${ticketId}/status`, {
        status,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Ticket status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] });
      queryClient.refetchQueries({ queryKey: [`/api/tickets/${ticketId}`] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update ticket status",
        variant: "destructive",
      });
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: async (assignedToId: string) => {
      // Backend expects { assigned_to: string }
      return await apiRequest("PATCH", `/api/tickets/${ticketId}/assign`, {
        assigned_to: assignedToId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Ticket assigned successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to assign ticket",
        variant: "destructive",
      });
    },
  });

  const acceptTicketMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/tickets/${ticketId}/accept`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Ticket accepted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.refetchQueries({ queryKey: [`/api/tickets/${ticketId}`] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to accept ticket",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <Clock className="h-4 w-4" />;
      case "low":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return "priority-high";
      case "medium":
        return "priority-medium";
      case "low":
        return "priority-low";
      default:
        return "priority-medium";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return "status-open";
      case "in_progress":
        return "status-in-progress";
      case "resolved":
        return "status-resolved";
      case "closed":
        return "status-closed";
      default:
        return "status-open";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatPriority = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="h-5 w-5" />;
    if (mimeType.startsWith("video/")) return <Video className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const canUpdateStatus = () => {
    if (user?.role === "admin" || user?.role === "super_admin") {
      return true;
    }
    if (user?.role === "employee") {
      return (
        Number(ticket?.department?.id) === Number(user.department) &&
        (!ticket?.assignedTo || ticket.assignedTo.id === user.employee_id)
      );
    }
    return false;
  };

  const canResolveTicket = () => {
    if (user?.role === "admin" || user?.role === "super_admin") {
      return true;
    }
    if (user?.role === "employee") {
      return (
        Number(ticket?.department?.id) === Number(user.department) &&
        ticket?.assignedTo &&
        ticket.assignedTo.id === user.employee_id
      );
    }
    return false;
  };

  const canAssignTicket = () => {
    return user?.role === "admin" || user?.role === "super_admin";
  };

  const canAcceptTicket = () => {
    if (user?.role === "employee") {
      return (
        !ticket?.assignedTo &&
        Number(ticket?.department?.id) === Number(user.department)
      );
    }
    return !ticket?.assignedTo && (user?.role === "admin" || user?.role === "super_admin");
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Reassign Ticket Modal */}
        <ReassignTicketModal
          isOpen={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          ticketId={ticketId}
          currentAssignee={undefined}
        />
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="p-6">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Ticket Not Found
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The ticket you're looking for doesn't exist or you don't have
                access to it.
              </p>
              <Button onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Ticket {ticket.ticketNumber}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {ticket.subject}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getPriorityBadge(ticket.priority)}>
              {formatPriority(ticket.priority)}
            </Badge>
            <Badge className={getStatusBadge(ticket.status)}>
              {formatStatus(ticket.status)}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                {ticket.description}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-800 dark:text-gray-100">
                <div><span className="text-gray-500 dark:text-gray-400">Company:</span> {ticket.company?.name ?? "—"}</div>
                <div><span className="text-gray-500 dark:text-gray-400">Department:</span> {ticket.department?.name ?? "—"}</div>
                <div><span className="text-gray-500 dark:text-gray-400">Target System:</span> {ticket.targetSystem?.name ?? "—"}</div>
                <div><span className="text-gray-500 dark:text-gray-400">Created:</span> {new Date(ticket.createdAt).toLocaleString()}</div>
                {ticket.updatedAt && (
                  <div><span className="text-gray-500 dark:text-gray-400">Updated:</span> {new Date(ticket.updatedAt).toLocaleString()}</div>
                )}
                <div><span className="text-gray-500 dark:text-gray-400">Created By:</span>{" "}
                      {ticket.createdBy
                        ? `${ticket.createdBy.firstName ?? ''} ${ticket.createdBy.lastName ?? ''}`.trim() ||
                          ticket.createdBy.email ||
                          ticket.createdBy.id
                        : "—"}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Assigned To:</span>{" "}
                  {ticket.assignedTo ? (
                    `${ticket.assignedTo.firstName ?? ''} ${ticket.assignedTo.lastName ?? ''}`.trim() || ticket.assignedTo.email || ticket.assignedTo.id
                  ) : (
                    "—"
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(ticket.attachments ?? []).length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400">No attachments</div>
                ) : (
                  (ticket.attachments ?? []).map((a: any) => (
                    <a key={a.id} className="text-blue-600 hover:underline" href={`/api/attachments/${a.fileName ?? a.file_name}`}>
                      <Download className="inline h-4 w-4 mr-1" /> {a.originalName ?? a.original_name}
                    </a>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              {canAcceptTicket() && (
                <Button onClick={() => acceptTicketMutation.mutate()} variant="default">Accept</Button>
              )}
              {canUpdateStatus() && ticket.status !== "resolved" && (
                <Button onClick={() => updateStatusMutation.mutate("resolved")}>Mark Resolved</Button>
              )}
              {canUpdateStatus() && ticket.status !== "closed" && (
                <Button onClick={() => updateStatusMutation.mutate("closed")} variant="destructive">Close</Button>
              )}
              {canAssignTicket() && (
                <Button onClick={() => setIsReassignModalOpen(true)} variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" /> Reassign
                </Button>
              )}
            </div>
          </div>
        </div>

        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Discussion</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketChat ticketId={ticketId} />
          </CardContent>
        </Card>
      </div>

      {/* Reassign Ticket Modal */}
      <ReassignTicketModal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        ticketId={ticketId}
        currentAssignee={ticket?.assignedTo}
      />
    </Layout>
  );
}
