type MessageEventPayload = {
  id: string;
  content: string;
};

type NotificationPayload = {
  message: string;
};

type RealtimeEvent =
  | { type: 'MESSAGE'; payload: MessageEventPayload }
  | { type: 'NOTIFICATION'; payload: NotificationPayload };

type MessageHandler = (data: RealtimeEvent) => void;

const isValidEvent = (data: any): data is RealtimeEvent => {
  if (!data || typeof data !== 'object') return false;

  if (data.type === 'MESSAGE') {
    return (
      data.payload &&
      typeof data.payload.id === 'string' &&
      typeof data.payload.content === 'string'
    );
  }

  if (data.type === 'NOTIFICATION') {
    return (
      data.payload &&
      typeof data.payload.message === 'string'
    );
  }

  return false;
};

class RealtimeService {
  private socket: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();

  connect(url: string) {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.socket) {
      this.socket.close();
    }

    this.socket = new WebSocket(url);

    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        if (!isValidEvent(parsed)) {
          return;
        }

        this.handlers.forEach((handler) => handler(parsed));
      } catch {
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
    };

    this.socket.onerror = () => {
    };
  }

  send(data: unknown) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);

    return () => {
      this.handlers.delete(handler);
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.handlers.clear();
  }
}

export const realtimeService = new RealtimeService();