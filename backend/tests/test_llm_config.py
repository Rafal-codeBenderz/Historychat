import os
from unittest.mock import MagicMock, patch

import pytest


def test_call_llm_without_keys_returns_setup_message(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from backend.services.llm import call_llm

    out = call_llm("test prompt")
    assert "Brak klucza API" in out
    assert "OPENAI_API_KEY" in out or "GEMINI_API_KEY" in out


@pytest.fixture(autouse=True)
def _no_sleep_in_llm_retry(monkeypatch):
    monkeypatch.setattr("backend.services.retry_utils.time.sleep", lambda _s: None)


@patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-fake"}, clear=False)
@patch("openai.OpenAI")
def test_call_openai_uses_timeout_from_client_constructor(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="ok"))]
    )
    from backend.services.llm import call_openai

    call_openai("p")
    mock_openai_cls.assert_called()
    _, kwargs = mock_openai_cls.call_args
    assert kwargs.get("timeout") == 60.0


@patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-fake", "OPENAI_HTTP_TIMEOUT": "12.5"}, clear=False)
@patch("openai.OpenAI")
def test_call_openai_respects_openai_http_timeout_env(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="ok"))]
    )
    from backend.services.llm import call_openai

    call_openai("p")
    _, kwargs = mock_openai_cls.call_args
    assert kwargs.get("timeout") == 12.5


@patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-fake"}, clear=False)
@patch("openai.OpenAI")
def test_call_openai_timeout_after_retries_returns_safe_message(mock_openai_cls):
    import openai

    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    err = getattr(openai, "APITimeoutError", type("APITimeoutError", (Exception,), {}))("timeout")
    mock_client.chat.completions.create.side_effect = err

    from backend.services.llm import _LLM_FAILURE_USER_MESSAGE, call_openai

    assert call_openai("prompt") == _LLM_FAILURE_USER_MESSAGE
