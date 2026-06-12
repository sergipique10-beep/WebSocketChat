# ChatWS — Render Deployment Design

**Fecha:** 2026-06-12  
**Objetivo:** Deployar ChatWS en Render para testing usando dos servicios separados

---

## 1. Arquitectura

```
GitHub repo (ChatWS)
├── backend/    → Render Web Service  (FastAPI + WebSocket)
└── frontend/   → Render Static Site (Angular build)
```

Los dos servicios se comunican por URLs de Render. La URL del backend se baja al frontend en tiempo de build vía Angular environments.

---

## 2. Cambios en el Código

### Backend — `backend/main.py`

Reemplazar el `allow_origins` hardcodeado por una variable de entorno:

```python
import os

origins = os.getenv("CORS_ORIGINS", "http://localhost:4200").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- En desarrollo local: `CORS_ORIGINS` no está seteado → usa `http://localhost:4200`
- En Render: `CORS_ORIGINS=https://<frontend>.onrender.com`

### Frontend — Angular Environments

**Crear `frontend/src/environments/environment.ts`** (desarrollo):

```typescript
export const environment = {
  wsUrl: 'ws://localhost:8000'
};
```

**Crear `frontend/src/environments/environment.prod.ts`** (producción):

```typescript
export const environment = {
  wsUrl: 'wss://<BACKEND_NAME>.onrender.com'
};
```

> El placeholder `<BACKEND_NAME>` se reemplaza con el nombre real después de crear el servicio backend en Render.

**Actualizar `frontend/angular.json`** — agregar `fileReplacements` bajo `configurations.production`:

```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

**Actualizar `frontend/src/app/services/chat.ts`** — usar `environment.wsUrl`:

```typescript
import { environment } from '../../environments/environment';

// En openConnection():
this.ws = new WebSocket(`${environment.wsUrl}/ws/${this.username}`);
```

---

## 3. Configuración de Render

### Backend — Web Service

| Campo | Valor |
|---|---|
| Fuente | GitHub repo → rama `master` |
| Runtime | Python 3 |
| Root Directory | `backend` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Env Var** | `CORS_ORIGINS=https://<FRONTEND_NAME>.onrender.com` |

> `$PORT` lo inyecta Render automáticamente.

### Frontend — Static Site

| Campo | Valor |
|---|---|
| Fuente | GitHub repo → rama `master` |
| Root Directory | `frontend` |
| Build Command | `npm ci && ng build` |
| Publish Directory | `dist/frontend/browser` |

> No necesita variables de entorno — la URL del backend queda bakeada en el build.

---

## 4. Orden de Deploy

El orden importa porque los servicios dependen de las URLs del otro:

```
1. Push repo a GitHub
2. Crear backend en Render → copiar URL (ej: chatwsbackend.onrender.com)
3. Actualizar environment.prod.ts con la URL del backend → push
4. Crear frontend en Render → copiar URL (ej: chatwsfront.onrender.com)
5. Agregar CORS_ORIGINS en el backend con la URL del frontend → Render redeploy automático
```

---

## 5. Consideraciones de Producción

- **WebSocket en HTTPS:** Render usa HTTPS por defecto → las conexiones WebSocket deben ser `wss://` (no `ws://`). Por eso `environment.prod.ts` usa `wss://`.
- **Free tier sleep:** Los Web Services gratuitos en Render entran en sleep tras 15 min de inactividad. El primer mensaje puede tardar ~30s en despertar el servidor — aceptable para testing.
- **Sin base de datos:** Los mensajes siguen siendo efímeros (en memoria). Si el backend se reinicia, se pierden las conexiones activas.

---

## 6. Fuera de Alcance

- Variables de entorno en tiempo de ejecución en Angular (runtime config)
- Múltiples ambientes (staging, prod)
- Custom domains
- Auto-deploy en branches distintos de `master`
