"""
Testy backendu — feature "Podroz w czasie" (time-travel).

Pokrycie:
  T1 - GET /api/characters zwraca pole `time_travel` dla postaci z meta.
  T2 - GET /api/characters/time-travel-meta zwraca slownik char_id -> meta.
  T3 - POST /api/time-travel/suggest-scene 200 + {"places": [...]}.
  T4 - POST /api/time-travel/suggest-scene 422 dla roku poza zakresem.
  T5 - POST /api/chat/time-travel happy path (mock LLM + RAG) -> 200 + answer/fragments.
  T6 - POST /api/chat/time-travel scena niedozwolona -> 422 + error_code='scene_not_allowed'
       BEZ wywolania LLM (zgodnie z planem TT).
  T7 - POST /api/chat/time-travel walidacja roku poza zakresem -> 422.

Wzorzec organizacji jak w backend/tests/test_debate.py.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# -- path setup --------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("ENABLE_TTS", "false")
os.environ.setdefault("ENABLE_AVATAR_GENERATION", "false")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def client():
    from backend.server import app
    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c


@pytest.fixture()
def known_char_id():
    """Postac istniejaca w CHARACTERS i posiadajaca metadane TT (zakres lat + miejsca)."""
    return "copernicus"


# ---------------------------------------------------------------------------
# T1 - enrich /api/characters z polem time_travel
# ---------------------------------------------------------------------------
class TestCharactersEnrichedWithTimeTravel:
    def test_returns_time_travel_field_for_known_char(self, client, known_char_id):
        res = client.get("/api/characters")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list) and len(data) > 0

        item = next((c for c in data if c.get("id") == known_char_id), None)
        assert item is not None, f"Brak postaci {known_char_id} w /api/characters"
        assert "time_travel" in item, "Pole time_travel powinno byc obecne w odpowiedzi"
        tt = item["time_travel"]
        # Akceptujemy slownik z metadanymi LUB jawne `false` dla postaci bez meta;
        # dla copernicus oczekujemy dict z polami zakresu/lokacji.
        assert isinstance(tt, dict), "Dla copernicus time_travel powinno byc dict"
        assert isinstance(tt.get("start_year"), int)
        assert isinstance(tt.get("end_year"), int)
        assert isinstance(tt.get("locations"), list)


# ---------------------------------------------------------------------------
# T2 - GET /api/characters/time-travel-meta
# ---------------------------------------------------------------------------
class TestTimeTravelMetaEndpoint:
    def test_returns_dict_with_meta_entries(self, client, known_char_id):
        res = client.get("/api/characters/time-travel-meta")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, dict)
        assert known_char_id in data
        meta = data[known_char_id]
        assert isinstance(meta, dict)
        assert isinstance(meta.get("start_year"), int)
        assert isinstance(meta.get("end_year"), int)
        assert isinstance(meta.get("locations"), list)
        assert all(isinstance(loc, str) for loc in meta["locations"])


# ---------------------------------------------------------------------------
# T3 / T4 - POST /api/time-travel/suggest-scene
# ---------------------------------------------------------------------------
class TestSuggestSceneEndpoint:
    def test_returns_places_list_for_valid_year(self, client):
        res = client.post(
            "/api/time-travel/suggest-scene",
            json={"year": 1500},
        )
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, dict)
        assert "places" in data and isinstance(data["places"], list)
        assert all(isinstance(p, str) for p in data["places"])

    def test_year_out_of_range_returns_422(self, client):
        res = client.post(
            "/api/time-travel/suggest-scene",
            json={"year": 9999},
        )
        assert res.status_code == 422

    def test_invalid_year_type_returns_400(self, client):
        res = client.post(
            "/api/time-travel/suggest-scene",
            json={"year": "abc"},
        )
        assert res.status_code == 400

    def test_invalid_region_token_format_returns_422(self, client):
        res = client.post(
            "/api/time-travel/suggest-scene",
            json={"year": 1500, "regionToken": "ZLY TOKEN!"},
        )
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# T5 - POST /api/chat/time-travel happy path (mock LLM + RAG)
# ---------------------------------------------------------------------------
class TestChatTimeTravelHappyPath:
    def test_returns_200_with_answer_and_fragments(self, client, known_char_id):
        with (
            patch("backend.api.routes.call_llm", return_value="Odpowiedz testowa z podrozy w czasie."),
            patch("backend.api.routes.get_engine") as mock_engine,
        ):
            mock_engine.return_value.retrieve.return_value = [
                {"text": "Fragment z dziela.", "source": "de_revolutionibus", "score": 0.5}
            ]
            mock_engine.return_value.chunks = {known_char_id: ["chunk"]}
            res = client.post(
                "/api/chat/time-travel",
                json={
                    "characterId": known_char_id,
                    "message": "Co teraz robisz?",
                    "history": [],
                    "year": 1510,
                    "location": "Frombork",
                },
            )
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data.get("answer"), str) and data["answer"].strip()
        assert isinstance(data.get("fragments"), list)
        assert "character" in data


# ---------------------------------------------------------------------------
# T6 - POST /api/chat/time-travel scena niedozwolona -> 422 BEZ wywolania LLM
# ---------------------------------------------------------------------------
class TestChatTimeTravelSceneNotAllowed:
    def test_scene_not_allowed_returns_422_and_does_not_call_llm(self, client, known_char_id):
        with (
            patch("backend.api.routes.call_llm") as mock_llm,
            patch("backend.api.routes.get_engine") as mock_engine,
        ):
            mock_engine.return_value.retrieve.return_value = []
            mock_engine.return_value.chunks = {}
            # rok poza zakresem zycia + miejsce zupelnie obce
            res = client.post(
                "/api/chat/time-travel",
                json={
                    "characterId": known_char_id,
                    "message": "Czesc",
                    "history": [],
                    "year": 1900,
                    "location": "Tokio",
                },
            )
        assert res.status_code == 422
        data = res.get_json()
        assert data.get("error_code") == "scene_not_allowed"
        assert isinstance(data.get("user_message"), str) and data["user_message"].strip()
        # Najwazniejsze: LLM NIE moze byc wywolany, gdy scena jest niedozwolona.
        mock_llm.assert_not_called()


# ---------------------------------------------------------------------------
# T7 - POST /api/chat/time-travel walidacja roku
# ---------------------------------------------------------------------------
class TestChatTimeTravelInputValidation:
    def test_year_out_of_range_returns_422(self, client, known_char_id):
        with patch("backend.api.routes.call_llm") as mock_llm:
            res = client.post(
                "/api/chat/time-travel",
                json={
                    "characterId": known_char_id,
                    "message": "Test",
                    "history": [],
                    "year": 99999,
                    "location": "Frombork",
                },
            )
        assert res.status_code == 422
        mock_llm.assert_not_called()

    def test_missing_year_returns_400(self, client, known_char_id):
        res = client.post(
            "/api/chat/time-travel",
            json={
                "characterId": known_char_id,
                "message": "Test",
                "history": [],
                "location": "Frombork",
            },
        )
        assert res.status_code == 400

    def test_missing_location_returns_400(self, client, known_char_id):
        res = client.post(
            "/api/chat/time-travel",
            json={
                "characterId": known_char_id,
                "message": "Test",
                "history": [],
                "year": 1500,
                "location": "",
            },
        )
        assert res.status_code == 400
