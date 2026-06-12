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
