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
