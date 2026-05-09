## Architektura (v2)

Ten plik opisuje architekturę po refaktorze backendu i frontendu. Szczegóły kontraktu HTTP są w `api_contract.md`, a drzewo katalogów w `STRUKTURA.md`.

### Przegląd

```
Frontend (React + Vite)
  ├─ UI: wybór postaci, czat, fragmenty źródeł
  ├─ Integracja: /api/characters, /api/chat, /api/tts, /api/health, /api/generate-avatar
  └─ Audio: odtwarzanie TTS + analiza głośności do animacji avatara

Backend (Flask)
  ├─ API (routing): backend/api/routes.py (Blueprint)
  ├─ Core (logika domenowa): RAG, prompting, postacie
  ├─ Services (integracje): LLM, TTS
  └─ Config (ścieżki/ustawienia): backend/config/*
```

### Warstwy i odpowiedzialności

- **Frontend (`src/`)**
  - **Komponenty** renderują UI oraz wywołują logikę hooków.
  - **Hooki (`src/hooks/*`)** trzymają stan aplikacji (wybór postaci, wiadomości, loading), komunikację z API i integrację z audio.
  - **Warstwa HTTP (`src/utils/utils.ts`)** dostarcza funkcje `fetchCharacters`, `sendMessage`, `generateTTS`.

- **Backend (`backend/`)**
  - **Entrypoint aplikacji (`backend/server.py`)**:
    - ładuje `.env` z katalogu głównego projektu,
    - konfiguruje logowanie,
    - tworzy `Flask` app (fabryka `create_app`) i rejestruje blueprint API.
  - **Routing (`backend/api/routes.py`)**:
    - waliduje wejście,
    - mapuje request → core/services,
    - zwraca JSON (API kompatybilne z frontendem).
  - **Core**
    - **Postacie**: `backend/core/characters_debata_migrated.py` (konfiguracja postaci, mapowanie głosów).
    - **RAG**: `backend/core/rag_engine.py` (budowa indeksów, retrieval; fallback keyword przy braku embeddera).
    - **Prompting**: `backend/core/prompting.py` (składanie promptu z instrukcjami postaci, historią i fragmentami źródeł).
  - **Services**
    - **LLM**: `backend/services/llm.py` (wybór dostawcy: OpenAI → Gemini).
    - **TTS**: `backend/services/tts.py` (OpenAI Audio `tts-1`, feature flag `ENABLE_TTS`).
  - **Config (`backend/config/*`)**
    - ścieżki projektu i plików runtime (np. `data/`, `logs/`, `chat_history.jsonl`),
    - ustawienia RAG (parametry chunkowania, progi itp. – zależnie od konfiguracji w pliku).

### Główne przepływy

#### 1) Start aplikacji (backend)

1. `python -m backend.server` uruchamia `backend/server.py`.
2. Ładowanie `.env` z rootu projektu (`ROOT/.env`).
3. Konfiguracja logowania do `logs/retrieval.log`.
4. `create_app()` rejestruje blueprint `backend.api.routes:api`.
5. RAG engine jest inicjalizowany leniwie (pierwsze zapytania).

#### 2) Pobranie listy postaci

1. Front wywołuje `GET /api/characters`.
2. Backend zwraca tablicę postaci (w tym `voice_id` dla TTS i pola UI).

#### 3) Czat z RAG

1. Front wysyła `POST /api/chat` z:
   - `characterId`, `message`,
   - `history` (tylko `role` + `content`),
   - opcjonalnie `sourceStem` do zawężenia retrievalu.
2. Backend:
   - wykonuje retrieval w RAG (FAISS lub fallback keyword),
   - buduje prompt (styl postaci + historia + fragmenty),
   - woła LLM (OpenAI lub Gemini),
   - zapisuje historię do `data/chat_history.jsonl`,
   - zwraca `answer` + `fragments`.

#### 4) TTS

1. Front wywołuje `POST /api/tts` z `text` i opcjonalnym `voice_id`.
2. Backend:
   - jeśli `ENABLE_TTS=false` → `503`,
   - inaczej generuje audio i zwraca base64.

#### 5) Generowanie avatara (opcjonalne)

1. Front wywołuje `POST /api/generate-avatar` (best-effort, nie blokuje UI).
2. Backend:
   - jeśli `ENABLE_AVATAR_GENERATION=false` → `503`,
   - inaczej generuje obraz (DALL·E) i zapisuje do `public/avatars/<character_id>.jpg`.

### Feature flagi i środowisko

- **`ENABLE_TTS`**: `true/false` — wyłącza `/api/tts` (zwraca `503`).
- **`ENABLE_AVATAR_GENERATION`**: `true/false` — wyłącza `/api/generate-avatar` (zwraca `503`).
- **`OPENAI_API_KEY` / `GEMINI_API_KEY`**: klucze do LLM; TTS i generowanie avatara wymagają OpenAI.

### Logi i pliki runtime

- **`logs/retrieval.log`**: logi retrievalu i diagnostyki.
- **`data/chat_history.jsonl`**: historia rozmów (append-only).

### Tryb „Podróż w czasie" (TT)

Drugi nested-toggle nad istniejącymi trybami `chat` / `debate` — pełny opis produktowy w `docs/PLAN_WDROZENIE_PODROZ_W_CZASIE.md`, kontrakt HTTP w `api_contract.md`.

#### Stany UI

- **`surface`: `classic` | `timeTravel`** — najwyższy wymiar nawigacji.
  - `classic`: dotychczasowy model (`mode`: `chat` | `debate`, `Sidebar` z `ModeSwitch`).
  - `timeTravel`: w main renderowany jest `TimeTravelSection`; lista postaci po lewej **ukryta**, `ModeSwitch` (Rozmowa / Sąd) **ukryty** (debata i TT naraz są mylące).
- **URL:** synchronizacja `?mode=tt` ↔ `surface === "timeTravel"`. Powrót do `classic` przywraca ostatni `mode`.
- **`Sidebar`:** przyciski: przełączenie Podróż w czasie ↔ tryb klasyczny **oraz** (tylko w `classic`) **`ModeSwitch`**.

#### Backend — nowy moduł

- **`backend/core/time_travel.py`**: wczytanie `data/time_travel/characters.json`, dopasowanie miejsca (substring, case-insensitive), walidacja sceny (`year` w oknie postaci + dopasowanie `location`), opcjonalna heurystyka `suggest_scene` korzystająca z `public/data/scenes-catalog.json` (lustrzana kopia w `data/`).
- **`backend/core/prompting.py`**: nowa funkcja `build_prompt_time_travel` — ten sam blok fragmentów RAG co w zwykłym czacie, dodatkowo kontekst roku, miejsca, perspektywy i (opcjonalnie) „returning visitor".
- **`backend/api/routes.py`**: trzy nowe endpointy (`GET /api/characters/time-travel-meta`, `POST /api/chat/time-travel`, `POST /api/time-travel/suggest-scene`) + enrich pola `time_travel` w `GET /api/characters` (bez edycji wygenerowanego `backend/core/characters_debata_migrated.py`).

#### Frontend — nowe pliki / scalanie

- **Nowe (`src/`):** `components/TimeTravelSection.tsx` (+ `TimeTravelEraTimeline`, `TimeTravelRegionMap`, `TimeTravelAmbient`), `hooks/useTimeTravelChat.ts`, `constants/timeTravel.ts`, `utils/timeTravel*.ts`, `utils/installTimeTravelAnalytics.ts`.
- **Scalanie:** `src/types.ts` (pole `time_travel` na `Character`), `src/utils/utils.ts` (`fetchTimeTravelMeta`, `filterCharacterIdsForTimeTravel`, `suggestTimeTravelPlaces`, `sendTimeTravelMessage`, `SceneNotAllowedError`), `src/components/index.ts`, `src/App.tsx` (`surface` + `?mode=tt`), `src/components/Sidebar.tsx` (TT ↔ classic), `src/main.tsx` (analytics bridge).

#### Spójność stałych

- Limity roku / długości muszą być takie same po obu stronach: `src/constants/timeTravel.ts` ↔ stałe w `backend/api/routes.py` (`TIME_TRAVEL_YEAR_MIN/MAX`, `TIME_TRAVEL_LOCATION_MAX`, `TIME_TRAVEL_MESSAGE_MAX`). Komentarze krzyżowe „zgodnie z …".

#### Główny przepływ TT

1. Front wykrywa `?mode=tt` w URL → `surface = "timeTravel"`, `Sidebar` i lista postaci znikają.
2. `TimeTravelSection` pobiera `GET /api/characters/time-travel-meta`, filtruje postacie pasujące do (rok, miejsce) lokalnie (`filterCharacterIdsForTimeTravel`).
3. (Opcjonalnie) `POST /api/time-travel/suggest-scene` proponuje listę miejsc dla wybranego roku.
4. Po wybraniu sceny + napisaniu wiadomości: `POST /api/chat/time-travel` → backend waliduje scenę → jeśli OK woła LLM z promptem TT, jeśli nie zwraca **422 `scene_not_allowed`** (bez wywołania LLM).
5. Powrót do `classic` przywraca ostatnio aktywny `mode` (`chat` lub `debate`).

