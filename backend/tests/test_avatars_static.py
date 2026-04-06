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

    from backend.server import app  # noqa: WPS433

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


def test_avatars_invalid_filename_uppercase_extension(client):
    res = client.get("/avatars/copernicus.JPG")
    assert res.status_code == 404


def test_avatars_invalid_filename_wrong_extension(client):
    res = client.get("/avatars/copernicus.png")
    assert res.status_code == 404


def test_avatars_invalid_filename_traversal_attempt(client):
    res = client.get("/avatars/../etc/passwd")
    assert res.status_code == 404


def test_avatars_missing_file_valid_pattern(client):
    res = client.get("/avatars/zzzz_nonexistent_avatar_id.jpg")
    assert res.status_code == 404
