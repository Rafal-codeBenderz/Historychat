# Plan: Debata „Sąd historyczny" — v1

Specyfikacja implementacyjna feature'a **debaty 3 postaci** w trybie sądu historycznego. Jest to dokument referencyjny dla Augmenta — kod robi Augment na gałęzi `feature/debate-court`.

## Scope v1

User wybiera **tezę + 3 postaci** z rolami (Oskarżyciel / Obrońca / Sędzia). Jedna runda = 3 tury (prosecutor → defender → judge). Po rundzie user ma trzy opcje:

- **Pogłęb** — kolejna runda (3 kolejne tury)
- **Mój głos** — wtrąca własną wypowiedź adresowaną do wybranej roli
- **Zażądaj werdyktu** — sędzia wydaje końcowe stanowisko, debata się zamyka

Role są **sztywne** przez całą debatę. Sędzia **zawsze widzi cały transkrypt** (strony też — ujednolicamy).

### Out of scope v1

- SSE / streaming tokenów
- Zamiana ról w trakcie
- Persystencja debat do pliku
- TTS dla wypowiedzi w debacie
- Więcej niż 3 postaci
- Więcej niż 1 aktywna debata naraz

## Backend

### Nowy moduł: `backend/core/debate.py`

```python
ROLE_INSTRUCTIONS = {
  "prosecutor": "Jesteś OSKARŻYCIELEM w procesie sądowym. Teza oskarżenia: „{theme}". "
                "Udowadniaj tę tezę — argumenty, retoryka, odwołania do własnych źródeł. "
                "Odnoś się do wypowiedzi obrony.",
  "defender":   "Jesteś OBROŃCĄ w procesie sądowym. Teza oskarżenia: „{theme}". "
                "Podważaj tę tezę — kontrargumenty, kontekst, luki w rozumowaniu oskarżyciela.",
  "judge":      "Jesteś SĘDZIĄ w procesie sądowym. Teza: „{theme}". "
                "Zadawaj trudne pytania, wskazuj słabości argumentacji stron. Jesteś neutralny. "
                "W trybie werdyktu — ogłoś końcowe stanowisko z uzasadnieniem.",
}

def build_debate_prompt(character, role, theme, transcript, fragments, verdict_mode=False) -> str: ...
def run_debate_turn(char_id, role, theme, transcript, verdict_mode=False) -> dict: ...
```

**Retrieval:** query = `theme + " " + ostatnie_2_wypowiedzi(transcript)`. `top_k=4`. Użyj `get_engine().retrieve(...)` z `rag_engine.py` — nie pisz nowego silnika.

**Prompt:** tożsamość postaci (name / era / bio / style z `CHARACTERS`) + `ROLE_INSTRUCTIONS[role]` + pełny transkrypt + 4 fragmenty RAG + w trybie werdyktu dopisek „Wydaj końcowy werdykt z uzasadnieniem, cytując argumenty obu stron.".

**Nie ruszaj `backend/core/prompting.py:build_prompt`** — zostaje dla zwykłego chatu.

### Endpointy w `backend/api/routes.py`

```python
@api.post("/api/debate/turn")
# Payload:
#   theme: str (<=1000 znaków)
#   roles: {prosecutor: char_id, defender: char_id, judge: char_id}  # wszystkie 3 różne
#   transcript: [{speaker, role, content, is_user}]  # <=50 wypowiedzi
#   next_role: "prosecutor" | "defender" | "judge"
# Response: {speaker, role, content, fragments}
# Walidacja: theme wymagane; wszystkie char_id w CHARACTERS; role różne;
#            next_role w dozwolonym zbiorze.

@api.post("/api/debate/verdict")
# Payload: {theme, roles, transcript}
# Response: {speaker, role: "judge", content, fragments}  # run_debate_turn(verdict_mode=True)
```

### Testy: `backend/tests/test_debate.py`

- Happy path: pusty transcript, `next_role=prosecutor` → zwraca niepusty `content`
- 400 dla: brak `theme`, nieznany `char_id`, nieprawidłowy `next_role`, duplikat postaci w rolach
- Transcript z 5 wypowiedziami: sędzia w `build_debate_prompt` dostaje wszystkie 5 (asercja na zawartości promptu)
- `/api/debate/verdict` używa `verdict_mode=True` (asercja na zawartości promptu — zawiera słowo „werdykt")

## Frontend

### `src/types.ts` — dopisz

```typescript
export type DebateRole = 'prosecutor' | 'defender' | 'judge';

export interface DebateTurn {
  speaker: string;            // char_id lub "user"
  speakerName: string;
  role: DebateRole | 'user';
  content: string;
  fragments?: Fragment[];
  timestamp: Date;
}

export interface DebateRoles {
  prosecutor: Character;
  defender: Character;
  judge: Character;
}

export interface DebateState {
  theme: string;
  roles: DebateRoles | null;
  transcript: DebateTurn[];
  roundCount: number;
  verdictIssued: boolean;
}
```

### `src/hooks/useDebate.ts` (nowy, wzorem `useChat.ts`)

Funkcje publiczne:
- `setupDebate(theme, roles)` — inicjalizacja stanu
- `runNextTurn()` — wybiera `next_role` (round-robin jeśli user się nie wtrącał; po wtrąceniu usera → adresat)
- `runRound()` — 3 tury z rzędu (dla przycisku „Pogłęb")
- `addUserTurn(content, addressedTo?: DebateRole)` — appenduje wypowiedź usera do transkryptu; `runNextTurn` zna adresata
- `requestVerdict()` — woła `/api/debate/verdict`, ustawia `verdictIssued`
- `resetDebate()`

### `src/components/DebateSection.tsx` (nowy)

**Ekran konfiguracji** (`roles === null`):
- Textarea „Teza oskarżenia" (max 500 znaków)
- 3 dropdowny: Oskarżyciel / Obrońca / Sędzia — z listy wszystkich postaci. Walidacja: wszystkie różne.
- Preset radio: `Historyczny` / `Współczesny` / `Losowy` — losuje szablon tezy + 3 postacie. Szablony inline w kodzie, ~5 sztuk per preset.
- Przycisk **Rozpocznij proces** (disabled gdy braki)

**Ekran procesu** (`roles !== null`):
- Header: 3 awatary (`CharacterAvatar`) z podpisami roli
- Transkrypt: lista `DebateTurn` renderowana jak chat, badge roli z kolorem:
  - Oskarżyciel — `#8b2635` (burgund)
  - Obrońca — `#2d5c3e` (butelkowa zieleń)
  - Sędzia — `#8b6914` (stare złoto)
  - User — neutralny (jak w chacie)
- `TypingIndicator` podczas `loading`
- Pasek akcji na dole:
  - `▶ Pogłęb` (`runRound`)
  - `✋ Mój głos` (otwiera input + dropdown adresata → `addUserTurn` + `runNextTurn`)
  - `⚖ Zażądaj werdyktu` (disabled po `verdictIssued`)
  - `↺ Nowa debata`

### `src/App.tsx` — tryb

Dodaj stan `mode: 'chat' | 'debate'`. Przełącznik segmented w `Sidebar` (nowy komponent `ModeSwitch.tsx`). Gdy `debate` → `DebateSection` zamiast pary `AvatarSection`+`ChatSection`. Zachowaj `WelcomeSection` jako placeholder dopóki role nie ustawione.

## Dokumentacja

Dopisz do `docs/api_contract.md` sekcję **„Debata (sąd historyczny)"** z payloadami i response'ami obu endpointów.

## Commit i PR

```bash
git checkout feature/debate-court
# implementacja
git add .
git commit -m "feat: add historical court debate (3-role, manual rounds)"
git push origin feature/debate-court
```

PR otwarty będzie później (po domknięciu sprawy collaborator access). Na razie pracujesz tylko na branchu `feature/debate-court` w forku `LeszekLech/Historychat`.

## Checkpointy review (co Claude sprawdza po Twoich commitach)

1. `/api/health` bez regresu; `/api/debate/turn` zwraca `content` dla każdej z 3 ról
2. Werdykt cytuje obie strony, nie jest generyczny
3. W `logs/retrieval.log` retrieval sędziego zawiera kontekst z poprzednich wypowiedzi
4. UI flow: konfiguracja → runda → pogłęb → user wtrąca → werdykt — bez błędów w konsoli
5. Kolory ról widoczne, łatwo rozróżnić kto mówi
6. Tryb `chat` dalej działa — żadnego regresu
