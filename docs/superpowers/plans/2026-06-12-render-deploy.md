# Render Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy ChatWS (Angular + FastAPI) to Render as two services: a Web Service for the backend and a Static Site for the frontend.

**Architecture:** Backend reads `CORS_ORIGINS` from an environment variable so it can accept requests from the Render frontend URL. The Angular frontend uses `environment.ts` / `environment.prod.ts` to bake the backend WebSocket URL into the production build at compile time.

**Tech Stack:** Python FastAPI, Angular 21, Render (Web Service + Static Site), GitHub

---

## File Map

```
Modify:
  backend/main.py                               ← extract get_cors_origins(), read from env
  backend/tests/test_main.py                    ← add tests for get_cors_origins()
  frontend/angular.json                         ← add fileReplacements for production build
  frontend/src/app/services/chat.ts             ← use environment.wsUrl instead of hardcoded URL

Create:
  frontend/src/environments/environment.ts      ← dev config (ws://localhost:8000)
  frontend/src/environments/environment.prod.ts ← prod config (wss://<backend>.onrender.com)
```

---

## Task 1: Backend — CORS from Environment Variable

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_main.py`**

Add these two tests at the top of the file (after existing imports):

```python
def test_cors_origins_default(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    from main import get_cors_origins
    assert get_cors_origins() == ["http://localhost:4200"]


def test_cors_origins_from_env(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://app.onrender.com,https://other.com")
    from main import get_cors_origins
    assert get_cors_origins() == ["https://app.onrender.com", "https://other.com"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
.venv\Scripts\Activate.ps1
pytest tests/test_main.py::test_cors_origins_default tests/test_main.py::test_cors_origins_from_env -v
```

Expected: `AttributeError: module 'main' has no attribute 'get_cors_origins'`

- [ ] **Step 3: Update `backend/main.py` — extract `get_cors_origins()` and replace hardcoded origins**

Replace the `app.add_middleware(CORSMiddleware, ...)` block. The full updated section (from `import os` through the middleware call):

```python
import json
import os
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from manager import ConnectionManager

app = FastAPI()


def get_cors_origins() -> list[str]:
    return os.getenv("CORS_ORIGINS", "http://localhost:4200").split(",")


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
```

(Keep the rest of `main.py` — the `health` and `websocket_endpoint` functions — unchanged.)

- [ ] **Step 4: Run ALL backend tests**

```bash
pytest -v
```

Expected: 11 passed (9 original + 2 new)

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: read CORS origins from CORS_ORIGINS environment variable"
```

---

## Task 2: Frontend — Angular Environment Files

**Files:**
- Create: `frontend/src/environments/environment.ts`
- Create: `frontend/src/environments/environment.prod.ts`
- Modify: `frontend/angular.json`

- [ ] **Step 1: Create `frontend/src/environments/environment.ts`**

```typescript
export const environment = {
  wsUrl: 'ws://localhost:8000'
};
```

- [ ] **Step 2: Create `frontend/src/environments/environment.prod.ts`**

```typescript
export const environment = {
  wsUrl: 'wss://REPLACE_WITH_BACKEND_NAME.onrender.com'
};
```

> `REPLACE_WITH_BACKEND_NAME` will be filled in Task 6 once the backend is deployed on Render.

- [ ] **Step 3: Add `fileReplacements` to `frontend/angular.json`**

Open `frontend/angular.json`. Find the path:
`projects → frontend → architect → build → configurations → production`

Inside the `"production"` object, add a `"fileReplacements"` entry. It should look like this after the change:

```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  "budgets": [ ... ],
  ...
}
```

Add `"fileReplacements"` as a new key — don't remove any existing keys.

- [ ] **Step 4: Verify the production build uses environment.prod.ts**

```bash
cd frontend
ng build --configuration production 2>&1 | tail -10
```

Expected: build succeeds, no errors.

- [ ] **Step 5: Verify the dev build still works**

```bash
ng build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 6: Run Angular tests to verify nothing broke**

```bash
ng test --watch=false 2>&1 | tail -10
```

Expected: 19 passed.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/src/environments/ frontend/angular.json
git commit -m "feat: add Angular environment files for dev and production"
```

---

## Task 3: Frontend — Chat Service Uses Environment URL

**Files:**
- Modify: `frontend/src/app/services/chat.ts`

- [ ] **Step 1: Run existing Chat service tests to capture baseline**

```bash
cd frontend
ng test --watch=false 2>&1 | grep -E "(PASS|FAIL|Tests)"
```

Expected: 19 passed (no failures before the change).

- [ ] **Step 2: Update `frontend/src/app/services/chat.ts` — add environment import and use it**

Add the import at the top of the file (after existing imports):

```typescript
import { environment } from '../../environments/environment';
```

In the `openConnection()` private method, change the WebSocket constructor line from:

```typescript
this.ws = new WebSocket(`ws://localhost:8000/ws/${this.username}`);
```

to:

```typescript
this.ws = new WebSocket(`${environment.wsUrl}/ws/${this.username}`);
```

- [ ] **Step 3: Run ALL Angular tests**

```bash
ng test --watch=false 2>&1 | tail -15
```

Expected: 19 passed. The Chat service test `should open WebSocket with correct URL on connect` still passes because the test environment uses `environment.ts` (dev), which has `wsUrl: 'ws://localhost:8000'`.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/app/services/chat.ts
git commit -m "feat: use environment.wsUrl in Chat service instead of hardcoded localhost"
```

---

## Task 4: GitHub — Create Repo and Push

- [ ] **Step 1: Create a new GitHub repository**

**Option A — GitHub CLI (if `gh` is installed):**

```bash
gh auth login   # if not already authenticated
gh repo create ChatWS --public --source=. --remote=origin --push
```

Expected: repo created at `https://github.com/<your-username>/ChatWS` and code pushed.

**Option B — GitHub website:**

1. Go to https://github.com/new
2. Repository name: `ChatWS`
3. Public or Private — your choice
4. Do NOT initialize with README, .gitignore, or license (repo already has content)
5. Click "Create repository"

Then run:

```bash
git remote add origin https://github.com/<YOUR_USERNAME>/ChatWS.git
git push -u origin master
```

- [ ] **Step 2: Verify push succeeded**

```bash
git log --oneline origin/master | head -5
```

Expected: same commits as local.

---

## Task 5: Render — Deploy Backend Web Service

> This task is done in the Render dashboard. No code changes.

- [ ] **Step 1: Go to https://render.com and log in**

- [ ] **Step 2: Create a new Web Service**

Click **New → Web Service**.

- [ ] **Step 3: Connect GitHub repo**

Select your `ChatWS` repository. Click **Connect**.

- [ ] **Step 4: Configure the service**

| Field | Value |
|---|---|
| Name | `chatwsbackend` (or any name you want) |
| Region | Oregon (US West) or closest to you |
| Branch | `master` |
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

- [ ] **Step 5: Click "Deploy Web Service"**

Wait for the deploy to finish (~2-3 minutes). The log should end with:
```
Uvicorn running on http://0.0.0.0:XXXXX
```

- [ ] **Step 6: Copy the backend URL**

It will look like: `https://chatwsbackend.onrender.com`

Save this URL — you need it in Task 6.

- [ ] **Step 7: Test the health endpoint**

Open in browser: `https://chatwsbackend.onrender.com/`

Expected response: `{"status":"ok"}`

---

## Task 6: Update environment.prod.ts with Real Backend URL

**Files:**
- Modify: `frontend/src/environments/environment.prod.ts`

- [ ] **Step 1: Replace the placeholder in `frontend/src/environments/environment.prod.ts`**

Replace `REPLACE_WITH_BACKEND_NAME` with the actual service name from Task 5.

Example — if your backend URL is `https://chatwsbackend.onrender.com`, the file becomes:

```typescript
export const environment = {
  wsUrl: 'wss://chatwsbackend.onrender.com'
};
```

> Note: use `wss://` (secure WebSocket), not `ws://`. Render enforces HTTPS which requires WSS.

- [ ] **Step 2: Verify production build uses the real URL**

```bash
cd frontend
ng build --configuration production 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Confirm the URL is in the build output**

```bash
grep -r "chatwsbackend.onrender.com" dist/frontend/browser/
```

Expected: found in one of the JS bundle files.

- [ ] **Step 4: Commit and push**

```bash
cd ..
git add frontend/src/environments/environment.prod.ts
git commit -m "feat: set production WebSocket URL to Render backend"
git push origin master
```

---

## Task 7: Render — Deploy Frontend Static Site

> This task is done in the Render dashboard. No code changes.

- [ ] **Step 1: Create a new Static Site**

In Render dashboard: click **New → Static Site**.

- [ ] **Step 2: Connect GitHub repo**

Select your `ChatWS` repository. Click **Connect**.

- [ ] **Step 3: Configure the site**

| Field | Value |
|---|---|
| Name | `chatwsfront` (or any name) |
| Branch | `master` |
| Root Directory | `frontend` |
| Build Command | `npm ci && ng build --configuration production` |
| Publish Directory | `dist/frontend/browser` |

- [ ] **Step 4: Click "Create Static Site"**

Wait for the build (~3-5 minutes). The log should end with:
```
Application bundle generation complete.
```

- [ ] **Step 5: Copy the frontend URL**

It will look like: `https://chatwsfront.onrender.com`

Save this URL — you need it in Task 8.

- [ ] **Step 6: Open the site in the browser**

Go to `https://chatwsfront.onrender.com`

Expected: the ChatWS join form loads (input for username + "Unirse" button).

---

## Task 8: Configure CORS on the Backend

> This task is done in the Render dashboard. No code changes.

- [ ] **Step 1: Open backend service settings**

In Render dashboard: click on the `chatwsbackend` service → **Environment** tab.

- [ ] **Step 2: Add the `CORS_ORIGINS` environment variable**

Click **Add Environment Variable**:

| Key | Value |
|---|---|
| `CORS_ORIGINS` | `https://chatwsfront.onrender.com` |

Click **Save Changes**. Render will automatically redeploy the backend.

- [ ] **Step 3: Wait for redeploy**

Wait ~1-2 minutes for the backend to redeploy with the new env var.

- [ ] **Step 4: End-to-end test**

1. Open two browser tabs at `https://chatwsfront.onrender.com`
2. Tab 1: enter "Alice" and click "Unirse"
3. Tab 2: enter "Bob" and click "Unirse"
4. Both tabs should show "Conectado" status
5. Tab 1: type "Hola Bob!" and send → appears in both tabs
6. Tab 2: type "Hola Alice!" and send → appears in both tabs
7. Close Tab 2 → Tab 1 should show "Bob abandonó el chat."

Expected: real-time messaging works end-to-end on Render.
