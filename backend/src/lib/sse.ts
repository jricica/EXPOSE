import { Response } from 'express';

interface SSEClient {
  id: number;
  res: Response;
}

class SSEManager {
  private clients = new Set<SSEClient>();
  private nextId = 1;

  add(res: Response): SSEClient {
    const client: SSEClient = { id: this.nextId++, res };
    this.clients.add(client);
    return client;
  }

  remove(client: SSEClient): void {
    this.clients.delete(client);
  }

  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.res.write(payload);
    }
  }

  get size(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
