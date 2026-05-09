## Struktura projektu (v2)

Ten plik opisuje strukturę katalogów po refaktorze. Opis architektury jest w `ARCHITEKTURA.md`, a kontrakt HTTP w `api_contract.md`.

### Drzewo katalogów (skrót)

```
<root>/
├── backend/
│   ├── __init__.py
│   ├── server.py                  # entrypoint Flask (create_app + blueprint)
│   ├── api/
│   │   └── routes.py              # endpoints /api/*
│   ├── config/
│   │   ├── __init__.py
│   │   ├── paths.py               # ROOT, DATA_DIR, LOGS_DIR, KB_PATH, CHAT_HISTORY_PATH...
│   │   └── rag_config.py          # parametry RAG (jeśli używane)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── characters_debata_migrated.py  # konfiguracja postaci + mapy głosów
│   │   ├── time_travel.py          # metadane TT, dopasowanie miejsca, suggest scen
│   │   ├── prompting.py           # budowanie promptu
│   │   └── rag_engine.py          # FAISS/keyword retrieval
│   ├── services/
│   │   ├── llm.py                 # OpenAI/Gemini
│   │   └── tts.py                 # OpenAI TTS + feature flag
│   └── tests/
│       ├── test_api_baseline.py
│       └── test_rag.py
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── utils/
│   │   └── utils.ts               # funkcje HTTP do backendu
│   ├── hooks/
│   │   ├── useAudioPlayer.ts
│   │   ├── useCharactersLoader.ts
│   │   └── useChat.ts
│   └── components/                # UI (Sidebar, ChatSection, AvatarSection, itd.)
├── public/
│   ├── data/
│   │   └── scenes-catalog.json    # katalog scen (TT suggest / UI)
│   └── avatars/
│       └── README.md              # opis katalogu na wygenerowane avatary (runtime)
├── data/
│   ├── knowledge_base/            # źródła .txt (per postać)
│   ├── time_travel/
│   │   └── characters.json        # metadane roku/miejsca dla TT (źródło prawdy)
│   └── chat_history.jsonl         # runtime (generowane)
├── logs/
│   └── retrieval.log              # runtime (generowane)
├── api_contract.md                # kontrakt API (frontend ↔ backend)
├── ARCHITEKTURA.md                # opis architektury (ten refaktor)
├── STRUKTURA.md                   # opis struktury projektu (ten plik)
├── README.md
├── requirements.txt
├── package.json
└── ...
```

### Co gdzie zmieniać?

- **Dodanie endpointu**: `backend/api/routes.py` (routing) + logika w `backend/core/*` lub `backend/services/*`.
- **Zmiana logiki RAG**: `backend/core/rag_engine.py` (+ ewentualnie parametry w `backend/config/rag_config.py`).
- **Zmiana promptu**: `backend/core/prompting.py`.
- **Dodanie/zmiana postaci**: `data/knowledge_base/<id>/` + konfiguracja w `backend/core/characters_debata_migrated.py`.
- **Zmiana UI**: `src/components/*`, stan/logika: `src/hooks/*`.

