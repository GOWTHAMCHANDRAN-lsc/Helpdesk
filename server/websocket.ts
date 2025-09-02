import { WebSocketServer, WebSocket } from 'ws';
import { encryptMessage, decryptMessage } from './lib/crypto.js';
import { Server } from 'http';
import { parse } from 'url';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  ticketId?: number;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, request) => {
      const { query } = parse(request.url || '', true);
      const userId = query.userId as string;
      const ticketId = query.ticketId ? parseInt(query.ticketId as string) : undefined;

      if (!userId) {
        ws.close(1008, 'User ID required');
        return;
      }

      const clientId = `${userId}-${Date.now()}`;
      this.clients.set(clientId, { ws, userId, ticketId });

      console.log(`WebSocket client connected: ${clientId}`);

      ws.on('message', (data) => {
        try {
          // Decrypt incoming message
          const decrypted = decryptMessage(data.toString());
          const message = JSON.parse(decrypted);
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Invalid or undecryptable WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(clientId);
      });

      // Send initial connection confirmation
      ws.send(encryptMessage(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      })));
    });
  }

  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'join_ticket':
        client.ticketId = message.ticketId;
        this.clients.set(clientId, client);
        break;
      
      case 'leave_ticket':
        client.ticketId = undefined;
        this.clients.set(clientId, client);
        break;
      
      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
    }
  }

  // Broadcast new message to all clients in a ticket
  broadcastTicketMessage(ticketId: number, message: any) {
    const ticketClients = Array.from(this.clients.values()).filter(
      client => client.ticketId === ticketId
    );

    const messageData = encryptMessage(JSON.stringify({
      type: 'new_message',
      ticketId,
      message,
      timestamp: new Date().toISOString()
    }));

    ticketClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageData);
      }
    });
  }

  // Broadcast ticket status update
  broadcastTicketUpdate(ticketId: number, update: any) {
    const ticketClients = Array.from(this.clients.values()).filter(
      client => client.ticketId === ticketId
    );

    const updateData = encryptMessage(JSON.stringify({
      type: 'ticket_update',
      ticketId,
      update,
      timestamp: new Date().toISOString()
    }));

    ticketClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(updateData);
      }
    });
  }

  // Send notification to specific user
  notifyUser(userId: string, notification: any) {
    const userClients = Array.from(this.clients.values()).filter(
      client => client.userId === userId
    );

    const notificationData = encryptMessage(JSON.stringify({
      type: 'notification',
      notification,
      timestamp: new Date().toISOString()
    }));

    userClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(notificationData);
      }
    });
  }
}

// Export singleton instance
let wsManager: WebSocketManager | null = null;

export function initializeWebSocket(server: Server): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager(server);
  }
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}
