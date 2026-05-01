import os
import sys
from pathlib import Path

import pytest


@pytest.fixture()
def client():
    """
    Flask test client for the existing monolithic backend/server.py.
    We intentionally import the module inside the fixture so env vars
    (feature flags) can be set before import if needed.
    """
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    # Feature flags baseline: disabled by default
    os.environ.setdefault("ENABLE_TTS", "false")
    os.environ.setdefault("ENABLE_AVATAR_GENERATION", "false")

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


def test_routes_list_returns_sorted_rules(client):
    res = client.get("/api/routes")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert all("rule" in x and "methods" in x for x in data)
    rules_sorted = sorted(data, key=lambda x: x["rule"])
    assert data == rules_sorted


def test_characters_ok_nonempty_has_id_and_name(client):
    res = client.get("/api/characters")
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert all(isinstance(x, dict) for x in data)
    assert all("id" in x and "name" in x for x in data)


def test_chat_ok_with_valid_character_id(client):
    chars = client.get("/api/characters").get_json()
    char_id = chars[0]["id"]

    res = client.post(
        "/api/chat",
        json={"characterId": char_id, "message": "Test", "history": []},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data, dict)
    assert isinstance(data.get("answer"), str)
    assert data["answer"].strip() != ""


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


def test_chat_fragments_is_list_key_exists(client):
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
