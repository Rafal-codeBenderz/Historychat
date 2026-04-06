## Architektura (v2)

Ten plik opisuje architekturę po refaktorze backendu i frontendu. Szczegóły kontraktu HTTP są w `api_contract.md`, a drzewo katalogów w `STRUKTURA.md`.

### Przegląd

```
Frontend (React + Vite)
  ├─ UI: wybór postaci, czat, fragmenty źródeł
  ├─ Integracja: /api/characters, /api/chat, /api/tts, /api/health, /api/generate-avatar
  └─ Audio: odtwarzanie TTS + analiza głośności do animacji avatara

Backend (Flask)
  ├─ API (routing): pakiet `backend/api/` (Blueprint `api`, m.in. `chat.py`, `health_route.py`; `routes.py` tylko re-eksport)
  ├─ Core (logika domenowa): RAG, prompting, postacie
  ├─ Services (integracje): LLM, TTS, `retry_utils.py` (wspólny retry/backoff)
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
  - **Routing (`backend/api/*`)**:
    - moduły per obszar (czat, historia, TTS, health, avatar),
    - wspólny bootstrap (`before_app_request`, zapis historii),
    - zwraca JSON (API kompatybilne z frontendem).
  - **Core**
    - **Postacie**: `backend/core/characters.py` → dane z wygenerowanego `characters_debata_migrated.py` (mapowanie głosów, tematy).
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
4. `create_app()` rejestruje blueprint `backend.api:api`.
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

