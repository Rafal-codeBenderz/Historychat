# HistoryChat RAG 📜

> Interaktywny system czatowy z awatarami postaci historycznych, oparty na RAG (Retrieval-Augmented Generation): odpowiedzi są budowane na fragmentach z lokalnych plików `.txt` w `data/knowledge_base/`.

## Co to jest?

HistoryChat pozwala rozmawiać z postaciami historycznymi (m.in. Kopernik, Maria Skłodowska-Curie, Napoleon, Leonardo da Vinci, Kleopatra, Einstein, Joanna d’Arc). Model językowy dostaje do promptu **wybrane fragmenty źródeł**; instrukcje w backendzie wymuszają trzymanie się tej treści (z możliwością odmowy, gdy fragmentów brak lub nie pasują).

## Funkcje (v2)

- **Text-to-Speech (TTS)** — odczyt odpowiedzi (OpenAI `tts-1`, sterowane flagą `ENABLE_TTS`)
- **Awatary** — placeholdery z ikoną / gradientem i animacją przy odtwarzaniu audio + opcjonalne generowanie obrazów (sterowane flagą `ENABLE_AVATAR_GENERATION`)
- **7 postaci** i **sugerowane tematy** (z opcjonalnym `sourceStem` dla węższego retrievalu)
- **UI** — React, Framer Motion, style m.in. z Tailwind (`index.css`)

## Dokumentacja

- `docs/ARCHITEKTURA.md` — opis architektury po refaktorze (warstwy, przepływy)
- `docs/STRUKTURA.md` — aktualna struktura katalogów (drzewo + odpowiedzialności)
- `docs/api_contract.md` — kontrakt API (frontend ↔ backend)
- `docs/KNOWLEDGE_BASE_PROVENANCE.md` — pochodzenie/licencje treści w `data/knowledge_base/`

## Architektura

```
┌─────────────────────────────────────────────────────┐
│                 FRONTEND (React + Vite)               │
│  Wybór postaci → Czat → Źródła (fragmenty RAG)       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (domyślnie :8000)
┌──────────────────────▼──────────────────────────────┐
│                 BACKEND (Flask + Python)             │
│                                                      │
│  1. RAG Engine                                       │
│     ├── sentence-transformers (embeddingi, lokalnie) │
│     ├── FAISS (IndexFlatIP + normalizacja L2)        │
│     └── Tryb zapasowy: dopasowanie słów (bez ST)      │
│                                                      │
│  2. LLM (generowanie odpowiedzi)                     │
│     ├── pierwszeństwo: OpenAI Chat (domyślnie        │
│     │   gpt-4o-mini), zmienna OPENAI_CHAT_MODEL      │
│     └── w przeciwnym razie: Gemini 2.0 Flash         │
│     Prompt: fragmenty + historia + instrukcje postaci│
│                                                      │
│  3. TTS — OpenAI Audio API (wymaga OPENAI_API_KEY)   │
│                                                      │
│  4. Logi                                             │
│     ├── data/chat_history.jsonl                      │
│     └── logs/retrieval.log                           │
└──────────────────────────────────────────────────────┘
```

**Ważne:** sam RAG (indeks, wyszukiwanie) **nie wymaga** klucza Google ani OpenAI — działa lokalnie. Klucz jest potrzebny do **wygenerowania** tekstu odpowiedzi i (osobno) do **TTS**.

## Uruchomienie

### Wymagania

- Python 3.10+
- Node.js 18+

### Backend

Z katalogu **głównego projektu** (tam gdzie leżą `package.json`, `data/`, `backend/`):

```bash
pip install -r requirements.txt
```

Skopiuj konfigurację (Linux/macOS):

```bash
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Uzupełnij `.env` — zobacz sekcję [Klucze API](#klucze-api) poniżej.

```bash
python -m backend.server
```

Backend: `http://localhost:8000`. Ścieżki `data/` i `logs/` są liczone względem katalogu projektu (`ROOT` w `backend/config/paths.py`), więc uruchamiaj polecenie z rootu projektu.

Przy starcie ładowane są pliki `.txt` z `data/knowledge_base/<id_postaci>/` i — gdy działa embedder — budowany jest indeks FAISS.

### Frontend

```bash
npm install
npm run dev
```

Aplikacja dev: `http://localhost:3000` (host `0.0.0.0` — możliwy dostęp z sieci lokalnej).

Domyślnie frontend woła API pod `http://localhost:8000`. Możesz nadpisać zmienną **`VITE_API_URL`** (np. inny host/port). W `vite.config.ts` jest proxy `/api` → `localhost:8000` (przydatne, jeśli front woła względne ścieżki `/api`).

### Produkcja: CORS

Backend używa `Flask-CORS`. Domyślnie (dev) CORS jest **otwarty**. Jeśli wystawiasz backend publicznie, ustaw `CORS_ORIGINS` w `.env` jako listę originów rozdzielaną przecinkami, np.:

`CORS_ORIGINS=https://twoja-domena.pl,https://staging.twoja-domena.pl`

### Backend + frontend naraz

```bash
npm run start
```

## Klucze API i feature flagi

| Zmienna | Rola |
|--------|------|
| `OPENAI_API_KEY` | Jeśli ustawione — **czat** idzie przez OpenAI (`OPENAI_CHAT_MODEL`, domyślnie `gpt-4o-mini`). **TTS** wymaga tego klucza. |
| `GEMINI_API_KEY` | Używane **tylko gdy brak** `OPENAI_API_KEY` — czat przez Gemini 2.0 Flash. |
| `OPENAI_CHAT_MODEL` | Opcjonalnie inny model czatu OpenAI. |
| `ENABLE_TTS` | `true/false` — gdy `false`, endpoint `/api/tts` zwraca `503`. |
| `ENABLE_AVATAR_GENERATION` | `true/false` — gdy `false`, endpoint `/api/generate-avatar` zwraca `503`. |
| `ENABLE_CHAT_HISTORY` | `true/false` — gdy `false`, backend **nie zapisuje** rozmów do `data/chat_history.jsonl`. |
| `BACKEND_PORT` | Port serwera Flask przy `python -m backend.server` (domyślnie `8000`). |
| `LLM_RETRY_ATTEMPTS` | Liczba prób z backoffem przy błędach tymczasowych LLM (np. 429). |
| `TTS_RETRY_ATTEMPTS` | To samo dla TTS. |
| `OPENAI_HTTP_TIMEOUT` | Timeout (sekundy) dla czatu OpenAI (domyślnie `60`). |
| `GEMINI_HTTP_TIMEOUT` | Timeout (sekundy) dla czatu Gemini (domyślnie `60`). |
| `TTS_HTTP_TIMEOUT` | Timeout (sekundy) dla wywołań TTS OpenAI (domyślnie `60`). |
| `APP_VERSION` | Opcjonalnie: string widoczny w `GET /api/health` (domyślnie `dev`). |

Plik `.env` szukany jest w **katalogu głównym projektu** (obok `.env.example`).

## Dane i prywatność

- Backend może zapisywać **pełną treść wiadomości** użytkownika i asystenta do pliku `data/chat_history.jsonl` (domyślnie **wyłączone**: `ENABLE_CHAT_HISTORY=false`). Ścieżka runtime, nie jest commitowana — wpis w `.gitignore`. Aby **włączyć zapis**, ustaw `ENABLE_CHAT_HISTORY=true` w `.env`. Aby **wyczyścić historię lokalnie**, zatrzymaj backend i usuń ten plik.
- Logi retrievalu trafiają do `logs/retrieval.log`; w kodzie RAG oraz w ostrzeżeniach `/api/chat` unika się logowania surowej treści zapytań — używane są m.in. długość i **fingerprint** (skrót hash), nie jawny tekst wiadomości.
- Przy udostępnianiu aplikacji poza komputerem lokalnym warto rozważyć rotację lub `ENABLE_CHAT_HISTORY=false` oraz politykę retencji danych.

Checklista przed PR / oddaniem: [docs/checklista_przed_oddaniem.md](docs/checklista_przed_oddaniem.md).

## Testy

```bash
pytest backend/tests/
```

## Struktura projektu

```
<katalog-projektu>/
├── docs/
│   ├── ARCHITEKTURA.md
│   ├── STRUKTURA.md
│   ├── api_contract.md
│   └── checklista_przed_oddaniem.md
├── backend/
│   ├── api/                   # Blueprint: chat, health, historia, TTS, avatar (routes.py = re-eksport)
│   ├── config/                # ścieżki i konfiguracja
│   ├── core/                  # RAG + prompting + characters
│   ├── services/              # LLM/TTS (logika bez Flask)
│   ├── tests/                 # pytest baseline
│   └── server.py              # entrypoint Flask (create_app + blueprint)
├── data/
│   ├── knowledge_base/        # Źródła: wyłącznie .txt (PDF nie są czytane automatycznie)
│   │   ├── copernicus/
│   │   ├── marie_curie/
│   │   ├── napoleon/
│   │   ├── da_vinci/
│   │   ├── cleopatra/
│   │   ├── einstein/
│   │   └── joan_of_arc/
│   └── chat_history.jsonl     # Runtime
├── logs/
│   └── retrieval.log          # Runtime
├── src/
│   ├── App.tsx
│   ├── hooks/
│   ├── main.tsx
│   ├── types.ts
│   ├── index.css              # Tailwind directives
│   └── components/
│       └── Avatar.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── requirements.txt
├── .env.example
└── README.md
```

## Diagnostyka

`GET http://localhost:8000/api/health` zwraca m.in.:

- `rag_mode`: `faiss` | `keyword` | `off`
- `chunks_loaded` — postacie z załadowanymi fragmentami
- `embedder_loaded` — czy działa sentence-transformers
- `kb_path` / `kb_exists` — ścieżka do bazy wiedzy
- `app_version` — wartość z `APP_VERSION` w `.env` (domyślnie `dev`)

## Jak dodać nową postać?

1. Folder `data/knowledge_base/<id_postaci>/`
2. Pliki `.txt` z treścią źródeł
3. Konfiguracja postaci jest generowana w `backend/core/characters_debata_migrated.py` (patrz nagłówek pliku; regeneracja przez `python scripts/regen_characters_module.py`)
4. Upewnij się, że postać ma `voice_id` (backend wylicza je z `voiceName` + `VOICE_MAP`)
5. Restart backendu

## Jak działa RAG?

1. **Indeksowanie:** każdy `.txt` jest dzielony na chunki (~300 słów, nakładanie ~50). Jeśli embedder działa, fragmenty są kodowane modelem `paraphrase-multilingual-MiniLM-L12-v2` (384 wymiary) i dodawane do FAISS. Jeśli embeddera brak, chunki zostają w pamięci i retrieval używa **dopasowania słów** (zapasowy tryb).

2. **Retrieval:** domyślnie do 4 fragmentów; wyszukiwanie szersze niż `top_k`, potem preferowane są wyniki z podobieństwem powyżej progu; **gdy żaden nie przekracza progu**, brane są najlepsi kandydaci (best-effort). Przy wybranym temacie z `sourceStem` można zawęzić wyniki do jednego pliku źródłowego.

3. **Generowanie:** fragmenty + historia + styl postaci trafiają do promptu; odpowiedź generuje OpenAI lub Gemini — zależnie od dostępnych kluczy.

4. **Logi:** szczegóły retrievalu w `logs/retrieval.log`.

## Windows / conda — TensorFlow i embedder

Backend na starcie ustawia m.in. `USE_TORCH=1` i `TRANSFORMERS_NO_TF=1`, żeby **transformers** nie ładował TensorFlow (częsty błąd DLL). Jeśli nadal widzisz problemy z importem:

```bash
pip uninstall -y tensorflow tensorflow-intel tensorboard
```

## Stack technologiczny

| Warstwa | Technologia |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite, Framer Motion, Lucide, Tailwind (CSS) |
| Backend | Python, Flask, Flask-CORS, python-dotenv |
| Embeddingi | sentence-transformers, PyTorch (CPU) |
| Wektory | faiss-cpu |
| LLM (czat) | OpenAI Chat API **lub** Google Gemini 2.0 Flash |
| TTS | OpenAI Audio (`tts-1`) |
| Awatar UI | Gradient + ikona, animacja przy audio (bez DALL-E w kodzie) |

## Cele jakości (projektowe)

- Odpowiedzi oparte na **przekazanych do modelu** fragmentach źródeł, ze śledzeniem źródeł w UI
- Score podobieństwa przy fragmentach (FAISS) lub heurystyka w trybie słów
- Historia w JSONL i log retrievalu
- Jawna zasada odmowy, gdy brak treści w bazie lub brak związku z pytaniem
- TTS i sugerowane tematy per postać
