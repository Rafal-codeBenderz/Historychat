"""Konfiguracja TTS: timeout klienta OpenAI."""

import os
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def _no_sleep_in_tts_retry(monkeypatch):
    monkeypatch.setattr("backend.services.retry_utils.time.sleep", lambda _s: None)


@patch.dict(os.environ, {"ENABLE_TTS": "true", "OPENAI_API_KEY": "sk-test"}, clear=False)
@patch("openai.OpenAI")
def test_tts_openai_client_gets_default_timeout(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.audio.speech.create.return_value = MagicMock(content=b"x")

    from backend.services.tts import generate_tts_base64

    code, _ = generate_tts_base64("hello", "nova")
    assert code == 200
    _, kwargs = mock_openai_cls.call_args
    assert kwargs.get("timeout") == 60.0


@patch.dict(
    os.environ,
    {"ENABLE_TTS": "true", "OPENAI_API_KEY": "sk-test", "TTS_HTTP_TIMEOUT": "30"},
    clear=False,
)
@patch("openai.OpenAI")
def test_tts_openai_client_respects_tts_http_timeout(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.audio.speech.create.return_value = MagicMock(content=b"x")

    from backend.services.tts import generate_tts_base64

    generate_tts_base64("hello", "nova")
    _, kwargs = mock_openai_cls.call_args
    assert kwargs.get("timeout") == 30.0
