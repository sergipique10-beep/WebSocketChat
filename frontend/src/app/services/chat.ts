import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { Message } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class Chat implements OnDestroy {
  messages$ = new Subject<Message>();
  connected$ = new Subject<boolean>();

  private ws: WebSocket | null = null;
  private username = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(username: string): void {
    this.disconnect();
    this.username = username;
    this.openConnection();
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private openConnection(): void {
    this.ws = new WebSocket(`ws://localhost:8000/ws/${this.username}`);

    this.ws.onopen = () => this.connected$.next(true);

    this.ws.onmessage = (event: MessageEvent) => {
      const msg: Message = JSON.parse(event.data);
      this.messages$.next(msg);
    };

    this.ws.onclose = () => {
      this.connected$.next(false);
      this.reconnectTimer = setTimeout(() => this.openConnection(), 3000);
    };

    this.ws.onerror = () => this.ws?.close();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
