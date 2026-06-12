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
