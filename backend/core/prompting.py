from typing import Optional, Tuple

# Spojnie z trybem klasycznym i trybem podrozy w czasie (build_prompt_time_travel -> build_prompt).
HISTORY_RECENT_MESSAGES = 6


def build_prompt(
    character: dict,
    question: str,
    fragments: list,
    history: list,
    pinned_source_label: Optional[str] = None,
    time_travel: Optional[Tuple[int, str]] = None,
    returning_visitor: bool = False,
) -> str:
    char_name = character["name"]
    char_era = character["era"]
    char_style = character["style"]

    history_text = ""
    if history:
        history_text = "\n\nHISTORIA ROZMOWY:\n"
        for msg in history[-HISTORY_RECENT_MESSAGES:]:
            role_label = "Użytkownik" if msg.get("role") == "user" else char_name
            history_text += f"{role_label}: {msg.get('content','')}\n"

    rule_when_sources = ""
    if fragments:
        fragments_text = "\n\nDOSTĘPNE ŹRÓDŁA (użyj ich jako podstawy odpowiedzi):\n"
        if pinned_source_label:
            fragments_text += (
                f"\n(Użytkownik wybrał temat powiązany z dziełem / zapisami: „{pinned_source_label}”. "
                "Traktuj poniższe fragmenty jako właściwe źródło do tego pytania.)\n"
            )
        for i, frag in enumerate(fragments, 1):
            fragments_text += f"\n[Fragment {i} – {frag['source']}]\n{frag['text']}\n"
        rule_when_sources = (
            "\n7. Poniżej masz co najmniej jeden fragment źródłowy — NIE używaj wtedy frazy o braku zapisków. "
            "Odpowiedz na podstawie tego, co da się wyczytać z fragmentów (nawet ogólnie lub częściowo). "
            "Formułę o braku informacji stosuj WYŁĄCZNIE gdy fragmenty naprawdę nie dotyczą pytania.\n"
        )
    else:
        fragments_text = "\n\nUWAGA: Brak pasujących fragmentów w bazie wiedzy dla tego pytania."

    time_travel_block = ""
    time_travel_rules = ""
    if time_travel is not None:
        ty, tloc = time_travel
        time_travel_block = (
            "\nTRYB PODRÓŻY W CZASIE — KONTEKST CZASOPRZESTRZENNY:\n"
            f"Użytkownik ustawił scenę rozmowy: rok {ty}, miejsce (orientacyjnie): {tloc}.\n"
            "Osadź wypowiedź w tej ramie: możesz opisywać atmosferę epoki i miejsca zgodnie z fragmentami i swoją personą.\n"
            "Nie twierdź na siłę, że na pewno przebywasz dokładnie w podanym punkcie geograficznym, jeśli źródła "
            "tego nie potwierdzają — stosuj formy „w moich czasach…”, „ze znanych mi relacji…”.\n"
        )
        if returning_visitor:
            time_travel_block += (
                "\nPOWRÓT DO TEJ SAMEJ SCENY (mechanika aplikacji, nie fakt historyczny):\n"
                "Aplikacja sygnalizuje, że użytkownik ponownie uruchomił tę samą parę rok/miejsce w sesji.\n"
                "Możesz delikatnie nawiązać („Znowu jesteś w tej ramie rozmowy”) WYŁĄCZNIE jako element gry.\n"
                "NIE twierdź, że pamiętasz prawdziwą osobę użytkownika z przeszłości historycznej.\n"
            )
        time_travel_rules = (
            f"\n8. TRYB PODRÓŻY: Nie znasz wydarzeń ani „przyszłości” po roku {ty} — "
            "nie przewiduj, nie cytuj późniejszych dat, nie odwołuj się do faktów z późniejszych lat.\n"
        )

    prompt = f"""Jesteś {char_name}, historyczną postacią z epoki: {char_era}.
{time_travel_block}

INSTRUKCJE CHARAKTERU:
{char_style}

ZASADY ODPOWIADANIA:
1. Odpowiadaj WYŁĄCZNIE w pierwszej osobie, jako {char_name}.
2. Bazuj odpowiedź NA KONKRETNYCH FRAGMENTACH podanych poniżej.
3. Jeśli NIE MA żadnych fragmentów albo fragmenty w ogóle nie dotyczą pytania, powiedz: "Nie mam w moich zapiskach informacji na ten temat" lub "Nie pamiętam tego szczegółu z mojej pracy."
4. NIE wymyślaj faktów spoza podanych fragmentów.
5. Możesz naturalnie odwoływać się do źródła: "Jak pisałem w..." lub "Jak wspominałem w moich listach..."
6. Zachowaj spójność z poprzednimi wypowiedziami w historii rozmowy.{rule_when_sources}{time_travel_rules}
{history_text}
{fragments_text}

PYTANIE UŻYTKOWNIKA: {question}

Odpowiedź {char_name}:"""

    return prompt


def build_prompt_time_travel(
    character: dict,
    question: str,
    fragments: list,
    history: list,
    year: int,
    location: str,
    pinned_source_label: Optional[str] = None,
    returning_visitor: bool = False,
) -> str:
    """Prompt jak `build_prompt`, z dodatkowym kontekstem roku i miejsca (tryb podrozy w czasie)."""
    return build_prompt(
        character,
        question,
        fragments,
        history,
        pinned_source_label=pinned_source_label,
        time_travel=(year, location.strip() or "nieokreslone"),
        returning_visitor=returning_visitor,
    )

