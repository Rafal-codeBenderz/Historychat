"""Daily request budget (in-process fallback when Redis is not used)."""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.fixture()
def client(monkeypatch):
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    monkeypatch.setenv("ENABLE_TTS", "false")
    monkeypatch.setenv("ENABLE_AVATAR_GENERATION", "false")
    monkeypatch.setenv("API_AUTH_ENABLED", "false")
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("API_DAILY_REQUEST_BUDGET", "2")

    from backend.server import app  # noqa: WPS433

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


@patch("backend.api.chat.call_llm", return_value="ok")
def test_daily_budget_returns_429_after_limit(_mock_llm, client):
    chars = client.get("/api/characters").get_json()
    char_id = chars[0]["id"]
    payload = {"characterId": char_id, "message": "x", "history": []}

    assert client.post("/api/chat", json=payload).status_code == 200
    assert client.post("/api/chat", json=payload).status_code == 200
    res = client.post("/api/chat", json=payload)
    assert res.status_code == 429
    assert "budget" in (res.get_json() or {}).get("error", "").lower()
