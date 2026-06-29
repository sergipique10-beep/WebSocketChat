import { Injectable, OnDestroy, signal, computed } from '@angular/core';
import { Message } from '../models/message.model';
import { environment } from '../../environments/environment';

interface RoomState {
  ws: WebSocket | null;
  messages: Message[];
  unread: number;
  connected: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

@Injectable({ providedIn: 'root' })
export class Chat implements OnDestroy {
  private pool = new Map<string, RoomState>();
  private username = '';

  readonly activeRoom = signal<string>('');
  readonly joinedRooms = signal<string[]>([]);

  readonly activeMessages = computed<Message[]>(() => {
    this.joinedRooms(); // declares dependency so new messages trigger re-evaluation
    const state = this.pool.get(this.activeRoom());
    return state ? [...state.messages] : [];
  });

  readonly activeConnected = computed<boolean>(() => {
    this.joinedRooms(); // declares dependency so reconnects trigger re-evaluation
    return this.pool.get(this.activeRoom())?.connected ?? false;
  });

  unreadFor(room: string): number {
    return this.pool.get(room)?.unread ?? 0;
  }

  joinRoom(username: string, room: string): void {
    this.username = username;
    if (this.pool.has(room)) {
      this.setActiveRoom(room);
      return;
    }
    const state: RoomState = {
      ws: null,
      messages: [],
      unread: 0,
      connected: false,
      reconnectTimer: null
    };
    this.pool.set(room, state);
    this.joinedRooms.update(rooms => [...rooms, room]);
    this.openConnection(room);
    this.setActiveRoom(room);
  }

  leaveRoom(room: string): void {
    const state = this.pool.get(room);
    if (!state) return;
    this.closeRoomWs(room, state);
    this.pool.delete(room);
    const remaining = this.joinedRooms().filter(r => r !== room);
    this.joinedRooms.set(remaining);
    if (this.activeRoom() === room) {
      this.activeRoom.set(remaining[0] ?? '');
    }
  }

  setActiveRoom(room: string): void {
    this.activeRoom.set(room);
    const state = this.pool.get(room);
    if (state) {
      state.unread = 0;
      this.joinedRooms.update(r => [...r]); // trigger signal refresh for badges
    }
  }

  send(message: string): void {
    const state = this.pool.get(this.activeRoom());
    if (state?.ws?.readyState === WebSocket.OPEN) {
      state.ws.send(message);
    }
  }

  leaveAll(): void {
    for (const [room, state] of this.pool.entries()) {
      this.closeRoomWs(room, state);
    }
    this.pool.clear();
    this.joinedRooms.set([]);
    this.activeRoom.set('');
  }

  async getRooms(): Promise<string[]> {
    try {
      const base = environment.wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      const res = await fetch(`${base}/rooms`);
      const data = await res.json();
      return data.rooms ?? [];
    } catch {
      return [];
    }
  }

  private openConnection(room: string): void {
    const state = this.pool.get(room);
    if (!state) return;
    const ws = new WebSocket(`${environment.wsUrl}/ws/${room}/${this.username}`);

    ws.onopen = () => {
      if (!this.pool.has(room)) { ws.close(); return; }
      state.ws = ws;
      state.connected = true;
      if (this.activeRoom() === room) this.joinedRooms.update(r => [...r]);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!this.pool.has(room) || state.ws !== ws) return;
      const msg: Message = JSON.parse(event.data);
      state.messages.push(msg);
      if (this.activeRoom() !== room) {
        state.unread++;
      }
      this.joinedRooms.update(r => [...r]); // refresh signals
    };

    ws.onclose = () => {
      if (!this.pool.has(room) || state.ws !== ws) return;
      state.connected = false;
      state.ws = null;
      this.joinedRooms.update(r => [...r]);
      state.reconnectTimer = setTimeout(() => this.openConnection(room), 3000);
    };

    ws.onerror = () => ws.close();
  }

  private closeRoomWs(_room: string, state: RoomState): void {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.ws) {
      const ws = state.ws;
      state.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
    }
  }

  ngOnDestroy(): void {
    this.leaveAll();
  }
}
