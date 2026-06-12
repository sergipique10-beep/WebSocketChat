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
