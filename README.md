# HistoryChat RAG 📜

> Interaktywny system czatowy z awatarami postaci historycznych, oparty na RAG (Retrieval-Augmented Generation): odpowiedzi są budowane na fragmentach z lokalnych plików `.txt` w `data/knowledge_base/`.

## Co to jest?

HistoryChat pozwala rozmawiać z **24 postaciami historycznymi** obejmującymi różne epoki i dziedziny — m.in. nauka (Kopernik, Einstein, Newton, Darwin, Tesla, Maria Skłodowska-Curie, Galileusz, Fibonacci, Lovelace), filozofia i medycyna (Arystoteles, Konfucjusz, Hipokrates, Freud), sztuka (Leonardo da Vinci, Chopin, Van Gogh, Frida Kahlo), historia i polityka (Cezar, Kleopatra, Napoleon, Joanna d'Arc, Maria Antonina, Churchill), edukacja (Montessori). Model językowy dostaje do promptu **wybrane fragmenty źródeł**; instrukcje w backendzie wymuszają trzymanie się tej treści (z możliwością odmowy, gdy fragmentów brak lub nie pasują).

Pełna lista identyfikatorów postaci (`char_id`):

```
antoinette, aristotle, caesar, chopin, churchill, cleopatra, confucius,
copernicus, da_vinci, darwin, einstein, fibonacci, freud, galileo,
hippocrates, joan_of_arc, kahlo, lovelace, marie_curie, montessori,
napoleon, newton, tesla, vangogh
```

## Funkcje (v2)

- **Text-to-Speech (TTS)** — odczyt odpowiedzi (OpenAI `tts-1`, sterowane flagą `ENABLE_TTS`)
- **Awatary** — domyślnie Reactowy komponent `Avatar.tsx` (gradient + ikona Lucide + animacja Framer Motion przy odtwarzaniu audio); opcjonalne generowanie obrazów przez **OpenAI DALL-E 3** (sterowane flagą `ENABLE_AVATAR_GENERATION`).
- **24 postaci** z różnych epok (patrz sekcja *Co to jest?*) i **sugerowane tematy** (z opcjonalnym `sourceStem` dla węższego retrievalu)
- **UI** — React, Framer Motion, style m.in. z Tailwind (`index.css`)

## Dokumentacja

- `docs/ARCHITEKTURA.md` — opis architektury po refaktorze (warstwy, przepływy)
- `docs/STRUKTURA.md` — aktualna struktura katalogów (drzewo + odpowiedzialności)
- `docs/api_contract.md` — kontrakt API (frontend ↔ backend)
- `docs/REFAKTORYZACJA_PLAN_v2.md` — plan refaktoryzacji (notatki techniczne)

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

Pełna, krok-po-kroku instrukcja instalacji i startu znajduje się w osobnym pliku: **[`URUCHOMIENIE.md`](URUCHOMIENIE.md)**.

**TL;DR:**

```bash
pip install -r requirements.txt
npm install
cp .env.example .env     # Windows: Copy-Item .env.example .env
# uzupełnij OPENAI_API_KEY w .env
npm run start            # backend (:8000) + frontend (:3000)
```

Wymagania: Python 3.10+, Node.js 18+.

## Klucze API i feature flagi

| Zmienna | Rola |
|--------|------|
| `OPENAI_API_KEY` | Jeśli ustawione — **czat** idzie przez OpenAI (`OPENAI_CHAT_MODEL`, domyślnie `gpt-4o-mini`). **TTS** wymaga tego klucza. |
| `GEMINI_API_KEY` | Używane **tylko gdy brak** `OPENAI_API_KEY` — czat przez Gemini 2.0 Flash. |
| `OPENAI_CHAT_MODEL` | Opcjonalnie inny model czatu OpenAI. |
| `ENABLE_TTS` | `true/false` — gdy `false`, endpoint `/api/tts` zwraca `503`. |
| `ENABLE_AVATAR_GENERATION` | `true/false` — gdy `false`, endpoint `/api/generate-avatar` (DALL-E 3) zwraca `503`. |

Plik `.env` szukany jest w **katalogu głównym projektu** (obok `.env.example`).

## Testy

Z katalogu głównego projektu (po `pip install -r requirements.txt`):

```bash
pytest
```

To uruchamia testy z `backend/tests/` (ustawione w `pytest.ini`, root repo na `pythonpath` — bez ręcznego `PYTHONPATH`). Możesz też podać ścieżkę wprost:

```bash
pytest backend/tests/
```

## Struktura projektu

```
<katalog-projektu>/
├── pytest.ini                # konfiguracja pytest (pythonpath, testpaths)
├── docs/
│   ├── ARCHITEKTURA.md
│   ├── STRUKTURA.md
│   ├── api_contract.md
│   └── REFAKTORYZACJA_PLAN_v2.md
├── backend/
│   ├── api/                   # routing Flask (endpoints)
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
| Grafika / Awatary | React (komponent `Avatar.tsx`): gradient + ikona Lucide + animacja Framer Motion. Opcjonalnie generowanie obrazów przez OpenAI DALL-E 3 (za flagą `ENABLE_AVATAR_GENERATION`). Bez Stable Diffusion. |

## Cele jakości (projektowe)

- Odpowiedzi oparte na **przekazanych do modelu** fragmentach źródeł, ze śledzeniem źródeł w UI
- Score podobieństwa przy fragmentach (FAISS) lub heurystyka w trybie słów
- Historia w JSONL i log retrievalu
- Jawna zasada odmowy, gdy brak treści w bazie lub brak związku z pytaniem
- TTS i sugerowane tematy per postać
