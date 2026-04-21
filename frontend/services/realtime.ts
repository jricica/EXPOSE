type RealtimeMessage =
  | { type: "comment_added"; payload: { postId: string; content: string } }
  | { type: "post_updated"; payload: { postId: string } }
  | { type: string; payload: unknown }; 

type MessageHandler = (data: RealtimeMessage) => void;

class RealtimeService {
  private socket: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private url: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(url: string) {
    if (this.socket) {
      this.socket.close();
    }

    this.url = url;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log("Realtime connected");
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const data: RealtimeMessage = JSON.parse(event.data);
        this.handlers.forEach((handler) => handler(data));
      } catch (error) {
        console.error("Invalid realtime message:", event.data);
      }
    };

    this.socket.onclose = () => {
      console.log("Realtime disconnected");

      if (this.reconnectAttempts < this.maxReconnectAttempts && this.url) {
        this.reconnectAttempts++;
        const delay = 1000 * this.reconnectAttempts;

        setTimeout(() => {
          console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
          this.connect(this.url!);
        }, delay);
      }
    };

    this.socket.onerror = (error) => {
      console.error("Realtime error:", error);
    };
  }

  send(data: RealtimeMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn("Socket not connected");
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