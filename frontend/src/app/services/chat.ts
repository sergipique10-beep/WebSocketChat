import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Message } from '../models/message.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Chat implements OnDestroy {
  messages$ = new Subject<Message>();
  connected$ = new BehaviorSubject<boolean>(false);

  private ws: WebSocket | null = null;
  private username = '';
  private room = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(username: string, room: string): void {
    this.clearReconnect();
    this.closeWs();
    this.username = username;
    this.room = room;
    this.openConnection();
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  disconnect(): void {
    this.clearReconnect();
    this.closeWs();
    this.connected$.next(false);
  }

  async getRooms(): Promise<string[]> {
    try {
      const res = await fetch(`${environment.wsUrl.replace('wss', 'https').replace('ws', 'http')}/rooms`);
      const data = await res.json();
      return data.rooms ?? [];
    } catch {
      return [];
    }
  }

  private openConnection(): void {
    const ws = new WebSocket(`${environment.wsUrl}/ws/${this.room}/${this.username}`);

    ws.onopen = () => {
      this.ws = ws;
      this.connected$.next(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return;
      const msg: Message = JSON.parse(event.data);
      this.messages$.next(msg);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.connected$.next(false);
      this.reconnectTimer = setTimeout(() => this.openConnection(), 3000);
    };

    ws.onerror = () => ws.close();
  }

  private closeWs(): void {
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      old.onopen = null;
      old.onmessage = null;
      old.onclose = null;
      old.onerror = null;
      old.close();
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
