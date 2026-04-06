import sys
from pathlib import Path

import pytest


@pytest.fixture()
def client(monkeypatch):
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    monkeypatch.setenv("ENABLE_TTS", "false")
    monkeypatch.setenv("ENABLE_AVATAR_GENERATION", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_CHAT", "1 per minute")

    from backend.server import app  # noqa: WPS433

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


def test_chat_rate_limited_returns_429_after_second_call(client):
    chars = client.get("/api/characters").get_json()
    char_id = chars[0]["id"]

    res1 = client.post("/api/chat", json={"characterId": char_id, "message": "Test", "history": []})
    assert res1.status_code in (200, 503, 500)

    res2 = client.post("/api/chat", json={"characterId": char_id, "message": "Test", "history": []})
    assert res2.status_code == 429
    payload = res2.get_json() or {}
    assert "error" in payload

