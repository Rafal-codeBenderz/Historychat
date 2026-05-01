"""
Testy backendu — feature debaty "Sad historyczny".

Pokrycie:
  T1 - build_debate_prompt: poprawna budowa promptu (rola, temat, transkrypt, fragmenty)
  T2 - /api/debate/turn: happy path (mock LLM + RAG) -> 200 + poprawna struktura
  T3 - /api/debate/turn: 400 przy brakujacej tezie / blednej roli / zduplikowanej postaci
  T4 - /api/debate/verdict: verdict_mode=True trafia do sedziego, pole role=="judge"
"""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

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
def roles():
    return {
        "prosecutor": "einstein",
        "defender": "newton",
        "judge": "aristotle",
    }


@pytest.fixture()
def theme():
    return "Nauka niszczy wartosci moralne"


SAMPLE_TRANSCRIPT = [
    {
        "speaker": "einstein",
        "speakerName": "Albert Einstein",
        "role": "prosecutor",
        "content": "Nauka nie ma wartosci moralnych sama w sobie.",
    },
    {
        "speaker": "newton",
        "speakerName": "Isaac Newton",
        "role": "defender",
        "content": "Nauka sluzy czlowiekowi — to ludzie decyduja o jej uzyciu.",
    },
]


# ---------------------------------------------------------------------------
# T1 - build_debate_prompt
# ---------------------------------------------------------------------------
class TestBuildDebatePrompt:
    def test_contains_role_instruction(self, theme):
        from backend.core.debate import build_debate_prompt

        character = {
            "name": "Albert Einstein",
            "era": "XX wiek",
            "bio": "Fizyk teoretyczny.",
            "char_style": "Mowi metaforami.",
        }
        prompt = build_debate_prompt(
            character=character,
            role="prosecutor",
            theme=theme,
            transcript=[],
            fragments=[],
        )
        assert "OSKAR" in prompt.upper()
        assert theme in prompt

    def test_contains_transcript_turns(self, theme):
        from backend.core.debate import build_debate_prompt

        character = {"name": "Isaac Newton", "era": "XVII wiek", "bio": "Matematyk.", "char_style": ""}
        prompt = build_debate_prompt(
            character=character,
            role="defender",
            theme=theme,
            transcript=SAMPLE_TRANSCRIPT,
            fragments=[],
        )
        assert "Albert Einstein" in prompt or "PROSECUTOR" in prompt or "einstein" in prompt.lower()

    def test_verdict_suffix_present_when_verdict_mode(self, theme):
        from backend.core.debate import build_debate_prompt

        character = {"name": "Aristoteles", "era": "IV wiek p.n.e.", "bio": "Filozof.", "char_style": ""}
        prompt = build_debate_prompt(
            character=character,
            role="judge",
            theme=theme,
            transcript=[],
            fragments=[],
            verdict_mode=True,
        )
        assert "WERDYKT" in prompt or "werdykt" in prompt.lower()


# ---------------------------------------------------------------------------
# T2 - /api/debate/turn happy path
# ---------------------------------------------------------------------------
class TestDebateTurnHappyPath:
    def test_returns_200_with_correct_structure(self, client, roles, theme):
        with (
            patch("backend.core.debate.call_llm", return_value="Odpowiedz testowa oskarzyciela."),
            patch("backend.core.debate.get_engine") as mock_engine,
        ):
            mock_engine.return_value.retrieve.return_value = [
                {"text": "Fragment 1.", "source": "test_source"}
            ]
            res = client.post(
                "/api/debate/turn",
                json={
                    "theme": theme,
                    "roles": roles,
                    "next_role": "prosecutor",
                    "transcript": [],
                },
            )
        assert res.status_code == 200
        data = res.get_json()
        assert data["role"] == "prosecutor"
        assert data["speaker"] == "einstein"
        assert isinstance(data["content"], str) and len(data["content"]) > 0
        assert isinstance(data["fragments"], list)
        assert "speakerName" in data


# ---------------------------------------------------------------------------
# T3 - walidacja 400
# ---------------------------------------------------------------------------
class TestDebateTurnValidation:
    def test_missing_theme_returns_400(self, client, roles):
        res = client.post(
            "/api/debate/turn",
            json={"roles": roles, "next_role": "prosecutor", "transcript": []},
        )
        assert res.status_code == 400
        assert "theme" in res.get_json().get("error", "").lower()

    def test_invalid_next_role_returns_400(self, client, roles, theme):
        res = client.post(
            "/api/debate/turn",
            json={"theme": theme, "roles": roles, "next_role": "UNKNOWN", "transcript": []},
        )
        assert res.status_code == 400

    def test_duplicate_characters_returns_400(self, client, theme):
        bad_roles = {"prosecutor": "einstein", "defender": "einstein", "judge": "aristotle"}
        res = client.post(
            "/api/debate/turn",
            json={"theme": theme, "roles": bad_roles, "next_role": "prosecutor", "transcript": []},
        )
        assert res.status_code == 400


# ---------------------------------------------------------------------------
# T4 - /api/debate/verdict -> verdict_mode=True, role==judge
# ---------------------------------------------------------------------------
class TestDebateVerdict:
    def test_verdict_calls_judge_with_verdict_mode(self, client, roles, theme):
        with (
            patch("backend.core.debate.call_llm", return_value="Werdykt: nauka nie niszczy moralnosci."),
            patch("backend.core.debate.get_engine") as mock_engine,
            patch("backend.core.debate.build_debate_prompt", wraps=__import__(
                "backend.core.debate", fromlist=["build_debate_prompt"]
            ).build_debate_prompt) as mock_prompt,
        ):
            mock_engine.return_value.retrieve.return_value = []
            res = client.post(
                "/api/debate/verdict",
                json={"theme": theme, "roles": roles, "transcript": SAMPLE_TRANSCRIPT},
            )
        assert res.status_code == 200
        data = res.get_json()
        assert data["role"] == "judge"
        assert data["speaker"] == "aristotle"
        # Sprawdz ze build_debate_prompt dostalo verdict_mode=True
        call_kwargs = mock_prompt.call_args
        assert call_kwargs is not None
        assert call_kwargs.kwargs.get("verdict_mode") is True or (
            len(call_kwargs.args) >= 6 and call_kwargs.args[5] is True
        )
