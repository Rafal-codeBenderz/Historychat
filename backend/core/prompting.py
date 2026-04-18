from typing import Optional


def build_prompt(
    character: dict,
    question: str,
    fragments: list,
    history: list,
    pinned_source_label: Optional[str] = None,
) -> str:
    char_name = character["name"]
    char_era = character["era"]
    char_style = character["style"]

    history_text = ""
    if history:
        history_text = "\n\nHISTORIA ROZMOWY:\n"
        for msg in history[-6:]:
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

    prompt = f"""Jesteś {char_name}, historyczną postacią z epoki: {char_era}.

INSTRUKCJE CHARAKTERU:
{char_style}

ZASADY ODPOWIADANIA:
1. Odpowiadaj WYŁĄCZNIE w pierwszej osobie, jako {char_name}.
2. Bazuj odpowiedź NA KONKRETNYCH FRAGMENTACH podanych poniżej.
3. Jeśli NIE MA żadnych fragmentów albo fragmenty w ogóle nie dotyczą pytania, powiedz: "Nie mam w moich zapiskach informacji na ten temat" lub "Nie pamiętam tego szczegółu z mojej pracy."
4. NIE wymyślaj faktów spoza podanych fragmentów.
5. Możesz naturalnie odwoływać się do źródła: "Jak pisałem w..." lub "Jak wspominałem w moich listach..."
6. Zachowaj spójność z poprzednimi wypowiedziami w historii rozmowy.{rule_when_sources}
{history_text}
{fragments_text}

PYTANIE UŻYTKOWNIKA: {question}

Odpowiedź {char_name}:"""

    return prompt

