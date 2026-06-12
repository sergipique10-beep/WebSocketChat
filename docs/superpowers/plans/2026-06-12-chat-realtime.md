# ChatWS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time chat app with Angular frontend and FastAPI backend using WebSockets, single room, ephemeral messages.

**Architecture:** FastAPI manages a `ConnectionManager` that holds all active WebSocket connections and broadcasts every message to all clients. Angular's `ChatService` opens a WebSocket connection and exposes an Observable stream of messages to `ChatRoomComponent`.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, pytest, pytest-asyncio, httpx · Angular 17+, TypeScript, RxJS

---

## File Map

```
ChatWS/
├── backend/
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── manager.py           # ConnectionManager
│   ├── main.py              # FastAPI app + WS endpoint
│   └── tests/
│       ├── __init__.py
│       ├── test_manager.py
│       └── test_main.py
└── frontend/                # Created by `ng new`
    └── src/app/
        ├── models/
        │   └── message.model.ts
        ├── services/
        │   ├── chat.service.ts
        │   └── chat.service.spec.ts
        ├── components/
        │   ├── join-form/
        │   │   ├── join-form.component.ts
        │   │   ├── join-form.component.html
        │   │   └── join-form.component.spec.ts
        │   └── chat-room/
        │       ├── chat-room.component.ts
        │       ├── chat-room.component.html
        │       └── chat-room.component.spec.ts
        ├── app.routes.ts
        └── app.component.ts
```

---

## Task 1: Backend — Project Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi
uvicorn[standard]
pytest
pytest-asyncio
httpx
```

- [ ] **Step 2: Create `backend/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 3: Create `backend/tests/__init__.py`** (empty file)

- [ ] **Step 4: Create and activate virtual environment, install dependencies**

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Expected: all packages install without errors.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests/__init__.py
git commit -m "chore: add backend project setup"
```

---

## Task 2: Backend — ConnectionManager

**Files:**
- Create: `backend/tests/test_manager.py`
- Create: `backend/manager.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_manager.py`**

```python
import pytest
from unittest.mock import AsyncMock
from manager import ConnectionManager


@pytest.mark.asyncio
async def test_connect_accepts_and_registers():
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws)
    ws.accept.assert_called_once()
    assert ws in mgr.active_connections


@pytest.mark.asyncio
async def test_disconnect_removes_connection():
    mgr = ConnectionManager()
    ws = AsyncMock()
    await mgr.connect(ws)
    mgr.disconnect(ws)
    assert ws not in mgr.active_connections


@pytest.mark.asyncio
async def test_broadcast_sends_to_all_connections():
    mgr = ConnectionManager()
    ws1, ws2 = AsyncMock(), AsyncMock()
    await mgr.connect(ws1)
    await mgr.connect(ws2)
    await mgr.broadcast("hello")
    ws1.send_text.assert_called_once_with("hello")
    ws2.send_text.assert_called_once_with("hello")


@pytest.mark.asyncio
async def test_broadcast_empty_connections_does_nothing():
    mgr = ConnectionManager()
    await mgr.broadcast("hello")  # should not raise
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_manager.py -v
```

Expected: `ModuleNotFoundError: No module named 'manager'`

- [ ] **Step 3: Create `backend/manager.py`**

```python
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str) -> None:
        for connection in self.active_connections:
            await connection.send_text(message)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_manager.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/manager.py backend/tests/test_manager.py
git commit -m "feat: add ConnectionManager with broadcast"
```

---

## Task 3: Backend — FastAPI App and WebSocket Endpoint

**Files:**
- Create: `backend/tests/test_main.py`
- Create: `backend/main.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_main.py`**

```python
import json
import pytest
from starlette.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_websocket_join_notifies_all(client):
    with client.websocket_connect("/ws/Mati") as ws1:
        join_msg = json.loads(ws1.receive_text())
        assert join_msg["username"] == "Sistema"
        assert "Mati" in join_msg["message"]


def test_websocket_broadcast_to_all_clients(client):
    with client.websocket_connect("/ws/Mati") as ws1:
        ws1.receive_text()  # consume: "Mati se unió"

        with client.websocket_connect("/ws/Juan") as ws2:
            ws1.receive_text()  # consume: "Juan se unió" (received by ws1)
            ws2.receive_text()  # consume: "Juan se unió" (received by ws2)

            ws1.send_text("Hola todos")

            msg_to_sender = json.loads(ws1.receive_text())
            msg_to_other = json.loads(ws2.receive_text())

            assert msg_to_sender["username"] == "Mati"
            assert msg_to_sender["message"] == "Hola todos"
            assert msg_to_other["username"] == "Mati"
            assert msg_to_other["message"] == "Hola todos"


def test_websocket_disconnect_notifies_all(client):
    with client.websocket_connect("/ws/Mati") as ws1:
        ws1.receive_text()  # consume: "Mati se unió"

        with client.websocket_connect("/ws/Juan") as ws2:
            ws1.receive_text()  # consume: "Juan se unió"
            ws2.receive_text()  # consume: "Juan se unió"

        # ws2 disconnected — ws1 should receive leave notification
        leave_msg = json.loads(ws1.receive_text())
        assert leave_msg["username"] == "Sistema"
        assert "Juan" in leave_msg["message"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_main.py -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Create `backend/main.py`**

```python
import json
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from manager import ConnectionManager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()


@app.get("/")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket)
    await manager.broadcast(json.dumps({
        "username": "Sistema",
        "message": f"{username} se unió al chat.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }))
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(json.dumps({
                "username": username,
                "message": data,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(json.dumps({
            "username": "Sistema",
            "message": f"{username} abandonó el chat.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))
```

- [ ] **Step 4: Run all backend tests**

```bash
pytest -v
```

Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: add FastAPI WebSocket endpoint with CORS"
```

---

## Task 4: Frontend — Angular Scaffold

**Files:**
- Create: `frontend/` (via `ng new`)

- [ ] **Step 1: Install Angular CLI if not present**

```bash
npm list -g @angular/cli || npm install -g @angular/cli
```

- [ ] **Step 2: Scaffold Angular project (from `ChatWS/` root)**

```bash
ng new frontend --routing --style=css --skip-git --defaults
```

Expected: new `frontend/` folder with Angular 17+ standalone app.

- [ ] **Step 3: Generate components and service**

```bash
cd frontend
ng generate service services/chat
ng generate component components/join-form
ng generate component components/chat-room
```

Expected: 4 new files per component (`.ts`, `.html`, `.css`, `.spec.ts`), 2 new files for service (`.ts`, `.spec.ts`).

- [ ] **Step 4: Create message model `frontend/src/app/models/message.model.ts`**

```typescript
export interface Message {
  username: string;
  message: string;
  timestamp: string;
}
```

- [ ] **Step 5: Verify scaffold compiles**

```bash
ng build
```

Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/
git commit -m "chore: scaffold Angular app with components and service"
```

---

## Task 5: Frontend — ChatService

**Files:**
- Modify: `frontend/src/app/services/chat.service.spec.ts`
- Modify: `frontend/src/app/services/chat.service.ts`

- [ ] **Step 1: Replace `frontend/src/app/services/chat.service.spec.ts` with failing tests**

```typescript
import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { Message } from '../models/message.model';

describe('ChatService', () => {
  let service: ChatService;
  let mockWs: any;

  beforeEach(() => {
    mockWs = {
      readyState: WebSocket.OPEN,
      send: jasmine.createSpy('send'),
      close: jasmine.createSpy('close'),
      onopen: null as any,
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any,
    };
    spyOn(window, 'WebSocket').and.returnValue(mockWs);
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatService);
  });

  afterEach(() => service.disconnect());

  it('should be created', () => expect(service).toBeTruthy());

  it('should open WebSocket with correct URL on connect', () => {
    service.connect('Mati');
    expect(window.WebSocket).toHaveBeenCalledWith('ws://localhost:8000/ws/Mati');
  });

  it('should emit true on connected$ when ws opens', (done) => {
    service.connect('Mati');
    service.connected$.subscribe((status) => {
      expect(status).toBe(true);
      done();
    });
    mockWs.onopen();
  });

  it('should emit parsed message on messages$ when ws receives data', (done) => {
    const testMsg: Message = { username: 'Juan', message: 'Hola', timestamp: '2026-06-12T10:00:00' };
    service.connect('Mati');
    service.messages$.subscribe((msg) => {
      expect(msg).toEqual(testMsg);
      done();
    });
    mockWs.onmessage({ data: JSON.stringify(testMsg) });
  });

  it('should call ws.send when connected and send() is called', () => {
    service.connect('Mati');
    service.send('test message');
    expect(mockWs.send).toHaveBeenCalledWith('test message');
  });

  it('should not call ws.send when disconnected', () => {
    service.connect('Mati');
    mockWs.readyState = WebSocket.CLOSED;
    service.send('test message');
    expect(mockWs.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend
ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: multiple failures about missing properties/methods on ChatService.

- [ ] **Step 3: Replace `frontend/src/app/services/chat.service.ts` with implementation**

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { Message } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  messages$ = new Subject<Message>();
  connected$ = new Subject<boolean>();

  private ws: WebSocket | null = null;
  private username = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(username: string): void {
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: ChatService — 6 specs, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/app/services/ frontend/src/app/models/
git commit -m "feat: add ChatService with WebSocket and auto-reconnect"
```

---

## Task 6: Frontend — JoinFormComponent

**Files:**
- Modify: `frontend/src/app/components/join-form/join-form.component.spec.ts`
- Modify: `frontend/src/app/components/join-form/join-form.component.ts`
- Modify: `frontend/src/app/components/join-form/join-form.component.html`

- [ ] **Step 1: Replace spec file with failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JoinFormComponent } from './join-form.component';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';

describe('JoinFormComponent', () => {
  let component: JoinFormComponent;
  let fixture: ComponentFixture<JoinFormComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoinFormComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should not navigate when username is empty', () => {
    component.username = '';
    component.join();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should not navigate when username is only whitespace', () => {
    component.username = '   ';
    component.join();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate to /chat with trimmed username', () => {
    component.username = ' Mati ';
    component.join();
    expect(router.navigate).toHaveBeenCalledWith(['/chat'], {
      queryParams: { username: 'Mati' },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend
ng test --watch=false --browsers=ChromeHeadless --include="**/join-form*" 2>&1 | tail -20
```

Expected: failures because `username` and `join()` are not defined.

- [ ] **Step 3: Replace `join-form.component.ts` with implementation**

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-join-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './join-form.component.html',
})
export class JoinFormComponent {
  username = '';

  constructor(private router: Router) {}

  join(): void {
    const trimmed = this.username.trim();
    if (trimmed) {
      this.router.navigate(['/chat'], { queryParams: { username: trimmed } });
    }
  }
}
```

- [ ] **Step 4: Replace `join-form.component.html` with template**

```html
<div class="join-container">
  <h1>ChatWS</h1>
  <form (ngSubmit)="join()">
    <input
      type="text"
      [(ngModel)]="username"
      name="username"
      placeholder="Tu nombre..."
      autocomplete="off"
    />
    <button type="submit" [disabled]="!username.trim()">Unirse</button>
  </form>
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
ng test --watch=false --browsers=ChromeHeadless --include="**/join-form*" 2>&1 | tail -20
```

Expected: JoinFormComponent — 4 specs, 0 failures.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/app/components/join-form/
git commit -m "feat: add JoinFormComponent with username validation"
```

---

## Task 7: Frontend — ChatRoomComponent

**Files:**
- Modify: `frontend/src/app/components/chat-room/chat-room.component.spec.ts`
- Modify: `frontend/src/app/components/chat-room/chat-room.component.ts`
- Modify: `frontend/src/app/components/chat-room/chat-room.component.html`

- [ ] **Step 1: Replace spec file with failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatRoomComponent } from './chat-room.component';
import { ChatService } from '../../services/chat.service';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { Message } from '../../models/message.model';

describe('ChatRoomComponent', () => {
  let component: ChatRoomComponent;
  let fixture: ComponentFixture<ChatRoomComponent>;
  let mockMessages$: Subject<Message>;
  let mockConnected$: Subject<boolean>;
  let mockChatService: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    mockMessages$ = new Subject<Message>();
    mockConnected$ = new Subject<boolean>();

    mockChatService = jasmine.createSpyObj('ChatService', ['connect', 'send', 'disconnect']);
    (mockChatService as any).messages$ = mockMessages$;
    (mockChatService as any).connected$ = mockConnected$;

    await TestBed.configureTestingModule({
      imports: [ChatRoomComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: { username: 'Mati' } } },
        },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should connect on init with username from route', () => {
    expect(mockChatService.connect).toHaveBeenCalledWith('Mati');
  });

  it('should add incoming messages to list', () => {
    const msg: Message = { username: 'Juan', message: 'Hola', timestamp: '2026-06-12T10:00:00' };
    mockMessages$.next(msg);
    expect(component.messages.length).toBe(1);
    expect(component.messages[0]).toEqual(msg);
  });

  it('should update isConnected on connected$ events', () => {
    mockConnected$.next(true);
    expect(component.isConnected).toBe(true);
    mockConnected$.next(false);
    expect(component.isConnected).toBe(false);
  });

  it('should not send empty or whitespace message', () => {
    component.newMessage = '   ';
    component.sendMessage();
    expect(mockChatService.send).not.toHaveBeenCalled();
  });

  it('should send trimmed message and clear input', () => {
    component.newMessage = ' Hola! ';
    component.sendMessage();
    expect(mockChatService.send).toHaveBeenCalledWith('Hola!');
    expect(component.newMessage).toBe('');
  });

  it('should disconnect on destroy', () => {
    component.ngOnDestroy();
    expect(mockChatService.disconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend
ng test --watch=false --browsers=ChromeHeadless --include="**/chat-room*" 2>&1 | tail -20
```

Expected: multiple failures about missing properties.

- [ ] **Step 3: Replace `chat-room.component.ts` with implementation**

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './chat-room.component.html',
})
export class ChatRoomComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  newMessage = '';
  username = '';
  isConnected = false;

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService
  ) {}

  ngOnInit(): void {
    this.username = this.route.snapshot.queryParams['username'] || 'Anónimo';
    this.chatService.connect(this.username);

    this.subs.add(
      this.chatService.messages$.subscribe((msg) => this.messages.push(msg))
    );
    this.subs.add(
      this.chatService.connected$.subscribe((status) => (this.isConnected = status))
    );
  }

  sendMessage(): void {
    const trimmed = this.newMessage.trim();
    if (trimmed) {
      this.chatService.send(trimmed);
      this.newMessage = '';
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.chatService.disconnect();
  }
}
```

- [ ] **Step 4: Replace `chat-room.component.html` with template**

```html
<div class="chat-container">
  <div class="status" [class.connected]="isConnected" [class.disconnected]="!isConnected">
    {{ isConnected ? 'Conectado' : 'Desconectado — reconectando...' }}
  </div>

  <div class="messages">
    @for (msg of messages; track msg.timestamp) {
      <div class="message" [class.own]="msg.username === username">
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
      [disabled]="!isConnected"
      autocomplete="off"
    />
    <button type="submit" [disabled]="!newMessage.trim() || !isConnected">Enviar</button>
  </form>
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
ng test --watch=false --browsers=ChromeHeadless --include="**/chat-room*" 2>&1 | tail -20
```

Expected: ChatRoomComponent — 7 specs, 0 failures.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/app/components/chat-room/
git commit -m "feat: add ChatRoomComponent with message list and send form"
```

---

## Task 8: Frontend — Routes and AppComponent

**Files:**
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Replace `frontend/src/app/app.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { JoinFormComponent } from './components/join-form/join-form.component';
import { ChatRoomComponent } from './components/chat-room/chat-room.component';

export const routes: Routes = [
  { path: '', component: JoinFormComponent },
  { path: 'chat', component: ChatRoomComponent },
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 2: Replace `frontend/src/app/app.component.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {}
```

- [ ] **Step 3: Build to verify no compile errors**

```bash
cd frontend
ng build
```

Expected: build completes successfully.

- [ ] **Step 4: Run all Angular tests**

```bash
ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -30
```

Expected: all specs pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/app/app.routes.ts frontend/src/app/app.component.ts
git commit -m "feat: wire up routing between join form and chat room"
```

---

## Task 9: Manual Integration Test

- [ ] **Step 1: Start the backend (terminal 1)**

```bash
cd backend
.venv\Scripts\Activate.ps1   # Windows
# or: source .venv/bin/activate
uvicorn main:app --reload
```

Expected: `Uvicorn running on http://127.0.0.1:8000`

- [ ] **Step 2: Start the frontend (terminal 2)**

```bash
cd frontend
ng serve
```

Expected: `Application bundle generation complete. Local: http://localhost:4200`

- [ ] **Step 3: Open two browser tabs at `http://localhost:4200`**

In tab 1: enter "Alice" and click "Unirse".
In tab 2: enter "Bob" and click "Unirse".

- [ ] **Step 4: Verify real-time messaging**

In tab 1: type "Hola Bob!" and send.
Expected: message appears in both tabs immediately.

In tab 2: type "Hola Alice!" and send.
Expected: message appears in both tabs immediately.

- [ ] **Step 5: Verify join/leave notifications**

Open a third tab as "Carlos" → tabs 1 and 2 should show "Carlos se unió al chat."
Close tab 3 → tabs 1 and 2 should show "Carlos abandonó el chat."

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: complete ChatWS real-time chat app"
```
