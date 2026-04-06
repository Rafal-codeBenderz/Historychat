import sys
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.fixture()
def client(monkeypatch):
    """
    Flask test client. Env flags forced off so local .env cannot break CI.
    """
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    monkeypatch.setenv("ENABLE_TTS", "false")
    monkeypatch.setenv("ENABLE_AVATAR_GENERATION", "false")

    from backend.server import app  # noqa: WPS433

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


def test_health_ok_has_required_fields(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, dict)
    assert "rag_mode" in data
    assert "chunks_loaded" in data
    assert "app_version" in data
    assert isinstance(data["app_version"], str)
    assert "avatar_image_generation_enabled" in data
    assert isinstance(data["avatar_image_generation_enabled"], bool)


def test_characters_ok_nonempty_has_id_and_name(client):
    res = client.get("/api/characters")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert all(isinstance(x, dict) for x in data)
    assert all("id" in x and "name" in x for x in data)


@patch("backend.api.chat.call_llm", return_value="Historia odpowiedź testowa")
def test_chat_ok_with_valid_character_id(_mock_llm, client):
    chars = client.get("/api/characters").get_json()
    char_id = chars[0]["id"]

    res = client.post(
        "/api/chat",
        json={"characterId": char_id, "message": "Test", "history": []},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, dict)
    assert data.get("answer") == "Historia odpowiedź testowa"


def test_chat_missing_character_id_is_validation_error(client):
    res = client.post("/api/chat", json={"message": "Test", "history": []})
    assert res.status_code in (400, 422)


def test_chat_too_long_message_is_validation_error(client):
    chars = client.get("/api/characters").get_json()
    char_id = chars[0]["id"]
    res = client.post(
        "/api/chat",
        json={"characterId": char_id, "message": "x" * 20000, "history": []},
    )
    assert res.status_code in (400, 422)


def test_tts_disabled_returns_503(client):
    res = client.post("/api/tts", json={"text": "Hello", "voice_id": "nova"})
    assert res.status_code == 503


@patch("backend.api.chat.call_llm", return_value="Historia odpowiedź testowa")
def test_chat_fragments_is_list_key_exists(_mock_llm, client):
    chars = client.get("/api/characters").get_json()
    char_id = chars[0]["id"]
    res = client.post(
        "/api/chat",
        json={"characterId": char_id, "message": "Test", "history": []},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert "fragments" in data
    assert isinstance(data["fragments"], list)


def test_get_engine_singleton_behavior(client):
    from backend.core.rag_engine import get_engine  # noqa: WPS433

    a = get_engine()
    b = get_engine()
    assert a is b


def test_list_routes_returns_json(client):
    res = client.get("/api/routes")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, list)
    assert any(isinstance(x, dict) and "rule" in x for x in data)
