import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { encryptMessage, decryptMessage } from '../lib/crypto';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  ticketId?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>();
  const reconnectAttemptsRef = useRef<number>(0);
  const isConnectingRef = useRef<boolean>(false);
  const { ticketId, onMessage, onConnect, onDisconnect } = options;

  const MAX_RECONNECT_DELAY = 30000; // 30s
  const BASE_RECONNECT_DELAY = 1000; // 1s
  const MAX_RECONNECT_ATTEMPTS = 10;

  const buildWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws?userId=${user?.employee_id || ''}${
      ticketId ? `&ticketId=${ticketId}` : ''
    }`;
  };

  const connect = () => {
    // Don't attempt to connect if no user id
    if (!user?.employee_id) return;
    // Prevent multiple parallel connect attempts
    if (isConnectingRef.current) return;
    // If an open socket exists, don't create another
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    isConnectingRef.current = true;

    try {
      const wsUrl = buildWsUrl();
      console.debug('[useWebSocket] connecting to', wsUrl);

      // Ensure previous socket is closed before creating a new one
      try {
        if (wsRef.current) {
          wsRef.current.onopen = null;
          wsRef.current.onmessage = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          try { wsRef.current.close(); } catch (_) {}
        }
      } catch (_) {}

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        onConnect?.();

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const decrypted = decryptMessage(event.data);
          const message = JSON.parse(decrypted);
          setMessages(prev => [...prev, message]);
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing or decrypting WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (ev) => {
        console.warn('WebSocket disconnected', ev?.code, ev?.reason);
        setConnected(false);
        isConnectingRef.current = false;
        onDisconnect?.();

        // schedule reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current), MAX_RECONNECT_DELAY);
          reconnectAttemptsRef.current += 1;
          console.debug(`[useWebSocket] scheduling reconnect #${reconnectAttemptsRef.current} in ${delay}ms`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.warn('[useWebSocket] max reconnect attempts reached, will not retry automatically');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Close socket on error to trigger the onclose handler and schedule reconnect
        try {
          wsRef.current?.close();
        } catch (_) {}
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      isConnectingRef.current = false;
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;

    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    setConnected(false);
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const encrypted = encryptMessage(JSON.stringify(message));
      wsRef.current.send(encrypted);
    } else {
      console.warn('WebSocket not open, message not sent');
    }
  };

  const joinTicket = (newTicketId: number) => {
    sendMessage({ type: 'join_ticket', ticketId: newTicketId });
  };

  const leaveTicket = () => {
    sendMessage({ type: 'leave_ticket' });
  };

  useEffect(() => {
    if (user?.employee_id) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employee_id]);

  useEffect(() => {
    if (connected && ticketId) {
      joinTicket(ticketId);
    }

    return () => {
      if (connected && ticketId) {
        leaveTicket();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, ticketId]);

  return {
    connected,
    messages,
    sendMessage,
    joinTicket,
    leaveTicket,
    connect,
    disconnect,
  };
}
