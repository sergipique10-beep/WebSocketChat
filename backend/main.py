import json
import os
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from manager import RoomManager
from ai_service import AIService

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

manager = RoomManager()
ai = AIService()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/rooms")
async def list_rooms():
    return {"rooms": manager.get_rooms()}


@app.websocket("/ws/{room}/{username}")
async def websocket_endpoint(websocket: WebSocket, room: str, username: str):
    await manager.connect(room, websocket)
    await manager.broadcast(room, json.dumps({
        "username": "Sistema",
        "message": f"{username} se unió a #{room}.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }))
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(room, json.dumps({
                "username": username,
                "message": data,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
            ai.record_user(room, username, data)
            if "@ia" in data.lower():
                try:
                    reply = await ai.respond(room)
                except Exception as exc:
                    reply = f"Error al contactar la IA: {exc}"
                await manager.broadcast(room, json.dumps({
                    "username": "IA",
                    "message": reply,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }))
    except WebSocketDisconnect:
        manager.disconnect(room, websocket)
        await manager.broadcast(room, json.dumps({
            "username": "Sistema",
            "message": f"{username} abandonó #{room}.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }))


_static_dir = os.getenv("STATIC_DIR", "../frontend/dist/frontend/browser")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
