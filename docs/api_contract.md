# HistoryChat API Contract

Base URL (dev): `http://localhost:8000`

## Conventions

- All responses are JSON unless noted otherwise.
- Errors return JSON: `{ "error": string }`
- Validation errors use **400** (or **422**) — never **500** due to missing/invalid input.
- Feature-flagged endpoints return **503** when disabled.

## Observability (minimal)

- Plik `logs/retrieval.log` — m.in. komunikaty RAG i błędy serwera (nie umieszczaj w logach pełnych promptów użytkownika ani kluczy API).
- Diagnostyka routingu: `GET /api/routes` (patrz sekcja poniżej).

## `GET /api/health`

Diagnostyczny stan backendu i RAG.

### Response 200

```json
{
  "status": "ok",
  "characters": ["antoinette", "aristotle", "copernicus"],
  "indexes_built": ["copernicus", "einstein"],
  "chunks_loaded": ["copernicus", "einstein"],
  "rag_mode": "faiss",
  "embedder_loaded": true,
  "kb_path": "<abs path>/data/knowledge_base",
  "kb_exists": true
}
```

Notes:
- `characters`: wszystkie znane backendowi identyfikatory postaci.
- `indexes_built`: postacie z gotowym indeksem wektorowym (FAISS); może być puste w trybie słów.
- `chunks_loaded`: postacie z załadowanymi fragmentami KB.
- `rag_mode`: `faiss` (embeddings + indeks), `keyword` (heurystyka słowami), lub `off` (brak danych).
- `kb_path` / `kb_exists`: lokalna ścieżka do katalogu bazy wiedzy.

---

## `GET /api/routes`

Lista tras zarejestrowanych w aplikacji (debug / smoke test routingu).

### Response 200

Posortowany po `rule` JSON array:

```json
[
  { "rule": "/api/chat", "methods": ["POST"] },
  { "rule": "/api/health", "methods": ["GET"] }
]
```

Wpisy dla `OPTIONS`/`HEAD` są pomijane w odpowiedzi.

---

## `GET /api/history/<char_id>`

Historia czatu dla danej postaci (rekordy z pliku runtime `data/chat_history.jsonl` przefiltrowane po `character_id`).

### Response 200

Array wpisów (każdy co najmniej: `timestamp`, `character_id`, `role`, `content`; opcjonalnie `sources`).

```json
[
  {
    "timestamp": "2025-01-01T12:00:00",
    "character_id": "copernicus",
    "role": "user",
    "content": "…",
    "sources": []
  }
]
```

---

## `DELETE /api/history/<char_id>/clear`

Usuwa z historii (plik JSONL) wszystkie wpisy dla wskazanego `char_id`; pozostałe wpisy zostają bez zmian.

### Response 200

```json
{ "success": true }
```

## `GET /api/characters`

### Response 200

Array of characters:

```json
[
  {
    "id": "copernicus",
    "name": "Mikołaj Kopernik",
    "era": "Renesans (1473–1543)",
    "bio": "...",
    "icon": "🌍",
    "avatar_color": "#1a3a5c",
    "voice_id": "nova",
    "suggestedTopics": [
      { "question": "Co sądzisz o teorii heliocentrycznej?", "sourceStem": "de_revolutionibus" }
    ]
  }
]
```

Notes:
- `voice_id` is ready to be sent to OpenAI TTS.
- `suggestedTopics[].sourceStem` can be empty string when not pinned.

## `POST /api/chat`

### Request body

```json
{
  "characterId": "copernicus",
  "message": "Jak doszedłeś do swoich odkryć?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "sourceStem": "de_revolutionibus"
}
```

### Response 200

```json
{
  "answer": "…",
  "fragments": [
    { "text": "…", "source": "De Revolutionibus", "score": 0.42 }
  ],
  "character": { "id": "copernicus", "name": "Mikołaj Kopernik" }
}
```

### Errors

- 400/422: missing/invalid `characterId`, invalid request body

## `POST /api/tts`

Feature flag: `ENABLE_TTS=true`

### Request body

```json
{ "text": "…", "voice_id": "nova" }
```

### Response 200

```json
{ "audio_base64": "…", "format": "mp3" }
```

### Errors

- 503: feature disabled or missing OpenAI key

## (Optional) `POST /api/generate-avatar`

Feature flag: `ENABLE_AVATAR_GENERATION=true`

### Request body

```json
{ "character_id": "copernicus" }
```

### Response 200

```json
{ "success": true, "image_url": "/avatars/copernicus.jpg", "cached": false }
```

### Errors

- 503: feature disabled or missing OpenAI key

---

## `POST /api/debate/turn`

Generuje jedną turę debaty „Sąd historyczny" dla wskazanej roli.

### Request body

```json
{
  "theme": "Nauka niszczy wartości moralne",
  "roles": {
    "prosecutor": "einstein",
    "defender":   "newton",
    "judge":      "aristotle"
  },
  "next_role": "prosecutor",
  "transcript": [
    {
      "speaker":     "einstein",
      "speakerName": "Albert Einstein",
      "role":        "prosecutor",
      "content":     "Nauka sama w sobie nie ma wartości moralnych..."
    }
  ]
}
```

**Walidacja:**
- `theme` — wymagany, niepusty, max 1000 znaków
- `roles` — obiekt z kluczami `prosecutor`, `defender`, `judge`; wartości to `char_id` z `/api/characters`; wszystkie trzy muszą być **różne**
- `next_role` — jeden z: `prosecutor`, `defender`, `judge`
- `transcript` — lista (może być pusta), max 50 tur

### Response 200

```json
{
  "speaker":     "einstein",
  "speakerName": "Albert Einstein",
  "role":        "prosecutor",
  "content":     "Jako odkrywca teorii względności twierdzę, że...",
  "fragments": [
    { "text": "Fragment z archiwum...", "source": "relativity.txt", "score": 0.82 }
  ]
}
```

### Errors

- 400: brak `theme`, nieznany `char_id`, zduplikowane role, nieprawidłowa `next_role`
- 500: błąd LLM lub RAG

---

## `POST /api/debate/verdict`

Generuje końcowy werdykt sędziego (`verdict_mode=True`). Identyczna walidacja jak `/api/debate/turn` — bez pola `next_role`.

### Request body

```json
{
  "theme": "Nauka niszczy wartości moralne",
  "roles": {
    "prosecutor": "einstein",
    "defender":   "newton",
    "judge":      "aristotle"
  },
  "transcript": [ ]
}
```

### Response 200

```json
{
  "speaker":     "aristotle",
  "speakerName": "Aristotle",
  "role":        "judge",
  "content":     "Po wysłuchaniu obu stron ogłaszam werdykt...",
  "fragments":   []
}
```

Pole `role` w odpowiedzi zawsze `"judge"`.

---

## Kolory ról (frontend)

| Rola | Hex |
|------|-----|
| `prosecutor` | `#e57373` (czerwony) |
| `defender` | `#64b5f6` (niebieski) |
| `judge` | `#ffd54f` (złoty) |

## Kolejność tur (hook useDebate)

`prosecutor → defender → judge → prosecutor → ...` (indeks tury modulo 3).
Werdykt można zażądać w dowolnym momencie (zalecane min. 3 tury).

