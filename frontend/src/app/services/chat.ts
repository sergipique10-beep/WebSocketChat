import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { Message } from '../models/message.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Chat implements OnDestroy {
  messages$ = new Subject<Message>();
  connected$ = new Subject<boolean>();

  private ws: WebSocket | null = null;
  private username = '';
  private room = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  connect(username: string, room: string): void {
    this.disconnect();
    this.username = username;
    this.room = room;
    this.intentionalDisconnect = false;
    this.openConnection();
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  async getRooms(): Promise<string[]> {
    try {
      const res = await fetch(`${environment.wsUrl.replace('ws', 'http')}/rooms`);
      const data = await res.json();
      return data.rooms ?? [];
    } catch {
      return [];
    }
  }

  private openConnection(): void {
    this.ws = new WebSocket(`${environment.wsUrl}/ws/${this.room}/${this.username}`);

    this.ws.onopen = () => this.connected$.next(true);

    this.ws.onmessage = (event: MessageEvent) => {
      const msg: Message = JSON.parse(event.data);
      this.messages$.next(msg);
    };

    this.ws.onclose = () => {
      this.connected$.next(false);
      if (!this.intentionalDisconnect) {
        this.reconnectTimer = setTimeout(() => this.openConnection(), 3000);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
