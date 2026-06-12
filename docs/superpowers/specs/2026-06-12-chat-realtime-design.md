# ChatWS — Diseño de Chat en Tiempo Real

**Fecha:** 2026-06-12  
**Stack:** Angular + TypeScript (frontend) · Python FastAPI (backend)  
**Alcance:** Chat básico en tiempo real, sala única, mensajes efímeros

---

## 1. Arquitectura

Monorepo con dos carpetas independientes:

```
ChatWS/
├── frontend/          # Angular app (TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── chat-room/      # Vista principal del chat
│   │   │   │   └── join-form/      # Formulario para ingresar nombre
│   │   │   └── services/
│   │   │       └── chat.service.ts # Maneja la conexión WebSocket
│   │   └── ...
│   └── package.json
│
└── backend/           # FastAPI (Python)
    ├── main.py        # Punto de entrada, rutas HTTP y WS
    ├── manager.py     # ConnectionManager
    └── requirements.txt
```

---

## 2. Flujo Principal

1. El usuario abre la app y escribe su nombre en `JoinFormComponent`.
2. Angular abre una conexión WebSocket con FastAPI: `ws://localhost:8000/ws/{username}`.
3. El backend registra al cliente en `ConnectionManager` y notifica a todos que se unió.
4. El usuario escribe un mensaje → Angular lo envía por WebSocket.
5. FastAPI hace broadcast del mensaje (como JSON) a todos los clientes conectados.
6. Angular recibe el mensaje y lo agrega a la lista en pantalla.
7. Al cerrar la pestaña, FastAPI notifica a todos que el usuario se fue.

---

## 3. Backend (FastAPI)

### ConnectionManager (`manager.py`)

- Mantiene una lista `active_connections: list[WebSocket]`.
- Métodos: `connect(ws)`, `disconnect(ws)`, `broadcast(message: str)`.

### Endpoints (`main.py`)

| Endpoint | Tipo | Descripción |
|---|---|---|
| `GET /` | HTTP | Health check |
| `WS /ws/{username}` | WebSocket | Conexión de un cliente al chat |

### Formato de mensaje (JSON)

```json
{
  "username": "Mati",
  "message": "Hola a todos!",
  "timestamp": "2026-06-12T10:30:00"
}
```

Mensajes de sistema (join/leave) usan `"username": "Sistema"`.

### Dependencias

```
fastapi
uvicorn[standard]
```

---

## 4. Frontend (Angular)

### Componentes

**`JoinFormComponent`**
- Pantalla inicial.
- Input para nombre de usuario (requerido, no vacío).
- Al hacer submit, navega a `ChatRoomComponent` pasando el nombre.

**`ChatRoomComponent`**
- Lista scrolleable de mensajes.
- Input + botón para enviar mensajes.
- Muestra estado de conexión (conectado / desconectado).
- Al cargar el componente, llama a `ChatService.connect(username)`.

### ChatService (`chat.service.ts`)

- Abre un `WebSocket` nativo del browser.
- Expone `messages$: Observable<Message>` que el componente escucha.
- Método `send(message: string)` para enviar al servidor.
- Reconexión automática si la conexión se cae.

### Modelo de datos (TypeScript)

```typescript
interface Message {
  username: string;
  message: string;
  timestamp: string;
}
```

---

## 5. Manejo de Errores

| Escenario | Comportamiento |
|---|---|
| WebSocket caído | Muestra "Desconectado" en UI, reintenta cada 3s |
| Backend no disponible al inicio | Error visible en pantalla |
| Nombre vacío en formulario | Botón deshabilitado, no permite avanzar |
| Envío con WS cerrado | Mensaje ignorado, UI muestra estado desconectado |

---

## 6. Entorno de Desarrollo

- **Backend:** `uvicorn main:app --reload` → `http://localhost:8000`
- **Frontend:** `ng serve` → `http://localhost:4200`
- **CORS:** FastAPI configurado para aceptar `http://localhost:4200`

---

## 7. Fuera de Alcance

- Autenticación / cuentas de usuario
- Múltiples salas
- Persistencia de mensajes en base de datos
- Notificaciones push
- Typing indicators / estados online/offline
