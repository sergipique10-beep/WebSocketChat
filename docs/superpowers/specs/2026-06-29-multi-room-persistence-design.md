# Multi-Room Persistence — Design Spec

**Date:** 2026-06-29  
**Scope:** Allow users to join multiple chat rooms simultaneously, with per-room message persistence and unread badges, without leaving the current chat.

---

## Problem

Currently, switching rooms clears all messages and closes the previous WebSocket. Users lose history and can only be in one room at a time.

---

## Solution: Multi-WebSocket Pool

Maintain one WebSocket connection per joined room, all active simultaneously. Messages accumulate per room in memory. Switching rooms changes the active view without disconnecting anything.

The backend (`RoomManager`) already supports multiple concurrent WebSocket connections — no backend changes needed.

---

## Architecture

### Chat Service (`chat.ts`) — Refactor

Replace single-connection state with a room pool:

```ts
interface RoomState {
  ws: WebSocket;
  messages: Message[];
  unread: number;
  connected: boolean;
}

roomPool: Map<string, RoomState>   // keyed by room name
activeRoom: signal<string>
```

**New public API:**

| Method | Behavior |
|--------|----------|
| `joinRoom(username, room)` | Opens WS for room if not already joined; adds to pool |
| `leaveRoom(room)` | Closes WS for room, removes from pool |
| `setActiveRoom(room)` | Sets active view, resets that room's unread to 0 |
| `leaveAll()` | Closes all WS connections (used on logout) |
| `messages$(room)` | Returns messages array for a given room |
| `unread$(room)` | Returns unread count for a given room |
| `isConnected$(room)` | Returns connection status for a given room |
| `joinedRooms()` | Signal: list of currently joined room names |

**Message handling per WS:**
- On message received: push to that room's `messages[]`
- If room is not `activeRoom`: increment `unread`
- If room is `activeRoom`: `unread` stays 0

**Initial join:** On `ngOnInit`, `ChatRoom` calls `joinRoom(username, roomFromQueryParams)` instead of `connect()`. This becomes the initial active room.

---

### ChatRoom Component — Refactor

**Template changes:**

The sidebar splits into two sections:

```
MIS SALAS
  ● Deportes           (active, gold border)
  Gaming     [3]  [✕]  (unread badge, leave btn)

SALAS DISPONIBLES
  Cine        [+]
  Tecnología  [+]
  ...
```

- "Mis Salas" = `chatService.joinedRooms()`
- "Salas Disponibles" = `availableRooms()` minus `joinedRooms()`
- Badge `[3]` = unread count for that room, hidden when 0
- `[+]` calls `joinRoom(username, room)` and `setActiveRoom(room)`
- `[✕]` calls `leaveRoom(room)`; if it was active, switches to first remaining joined room
- Clicking a joined room calls `setActiveRoom(room)`

**Main area:** Renders `chatService.messages$(activeRoom())` — switches instantly on room change, no reload.

**Header:** Room name shows `activeRoom()`. Status shows `isConnected$(activeRoom())`. "Abandonar" → "Salir" — calls `leaveAll()` and navigates to `/`.

---

## Data Flow

```
User clicks [+] on "Gaming"
  → ChatRoom calls chatService.joinRoom(username, 'Gaming')
  → Service opens new WebSocket to /ws/Gaming/username
  → Service adds Gaming entry to roomPool with empty messages[]
  → Service calls setActiveRoom('Gaming')
  → View switches to Gaming messages (empty initially)
  → Deportes WS stays open in background

Message arrives on Deportes WS (background)
  → Service pushes to roomPool['Deportes'].messages
  → roomPool['Deportes'].unread++
  → Sidebar badge updates reactively

User clicks "Deportes" in sidebar
  → setActiveRoom('Deportes')
  → roomPool['Deportes'].unread = 0
  → View shows Deportes messages (full history preserved)
```

---

## Edge Cases

- **Joining a room already joined:** `joinRoom` is a no-op if room already in pool; just calls `setActiveRoom`.
- **Leaving the active room:** Auto-switch to first remaining joined room. If no rooms left, navigate to `/`.
- **WebSocket disconnect/reconnect:** Each room's `connected` flag flips independently. Status indicator reflects active room only.
- **Same username, multiple rooms:** Backend already handles this — different WS paths (`/ws/Deportes/Frodo` vs `/ws/Gaming/Frodo`).

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/app/services/chat.ts` | Full refactor — single WS → room pool |
| `frontend/src/app/components/chat-room/chat-room.ts` | Use new service API, add `joinedRooms` logic |
| `frontend/src/app/components/chat-room/chat-room.html` | Split sidebar into Mis Salas / Disponibles, add badges and buttons |
| `frontend/src/app/components/chat-room/chat-room.css` | Badge styles, joined/available section styles, leave-room button |

---

## Non-goals

- No backend persistence (messages lost on page refresh — out of scope)
- No push notifications (browser-level)
- No message count limits per room (unbounded in-memory)
- No reconnection logic beyond existing behavior
