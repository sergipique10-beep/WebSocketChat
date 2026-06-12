from fastapi import WebSocket


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, room: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(room, []).append(websocket)

    def disconnect(self, room: str, websocket: WebSocket) -> None:
        if room in self.rooms:
            try:
                self.rooms[room].remove(websocket)
            except ValueError:
                pass
            if not self.rooms[room]:
                del self.rooms[room]

    async def broadcast(self, room: str, message: str) -> None:
        for connection in list(self.rooms.get(room, [])):
            try:
                await connection.send_text(message)
            except Exception:
                pass

    def get_rooms(self) -> list[str]:
        return list(self.rooms.keys())
