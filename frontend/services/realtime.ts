type RealtimeEvent =
  | { type: 'MESSAGE'; payload: any }
  | { type: 'NOTIFICATION'; payload: any };

type MessageHandler = (data: RealtimeEvent) => void;

class RealtimeService {
  private socket: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();

  connect(url: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.socket) {
      this.socket.close();
    }

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
    };

    this.socket.onmessage = (event) => {
      try {
        const data: RealtimeEvent = JSON.parse(event.data);
        this.handlers.forEach((handler) => handler(data));
      } catch (error) {
        console.error('Invalid realtime message', error);
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
    };

    this.socket.onerror = (error) => {
      console.error('Realtime error', error);
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