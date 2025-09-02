import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";

type TicketMessage = {
  id: number;
  message: string;
  createdAt: string;
  sender?: { id?: string; firstName?: string; lastName?: string; email?: string };
};

export function TicketChat({ ticketId }: { ticketId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const { data: messages = [] } = useQuery<TicketMessage[]>({
    queryKey: [`/api/tickets/${ticketId}/messages`],
    enabled: !!ticketId,
  });

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages?.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/tickets/${ticketId}/messages`, { message: text.trim() });
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/messages`] });
      queryClient.refetchQueries({ queryKey: [`/api/tickets/${ticketId}/messages`] });
    },
    onError: () => {
      toast({ title: "Failed to send", variant: "destructive" });
    },
  });

  const { connect, connected } = useWebSocket({
    ticketId,
    onMessage: (msg) => {
      if (msg?.type === "new_message" && Number(msg.ticketId) === Number(ticketId)) {
        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}/messages`] });
      }
      if (msg?.type === "ticket_update" && Number(msg.ticketId) === Number(ticketId)) {
        queryClient.invalidateQueries({ queryKey: [`/api/tickets/${ticketId}`] });
      }
    },
  });

  useEffect(() => {
    connect();
  }, [connect]);

  const onSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    sendMutation.mutate();
  };

  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle>Chat {connected ? <span className="text-xs text-green-600 ml-2">(live)</span> : <span className="text-xs text-gray-500 ml-2">(offline)</span>}</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={listRef} className="h-64 overflow-y-auto space-y-3 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
          {(messages as TicketMessage[]).length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No messages yet.</div>
          ) : (
            (messages as TicketMessage[]).map((m) => (
              <div key={m.id} className="text-sm">
                <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{m.message}</div>
                <div className="text-xs text-gray-500">
                  {(m.sender?.firstName || m.sender?.lastName) ? `${m.sender?.firstName ?? ''} ${m.sender?.lastName ?? ''}`.trim() : (m.sender?.email || m.sender?.id || '')}
                  {" • "}
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
        <form onSubmit={onSend} className="mt-3 flex gap-2">
          <Input placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" disabled={!text.trim() || sendMutation.isPending}>Send</Button>
        </form>
      </CardContent>
    </Card>
  );
}

