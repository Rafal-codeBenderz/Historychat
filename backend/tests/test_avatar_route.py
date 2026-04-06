import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests


@pytest.fixture()
def avatar_client(monkeypatch, tmp_path):
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    monkeypatch.setenv("ENABLE_TTS", "false")
    monkeypatch.setenv("ENABLE_AVATAR_GENERATION", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake")
    monkeypatch.setattr("backend.api.avatar_route.ROOT", tmp_path)

    from backend.server import app  # noqa: WPS433

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


def test_generate_avatar_openai_error_does_not_leak_details(avatar_client):
    import openai

    req = MagicMock()
    with patch("openai.OpenAI") as mock_cls:
        mock_cls.return_value.images.generate.side_effect = openai.APIError(
            "SECRET_OPENAI_MESSAGE_DO_NOT_LEAK",
            request=req,
            body=None,
        )
        res = avatar_client.post("/api/generate-avatar", json={"character_id": "antoinette"})
    assert res.status_code == 500
    data = res.get_json()
    assert isinstance(data, dict)
    assert "SECRET_OPENAI_MESSAGE" not in data.get("error", "")


def test_generate_avatar_requests_error_generic_message(avatar_client):
    mock_img = MagicMock()
    mock_img.b64_json = None
    mock_img.url = "https://example.com/fake.png"
    api_response = MagicMock()
    api_response.data = [mock_img]

    with patch("openai.OpenAI") as mock_cls:
        mock_cls.return_value.images.generate.return_value = api_response
        with patch(
            "requests.get",
            side_effect=requests.RequestException("SECRET_HTTP_DETAIL"),
        ):
            res = avatar_client.post("/api/generate-avatar", json={"character_id": "antoinette"})

    assert res.status_code == 500
    data = res.get_json()
    assert isinstance(data, dict)
    assert "SECRET_HTTP_DETAIL" not in data.get("error", "")
