# HistoryChat RAG 📜

> Interaktywny system czatowy z awatarami postaci historycznych, oparty na RAG (Retrieval-Augmented Generation): odpowiedzi są budowane na fragmentach z lokalnych plików `.txt` w `data/knowledge_base/`.

## Co to jest?

HistoryChat pozwala rozmawiać z postaciami historycznymi (m.in. Kopernik, Maria Skłodowska-Curie, Napoleon, Leonardo da Vinci, Kleopatra, Einstein, Joanna d’Arc). Model językowy dostaje do promptu **wybrane fragmenty źródeł**; instrukcje w backendzie wymuszają trzymanie się tej treści (z możliwością odmowy, gdy fragmentów brak lub nie pasują).

## Funkcje (v2)

- **Text-to-Speech (TTS)** — odczyt odpowiedzi (OpenAI `tts-1`)
- **Awatary** — placeholdery z ikoną / gradientem i animacją przy odtwarzaniu audio (bez generowania obrazów AI w repozytorium)
- **7 postaci** i **sugerowane tematy** (z opcjonalnym `sourceStem` dla węższego retrievalu)
- **UI** — React, Framer Motion, style m.in. z Tailwind (`index.css`)

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
python backend/server.py
```

Backend: `http://localhost:8000`. Ścieżki `data/` i `logs/` są liczone względem katalogu projektu (`Path` od `backend/server.py`), więc **nie musisz** ustawiać `cd` na `backend/`, byle uruchamiać polecenie z rootu projektu.

Przy starcie ładowane są pliki `.txt` z `data/knowledge_base/<id_postaci>/` i — gdy działa embedder — budowany jest indeks FAISS.

### Frontend

```bash
npm install
npm run dev
```

Aplikacja dev: `http://localhost:3000` (host `0.0.0.0` — możliwy dostęp z sieci lokalnej).

Domyślnie frontend woła API pod `http://localhost:8000`. Możesz nadpisać zmienną **`VITE_API_URL`** (np. inny host/port). W `vite.config.ts` jest proxy `/api` → `localhost:8000` (przydatne, jeśli front woła względne ścieżki `/api`).

### Backend + frontend naraz

```bash
npm run start
```

## Klucze API

| Zmienna | Rola |
|--------|------|
| `OPENAI_API_KEY` | Jeśli ustawione — **czat** idzie przez OpenAI (`OPENAI_CHAT_MODEL`, domyślnie `gpt-4o-mini`). **TTS** wymaga tego klucza. |
| `GEMINI_API_KEY` | Używane **tylko gdy brak** `OPENAI_API_KEY` — czat przez Gemini 2.0 Flash. |
| `OPENAI_CHAT_MODEL` | Opcjonalnie inny model czatu OpenAI. |

Plik `.env` szukany jest w **katalogu głównym projektu** (obok `.env.example`).

## Struktura projektu

```
<katalog-projektu>/
├── backend/
│   └── server.py              # Flask, RAG, LLM, TTS
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

## Jak dodać nową postać?

1. Folder `data/knowledge_base/<id_postaci>/`
2. Pliki `.txt` z treścią źródeł
3. Wpis w słowniku `CHARACTERS` w `backend/server.py` (opcjonalnie `suggestedTopics` z `sourceStem` zgodnym z nazwą pliku bez `.txt`)
4. Restart backendu

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
