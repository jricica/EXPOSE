type MessageHandler = (data: any) => void;

class RealtimeService {
  private socket: WebSocket | null = null;
  private handlers: MessageHandler[] = [];

  connect(url: string) {
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log("Realtime connected");
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handlers.forEach((handler) => handler(data));
    };

    this.socket.onclose = () => {
      console.log("Realtime disconnected");
    };
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  subscribe(handler: MessageHandler) {
    this.handlers.push(handler);
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }
}

export const realtimeService = new RealtimeService();