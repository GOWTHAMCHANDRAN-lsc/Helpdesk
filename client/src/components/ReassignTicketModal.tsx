import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { UserPlus, Loader2 } from "lucide-react";

interface ReassignTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: number;
  currentAssignee?: any;
}

interface DepartmentUser {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  employee_id: string;
}

export function ReassignTicketModal({ isOpen, onClose, ticketId, currentAssignee }: ReassignTicketModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch department users for this ticket
  const { data: departmentUsers = [] as DepartmentUser[], isLoading: isLoadingUsers } = useQuery<DepartmentUser[]>({
    queryKey: [`/api/tickets/${ticketId}/department-users`],
    enabled: isOpen && !!ticketId,
  });

  const reassignMutation = useMutation({
    mutationFn: async (assignedToId: string) => {
      return await apiRequest("PATCH", `/api/tickets/${ticketId}/assign`, { assigned_to: assignedToId });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Ticket reassigned successfully",
      });
      // Force refresh the ticket data
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      // Refetch immediately
      queryClient.refetchQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      onClose();
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
        description: "Failed to reassign ticket",
        variant: "destructive",
      });
    },
  });

  const handleReassign = () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user to reassign the ticket to",
        variant: "destructive",
      });
      return;
    }
    reassignMutation.mutate(selectedUserId);
  };

  const handleClose = () => {
    setSelectedUserId("");
    onClose();
  };

// Filter out current assignee from the list
const availableUsers = departmentUsers.filter(
  (user: DepartmentUser) => user.employee_id !== currentAssignee?.employee_id
);


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Reassign Ticket</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {currentAssignee && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Currently assigned to: <strong>{currentAssignee.firstName} {currentAssignee.lastName}</strong>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Reassign to:
            </label>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm text-gray-500">Loading department users...</span>
              </div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user from the department" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user: DepartmentUser) => {
                    const label = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || user.employee_id;
                    return (
                      <SelectItem key={user.employee_id} value={user.employee_id}>
                        {label} ({user.employee_id})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {availableUsers.length === 0 && !isLoadingUsers && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                No other users available in this department for reassignment.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleReassign}
              disabled={!selectedUserId || reassignMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {reassignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reassigning...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Reassign
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
