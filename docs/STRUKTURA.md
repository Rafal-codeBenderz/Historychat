## Struktura projektu (v2)

Ten plik opisuje strukturę katalogów po refaktorze. Opis architektury jest w `ARCHITEKTURA.md`, a kontrakt HTTP w `api_contract.md`.

### Drzewo katalogów (skrót)

```
<root>/
├── backend/
│   ├── __init__.py
│   ├── server.py                  # entrypoint Flask (create_app + blueprint)
│   ├── api/
│   │   ├── __init__.py            # Blueprint `api` + import modułów tras
│   │   ├── bootstrap.py           # init RAG, zapis chat_history.jsonl
│   │   ├── characters.py, chat.py, health_route.py, history_route.py
│   │   ├── tts_route.py, avatar_route.py, misc_route.py  # /api/routes
│   │   └── routes.py              # re-eksport blueprintu (kompatybilność importów)
│   ├── config/
│   │   ├── __init__.py
│   │   ├── paths.py               # ROOT, DATA_DIR, LOGS_DIR, KB_PATH, CHAT_HISTORY_PATH...
│   │   └── rag_config.py          # parametry RAG (jeśli używane)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── characters.py                 # publiczny import: CHARACTERS, VOICE_MAP, QUERY_EXPANSIONS
│   │   ├── characters_debata_migrated.py  # wygenerowane dane postaci (regen skryptem; importuj z characters.py)
│   │   ├── prompting.py           # budowanie promptu
│   │   └── rag_engine.py          # FAISS/keyword retrieval
│   ├── services/
│   │   ├── llm.py                 # OpenAI/Gemini
│   │   ├── tts.py                 # OpenAI TTS + feature flag
│   │   └── retry_utils.py         # wspólny retry z backoffem
│   └── tests/
│       ├── test_api_baseline.py
│       ├── test_rag.py
│       ├── test_retry_utils.py
│       └── test_llm_config.py
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
│   └── avatars/
│       └── README.md              # opis katalogu na wygenerowane avatary (runtime)
├── data/
│   ├── knowledge_base/            # źródła .txt (per postać)
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

- **Dodanie endpointu**: nowy moduł lub istniejący plik w `backend/api/*.py` (routing) + logika w `backend/core/*` lub `backend/services/*`.
- **Zmiana logiki RAG**: `backend/core/rag_engine.py` (+ ewentualnie parametry w `backend/config/rag_config.py`).
- **Zmiana promptu**: `backend/core/prompting.py`.
- **Dodanie/zmiana postaci**: `data/knowledge_base/<id>/` + regeneracja `characters_debata_migrated.py` (kod aplikacji importuje `backend.core.characters`).
- **Zmiana UI**: `src/components/*`, stan/logika: `src/hooks/*`.

