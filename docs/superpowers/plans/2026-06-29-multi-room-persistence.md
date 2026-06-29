# Multi-Room Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to join multiple chat rooms simultaneously, with per-room message persistence and unread badges, without leaving the current chat.

**Architecture:** Refactor the `Chat` service from a single WebSocket to a `Map<string, RoomState>` pool — one WS per joined room, all active concurrently. The `ChatRoom` component reads per-room state from the service via Angular signals. The sidebar splits into "Mis Salas" (joined, with unread badges and leave buttons) and "Salas Disponibles" (available to join).

**Tech Stack:** Angular 17+ standalone components, RxJS BehaviorSubject, Angular signals, native WebSocket API, TypeScript.

## Global Constraints

- No backend changes — backend already supports multiple concurrent connections per room
- No external state libraries (no NgRx, no store)
- Angular signals (`signal`, `computed`) for reactive UI state — no new BehaviorSubjects in components
- All WebSocket URLs use `environment.wsUrl` (e.g. `ws://localhost:8000`)
- `getRooms()` HTTP call stays unchanged
- Messages are in-memory only — no persistence across page refresh

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/app/services/chat.ts` | **Rewrite** | Room pool, per-room WS lifecycle, signals |
| `frontend/src/app/components/chat-room/chat-room.ts` | **Modify** | Use new service API, joined rooms logic |
| `frontend/src/app/components/chat-room/chat-room.html` | **Modify** | Split sidebar, badges, join/leave buttons |
| `frontend/src/app/components/chat-room/chat-room.css` | **Modify** | Badge styles, section headers, leave-room button |

---

### Task 1: Rewrite Chat Service with Room Pool

**Files:**
- Modify: `frontend/src/app/services/chat.ts`

**Interfaces produced (used by Task 2):**
```ts
// RoomState — internal to service, not exported
interface RoomState {
  ws: WebSocket | null;
  messages: Message[];
  unread: number;
  connected: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

// Chat service public API:
joinRoom(username: string, room: string): void
leaveRoom(room: string): void
setActiveRoom(room: string): void
leaveAll(): void
send(message: string): void                        // sends to activeRoom
getRooms(): Promise<string[]>                      // unchanged

// Signals (read-only from components):
activeRoom: Signal<string>
joinedRooms: Signal<string[]>
activeMessages: Signal<Message[]>
activeConnected: Signal<boolean>
unreadFor(room: string): number                    // synchronous getter
```

- [ ] **Step 1: Replace the full content of `chat.ts`**

```ts
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

  private closeRoomWs(room: string, state: RoomState): void {
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors related to `chat.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/services/chat.ts
git commit -m "refactor: chat service — single WS to multi-room pool"
```

---

### Task 2: Refactor ChatRoom Component TypeScript

**Files:**
- Modify: `frontend/src/app/components/chat-room/chat-room.ts`

**Interfaces consumed from Task 1:**
```ts
chatService.joinRoom(username: string, room: string): void
chatService.leaveRoom(room: string): void
chatService.setActiveRoom(room: string): void
chatService.leaveAll(): void
chatService.send(message: string): void
chatService.getRooms(): Promise<string[]>
chatService.activeRoom: Signal<string>
chatService.joinedRooms: Signal<string[]>
chatService.activeMessages: Signal<Message[]>
chatService.activeConnected: Signal<boolean>
chatService.unreadFor(room: string): number
```

- [ ] **Step 1: Replace full content of `chat-room.ts`**

```ts
import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chat } from '../../services/chat';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './chat-room.html',
  styleUrl: './chat-room.css'
})
export class ChatRoom implements OnInit, OnDestroy {
  newMessage = '';
  username = '';

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private allRooms = signal<string[]>([]);

  readonly currentRoom = this.chatService.activeRoom;
  readonly isConnected = this.chatService.activeConnected;
  readonly messages = this.chatService.activeMessages;
  readonly joinedRooms = this.chatService.joinedRooms;

  readonly availableRooms = computed(() =>
    this.allRooms().filter(r => !this.chatService.joinedRooms().includes(r))
  );

  particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 3 + Math.random() * 5,
    duration: 4 + Math.random() * 7,
    delay: -(Math.random() * 10)
  }));

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    readonly chatService: Chat
  ) {}

  ngOnInit(): void {
    this.username = this.route.snapshot.queryParams['username'] || 'Anónimo';
    const room = this.route.snapshot.queryParams['room'] || 'General';
    this.chatService.joinRoom(this.username, room);
    this.pollRooms();
    this.pollInterval = setInterval(() => this.pollRooms(), 5000);
  }

  joinRoom(room: string): void {
    this.chatService.joinRoom(this.username, room);
  }

  leaveRoom(room: string): void {
    this.chatService.leaveRoom(room);
    if (this.chatService.joinedRooms().length === 0) {
      this.router.navigate(['/']);
    }
  }

  switchRoom(room: string): void {
    this.chatService.setActiveRoom(room);
  }

  unreadFor(room: string): number {
    return this.chatService.unreadFor(room);
  }

  sendMessage(): void {
    const trimmed = this.newMessage.trim();
    if (trimmed) {
      this.chatService.send(trimmed);
      this.newMessage = '';
    }
  }

  leave(): void {
    this.chatService.leaveAll();
    this.router.navigate(['/']);
  }

  private async pollRooms(): Promise<void> {
    const rooms = await this.chatService.getRooms();
    const joined = this.chatService.joinedRooms();
    const combined = new Set([...rooms, ...joined]);
    this.allRooms.set(Array.from(combined));
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/chat-room/chat-room.ts
git commit -m "refactor: chat-room component uses multi-room service API"
```

---

### Task 3: Update Chat Room Template

**Files:**
- Modify: `frontend/src/app/components/chat-room/chat-room.html`

- [ ] **Step 1: Replace full content of `chat-room.html`**

```html
<div class="chat-layout">
  <div class="aurora-bg">
    <div class="aurora a1"></div>
    <div class="aurora a2"></div>
    <div class="aurora a3"></div>
  </div>
  <div class="particles-bg">
    @for (p of particles; track $index) {
      <span class="particle"
        [style.left.%]="p.x"
        [style.top.%]="p.y"
        [style.width.px]="p.size"
        [style.height.px]="p.size"
        [style.animationDuration.s]="p.duration"
        [style.animationDelay.s]="p.delay">
      </span>
    }
  </div>

  <aside class="sidebar">
    <!-- Mis Salas -->
    <div class="sidebar-section">
      <h2>Mis Salas</h2>
      @for (room of joinedRooms(); track room) {
        <div class="room-row" [class.active]="room === currentRoom()">
          <button class="room-btn" (click)="switchRoom(room)">
            {{ room }}
            @if (unreadFor(room) > 0) {
              <span class="badge">{{ unreadFor(room) }}</span>
            }
          </button>
          <button class="room-leave-btn" (click)="leaveRoom(room)" title="Salir de sala">✕</button>
        </div>
      }
    </div>

    <!-- Salas Disponibles -->
    @if (availableRooms().length > 0) {
      <div class="sidebar-section">
        <h2>Disponibles</h2>
        @for (room of availableRooms(); track room) {
          <div class="room-row">
            <span class="room-label">{{ room }}</span>
            <button class="room-join-btn" (click)="joinRoom(room)" title="Unirse">+</button>
          </div>
        }
      </div>
    }
  </aside>

  <div class="chat-container">
    <div class="chat-header">
      <span class="room-name">{{ currentRoom() }}</span>
      <span class="status" [class.connected]="isConnected()" [class.disconnected]="!isConnected()">
        {{ isConnected() ? '● ON' : '○ OFF' }}
      </span>
      <button class="btn-leave" (click)="leave()">Salir</button>
    </div>

    <div class="messages">
      @for (msg of messages(); track msg.timestamp) {
        <div class="message"
          [class.own]="msg.username === username"
          [class.system]="msg.username === 'Sistema'">
          <span class="author">{{ msg.username }}</span>
          <span class="text">{{ msg.message }}</span>
          <span class="time">{{ msg.timestamp | date:'HH:mm' }}</span>
        </div>
      }
    </div>

    <form class="input-area" (ngSubmit)="sendMessage()">
      <input
        type="text"
        [(ngModel)]="newMessage"
        name="message"
        placeholder="Escribí un mensaje..."
        [disabled]="!isConnected()"
        autocomplete="off"
      />
      <button type="submit" [disabled]="!newMessage.trim() || !isConnected()">Enviar</button>
    </form>
  </div>
</div>
```

- [ ] **Step 2: Verify Angular builds without errors**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Build at: ... - Hash: ... - Time: ...ms` with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/chat-room/chat-room.html
git commit -m "feat: split sidebar into Mis Salas / Disponibles with join buttons"
```

---

### Task 4: Update CSS — Badges, Room Rows, Section Headers

**Files:**
- Modify: `frontend/src/app/components/chat-room/chat-room.css`

- [ ] **Step 1: Replace the sidebar section of the CSS** (from `/* Sidebar */` to the end of `.no-rooms`)

Find this block in the file:
```css
/* Sidebar */
.sidebar {
  width: 200px;
  min-width: 200px;
  background: rgba(0,0,0,0.65);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  position: relative;
  z-index: 1;
}

.sidebar h2 {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 3px;
  color: var(--gold-dim);
  text-transform: uppercase;
  padding: 0 16px 16px;
  border-bottom: 1px solid rgba(74,55,40,0.4);
  margin-bottom: 10px;
}

.room-btn {
  width: 100%;
  text-align: left;
  padding: 9px 16px;
  background: transparent;
  color: var(--text-dim);
  font-family: 'Crimson Text', serif;
  font-size: 1rem;
  border-left: 3px solid transparent;
  transition: all 0.15s;
}

.room-btn:hover { color: var(--text); background: rgba(201,168,76,0.05); }

.room-btn.active {
  color: var(--gold-light);
  border-left-color: var(--gold);
  background: rgba(201,168,76,0.1);
}

.no-rooms { color: var(--text-dim); font-style: italic; font-size: 0.85rem; padding: 8px 16px; }
```

Replace with:
```css
/* Sidebar */
.sidebar {
  width: 210px;
  min-width: 210px;
  background: rgba(0,0,0,0.65);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 12px 0;
  position: relative;
  z-index: 1;
  overflow-y: auto;
}

.sidebar-section {
  padding-bottom: 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(74,55,40,0.3);
}

.sidebar-section:last-child { border-bottom: none; }

.sidebar h2 {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 3px;
  color: var(--gold-dim);
  text-transform: uppercase;
  padding: 8px 14px 6px;
}

.room-row {
  display: flex;
  align-items: center;
  padding: 0 8px 0 0;
}

.room-row.active .room-btn {
  color: var(--gold-light);
  border-left-color: var(--gold);
  background: rgba(201,168,76,0.1);
}

.room-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  padding: 7px 8px 7px 14px;
  background: transparent;
  color: var(--text-dim);
  font-family: 'Crimson Text', serif;
  font-size: 0.95rem;
  border-left: 3px solid transparent;
  transition: all 0.15s;
}

.room-btn:hover { color: var(--text); background: rgba(201,168,76,0.05); }

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--red);
  color: #f0d0d0;
  border-radius: 9px;
  font-size: 0.65rem;
  font-family: 'Cinzel', serif;
  font-weight: 700;
  margin-left: 6px;
}

.room-leave-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  background: transparent;
  color: var(--text-dim);
  font-size: 0.7rem;
  border-radius: 50%;
  border: 1px solid transparent;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.room-leave-btn:hover {
  border-color: var(--red);
  color: #e57373;
  background: rgba(139,26,26,0.2);
}

.room-label {
  flex: 1;
  padding: 7px 8px 7px 14px;
  color: var(--text-dim);
  font-family: 'Crimson Text', serif;
  font-size: 0.95rem;
  border-left: 3px solid transparent;
}

.room-join-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  background: transparent;
  color: var(--gold-dim);
  font-size: 1rem;
  border-radius: 50%;
  border: 1px solid var(--gold-dim);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.room-join-btn:hover {
  border-color: var(--gold);
  color: var(--gold-light);
  background: rgba(201,168,76,0.1);
}
```

- [ ] **Step 2: Verify Angular builds without errors**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server:
```bash
cd frontend && npx ng serve
```

Open two browser tabs to `http://localhost:4200`. In Tab 1:
1. Join as "Frodo" in room "Gaming"
2. Verify sidebar shows "Mis Salas → Gaming" and "Disponibles" list
3. Click "+" on another room — verify it appears in "Mis Salas", badge starts at 0
4. In Tab 2, join the same second room as "Sam" and send a message
5. In Tab 1, verify badge increments on the inactive room
6. Click the room in Tab 1 — verify badge resets to 0 and messages appear with history
7. Click "✕" on a room — verify it disappears from "Mis Salas" and reappears in "Disponibles"
8. Click "Salir" — verify navigation back to login

- [ ] **Step 4: Commit and push**

```bash
git add frontend/src/app/components/chat-room/chat-room.css
git commit -m "feat: sidebar badges, join/leave room buttons, room-row layout"
git push
```
