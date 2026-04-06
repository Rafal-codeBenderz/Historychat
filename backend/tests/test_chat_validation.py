"""Walidacja wejścia /api/chat i bezpieczna odpowiedź LLM przy trwałym błędzie API (mocki)."""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def client(monkeypatch):
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    monkeypatch.setenv("ENABLE_TTS", "false")
    monkeypatch.setenv("ENABLE_AVATAR_GENERATION", "false")

    from backend.server import app  # noqa: WPS433

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


def test_chat_returns_400_when_character_id_unknown(client):
    res = client.post(
        "/api/chat",
        json={
            "characterId": "definitely_not_a_real_character_xyz",
            "message": "Hi",
            "history": [],
        },
    )
    assert res.status_code == 400
    err = (res.get_json() or {}).get("error", "")
    assert "Nieznana" in err


def test_chat_returns_400_when_message_not_string(client):
    res = client.post(
        "/api/chat",
        json={"characterId": "copernicus", "message": 123, "history": []},
    )
    assert res.status_code == 400


def test_chat_returns_422_when_message_too_long(client):
    res = client.post(
        "/api/chat",
        json={"characterId": "copernicus", "message": "x" * 6001, "history": []},
    )
    assert res.status_code == 422


def test_chat_returns_400_when_history_item_not_object(client):
    res = client.post(
        "/api/chat",
        json={"characterId": "copernicus", "message": "Hi", "history": ["bad"]},
    )
    assert res.status_code == 400


def test_chat_returns_400_when_history_role_invalid(client):
    res = client.post(
        "/api/chat",
        json={
            "characterId": "copernicus",
            "message": "Hi",
            "history": [{"role": "system", "content": "x"}],
        },
    )
    assert res.status_code == 400


def test_chat_returns_400_when_history_content_not_string(client):
    res = client.post(
        "/api/chat",
        json={
            "characterId": "copernicus",
            "message": "Hi",
            "history": [{"role": "user", "content": 1}],
        },
    )
    assert res.status_code == 400


def test_chat_returns_422_when_history_too_many_entries(client):
    hist = [{"role": "user", "content": "a"}] * 41
    res = client.post(
        "/api/chat",
        json={"characterId": "copernicus", "message": "Hi", "history": hist},
    )
    assert res.status_code == 422


def test_chat_returns_400_when_source_stem_not_string(client):
    res = client.post(
        "/api/chat",
        json={
            "characterId": "copernicus",
            "message": "Hi",
            "history": [],
            "sourceStem": 99,
        },
    )
    assert res.status_code == 400


@patch("backend.api.bootstrap.open", new_callable=MagicMock)
def test_save_chat_history_skips_file_when_disabled(mock_open, monkeypatch):
    monkeypatch.setenv("ENABLE_CHAT_HISTORY", "false")
    from backend.api.bootstrap import save_chat_history

    save_chat_history("copernicus", "user", "hello")
    mock_open.assert_not_called()


@pytest.fixture(autouse=True)
def _no_sleep_in_llm_retry(monkeypatch):
    monkeypatch.setattr("backend.services.retry_utils.time.sleep", lambda _s: None)


@patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-fake"}, clear=False)
@patch("openai.OpenAI")
def test_call_openai_returns_user_safe_message_when_api_always_fails(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.side_effect = RuntimeError("rate limit 429")

    from backend.services.llm import _LLM_FAILURE_USER_MESSAGE, call_openai

    out = call_openai("prompt text")
    assert out == _LLM_FAILURE_USER_MESSAGE
