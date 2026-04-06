"""API key authentication for costly endpoints."""

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

    from backend.server import app  # noqa: WPS433

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


@patch("backend.api.chat.call_llm", return_value="ok")
def test_chat_requires_bearer_when_api_auth_enabled(_mock_llm, client, monkeypatch):
    monkeypatch.setenv("API_AUTH_ENABLED", "true")
    monkeypatch.setenv("HISTORYCHAT_API_KEY", "secret-test-key")
    from backend.config.auth import invalidate_api_keys_cache

    invalidate_api_keys_cache()

    chars = client.get("/api/characters").get_json()
    char_id = chars[0]["id"]

    res = client.post("/api/chat", json={"characterId": char_id, "message": "Hi", "history": []})
    assert res.status_code == 401

    res2 = client.post(
        "/api/chat",
        json={"characterId": char_id, "message": "Hi", "history": []},
        headers={"Authorization": "Bearer secret-test-key"},
    )
    assert res2.status_code == 200


def test_health_live_ok(client):
    res = client.get("/api/health/live")
    assert res.status_code == 200
    assert res.get_json().get("status") == "ok"


def test_health_ready_ok_or_degraded(client):
    res = client.get("/api/health/ready")
    assert res.status_code in (200, 503)
    body = res.get_json()
    assert isinstance(body, dict)
    assert "status" in body


def test_metrics_not_found_when_disabled(client):
    res = client.get("/api/metrics")
    assert res.status_code == 404


def test_metrics_prometheus_when_enabled(client, monkeypatch):
    monkeypatch.setenv("METRICS_ENABLED", "true")
    res = client.get("/api/metrics")
    assert res.status_code == 200
    assert b"historychat_http_requests_total" in res.data
