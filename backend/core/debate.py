"""
Moduł debaty „Sąd historyczny" — build_debate_prompt + run_debate_turn.
NIE modyfikuje backend/core/prompting.py:build_prompt.
"""
from __future__ import annotations

import logging
from typing import Any

from backend.core.characters_debata_migrated import CHARACTERS
from backend.core.rag_engine import get_engine
from backend.services.llm import call_llm

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Instrukcje ról
# ---------------------------------------------------------------------------
ROLE_INSTRUCTIONS: dict[str, str] = {
    "prosecutor": (
        "Pe\u0142nisz rol\u0119 OSKAR\u017bYCIELA w procesie s\u0105dowym. "
        "Teza oskar\u017cenia: '{theme}'. "
        "Udowadniaj t\u0119 tez\u0119 - u\u017cywaj argument\u00f3w, retoryki i odwo\u0142a\u0144 do w\u0142asnych dokona\u0144. "
        "Odpieraj argumenty obrony. B\u0105d\u017a stanowczy."
    ),
    "defender": (
        "Pe\u0142nisz rol\u0119 OBRO\u0143CY w procesie s\u0105dowym. "
        "Teza oskar\u017cenia: '{theme}'. "
        "Podwa\u017caj t\u0119 tez\u0119 - kontrargumenty, kontekst historyczny, "
        "luki w rozumowaniu oskar\u017cycela. B\u0105d\u017a precyzyjny."
    ),
    "judge": (
        "Pe\u0142nisz rol\u0119 S\u0118DZIEGO w procesie s\u0105dowym. "
        "Teza: '{theme}'. "
        "Zadawaj trudne pytania obu stronom, wskazuj s\u0142abo\u015bci argumentacji. "
        "Jeste\u015b neutralny i bezstronny."
    ),
}

VERDICT_SUFFIX = (
    "\n\nJeste\u015b teraz w trybie WERDYKTU. "
    "Wydaj ko\u0144cowy werdykt z uzasadnieniem - oce\u0144 argumenty obu stron "
    "i og\u0142o\u015b swoje stanowisko jako s\u0119dzia. B\u0105d\u017a konkretny i autorytatywny."
)


# ---------------------------------------------------------------------------
# Budowanie promptu debaty
# ---------------------------------------------------------------------------
def build_debate_prompt(
    character: dict[str, Any],
    role: str,
    theme: str,
    transcript: list[dict[str, Any]],
    fragments: list[dict[str, Any]],
    verdict_mode: bool = False,
) -> str:
    name = character.get("name", "Postać")
    era = character.get("era", "")
    bio = character.get("bio", "")
    style = character.get("char_style", "")

    role_instruction = ROLE_INSTRUCTIONS[role].format(theme=theme)
    if verdict_mode:
        role_instruction += VERDICT_SUFFIX

    lines: list[str] = [
        f"Jesteś {name} ({era})." if era else f"Jesteś {name}.",
    ]
    if bio:
        lines.append(bio)
    if style:
        lines.append(f"Twój styl wypowiedzi: {style}")
    lines.append("")
    lines.append(role_instruction)

    if fragments:
        lines.append("\n=== TWOJE ŹRÓDŁA (fragmenty z archiwum) ===")
        for i, frag in enumerate(fragments, 1):
            source = frag.get("source", "?")
            text = frag.get("text", "").strip()
            lines.append(f"[Fragment {i} – {source}]\n{text}")

    if transcript:
        lines.append("\n=== TRANSKRYPT DEBATY ===")
        for turn in transcript:
            speaker_name = turn.get("speakerName", turn.get("speaker", "?"))
            turn_role = turn.get("role", "")
            content = turn.get("content", "")
            lines.append(f"[{speaker_name} – {turn_role.upper()}]: {content}")

    lines.append(
        "\nOdpowiedz teraz jako ta postać, w 1. osobie, zgodnie ze swoją rolą. "
        "Bądź konkretny i odnoś się bezpośrednio do transkryptu."
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Uruchomienie jednej tury debaty
# ---------------------------------------------------------------------------
def run_debate_turn(
    char_id: str,
    role: str,
    theme: str,
    transcript: list[dict[str, Any]],
    verdict_mode: bool = False,
) -> dict[str, Any]:
    character = CHARACTERS[char_id]
    engine = get_engine()

    # Query = theme + ostatnie 2 wypowiedzi — lepszy kontekst dla retrieval
    last_2 = " ".join(t.get("content", "") for t in transcript[-2:])
    query = f"{theme} {last_2}".strip()

    fragments: list[dict[str, Any]] = engine.retrieve(char_id, query, top_k=4)

    logger.info(
        "[debate] char=%s role=%s verdict=%s fragments=%d",
        char_id, role, verdict_mode, len(fragments),
    )

    prompt = build_debate_prompt(
        character=character,
        role=role,
        theme=theme,
        transcript=transcript,
        fragments=fragments,
        verdict_mode=verdict_mode,
    )

    content: str = call_llm(prompt)

    return {
        "speaker": char_id,
        "speakerName": character.get("name", char_id),
        "role": role,
        "content": content,
        "fragments": fragments,
    }
