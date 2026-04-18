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
        "Teza oskar\u017cenia: '{theme}'.\n"
        "Twoje zadanie:\n"
        "1. Je\u015bli to twoja PIERWSZA wypowied\u017a \u2014 wyg\u0142o\u015b kr\u00f3tkie, mocne oskar\u017cenie (3-5 zda\u0144) "
        "udowadniaj\u0105ce tez\u0119. Powo\u0142aj si\u0119 na konkretne fakty z TWOICH \u0179R\u00d3DE\u0141.\n"
        "2. Je\u015bli obro\u0144ca ju\u017c m\u00f3wi\u0142 \u2014 KONKRETNIE odpowiedz na jego ostatnie kontrargumenty. "
        "Zacytuj co powiedzia\u0142 i obali to. Zadaj mu trudne pytanie.\n"
        "3. Je\u015bli s\u0119dzia zada\u0142 pytanie \u2014 odpowiedz bezpo\u015brednio na nie, z perspektywy oskar\u017cyciela.\n"
        "B\u0105d\u017a stanowczy, retoryczny, zwracaj si\u0119 do obro\u0144cy w 2. osobie ('Pan twierdzi, \u017ce...')."
    ),
    "defender": (
        "Pe\u0142nisz rol\u0119 OBRO\u0143CY w procesie s\u0105dowym. "
        "Teza oskar\u017cenia: '{theme}'.\n"
        "Twoje zadanie:\n"
        "1. Je\u015bli oskar\u017cyciel w\u0142a\u015bnie m\u00f3wi\u0142 \u2014 KONKRETNIE odpowiedz na jego zarzuty. "
        "Zacytuj co powiedzia\u0142 i podwa\u017c to (kontekst historyczny, luki logiczne, fakty z TWOICH \u0179R\u00d3DE\u0141).\n"
        "2. Zadaj oskar\u017cycielowi pytanie, na kt\u00f3re trudno mu odpowiedzie\u0107.\n"
        "3. Je\u015bli s\u0119dzia zada\u0142 pytanie \u2014 odpowiedz bezpo\u015brednio, bron\u0105c swojego stanowiska.\n"
        "B\u0105d\u017a precyzyjny, zwracaj si\u0119 do oskar\u017cyciela w 2. osobie."
    ),
    "judge": (
        "Pe\u0142nisz rol\u0119 S\u0118DZIEGO w procesie s\u0105dowym. "
        "Teza: '{theme}'.\n"
        "NIE wydawaj jeszcze werdyktu. Twoje zadanie TERAZ:\n"
        "1. Kr\u00f3tko (1 zdanie) podsumuj dotychczasowy sp\u00f3r.\n"
        "2. Zadaj JEDNO konkretne, trudne pytanie OSKAR\u017bYCIELOWI (zaadresuj imieniem).\n"
        "3. Zadaj JEDNO konkretne, trudne pytanie OBRO\u0143CY (zaadresuj imieniem).\n"
        "Wska\u017c w pytaniach s\u0142abo\u015b\u0107 argumentacji ka\u017cdej strony. B\u0105d\u017a neutralny, dociekliwy, kr\u00f3tki."
    ),
}

VERDICT_SUFFIX = (
    "\n\nJeste\u015b teraz w trybie WERDYKTU KO\u0143COWEGO. "
    "Zignoruj poprzednie instrukcje o zadawaniu pyta\u0144. "
    "Wydaj ko\u0144cowy werdykt:\n"
    "1. Kr\u00f3tko podsumuj kluczowe argumenty obu stron (po 1-2 zdania).\n"
    "2. Oce\u0144, kt\u00f3ra strona by\u0142a bardziej przekonuj\u0105ca i dlaczego (konkretnie).\n"
    "3. Og\u0142o\u015b stanowisko: czy teza '{{theme}}' zosta\u0142a udowodniona, cz\u0119\u015bciowo, czy obalona.\n"
    "B\u0105d\u017a autorytatywny, konkretny, 4-6 zda\u0144 \u0142\u0105cznie."
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
        role_instruction += VERDICT_SUFFIX.format(theme=theme)

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
            lines.append(f"[{speaker_name} \u2013 {turn_role.upper()}]: {content}")

        # 3c: wyróżnij ostatnią wypowiedź przeciwnika — na co mam odpowiedzieć
        last_turn = transcript[-1]
        last_role = last_turn.get("role", "")
        last_speaker = last_turn.get("speakerName", "?")
        if last_role != role:
            lines.append(
                f"\n>>> OSTATNIA WYPOWIED\u017a, DO KT\u00d3REJ MUSISZ SI\u0118 ODNIE\u015a\u0106: "
                f"{last_speaker} ({last_role.upper()}) <<<"
            )

    lines.append(
        "\nOdpowiedz teraz jako ta posta\u0107, w 1. osobie, zgodnie ze swoj\u0105 rol\u0105. "
        "B\u0105d\u017a konkretny i odnie\u015b si\u0119 bezpo\u015brednio do transkryptu."
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
