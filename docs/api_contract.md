# HistoryChat API Contract

Base URL (dev): `http://localhost:8000`

## Conventions

- All responses are JSON unless noted otherwise.
- Errors return JSON: `{ "error": string }`
- Validation errors use **400** (or **422**) — never **500** due to missing/invalid input.
- Feature-flagged endpoints return **503** when disabled.
- When rate limiting is enabled, endpoints may return **429** with `{ "error": string }`.
- Responses may include header `X-Request-ID` (korelacja logów).
- When `API_AUTH_ENABLED=true`, costly endpoints require `Authorization: Bearer <key>` or `X-API-Key: <key>` (`HISTORYCHAT_API_KEY` / `HISTORYCHAT_API_KEYS` on server). Missing/invalid key → **401**.
- When `API_DAILY_REQUEST_BUDGET` is set and exceeded → **429** with a budget message.

## `GET /api/health/live`

Liveness: proces odpowiada. Zawsze **200** `{ "status": "ok" }` gdy aplikacja działa.

## `GET /api/health/ready`

Readiness: KB, silnik RAG, opcjonalnie Redis (gdy wymagany dla rate limit / budżetu), poprawna konfiguracja auth.

- **200**: `{ "status": "ok" }`
- **503**: `{ "status": "not_ready", "issues": ["kb_missing", ...] }`

## `GET /api/metrics`

Gdy `METRICS_ENABLED=true`: **200** `text/plain` (eksport Prometheus — liczniki żądań i odrzuceń budżetu).

Gdy wyłączone: **404**.

## `GET /api/health`

### Response 200

```json
{
  "status": "ok",
  "characters": ["copernicus", "einstein"],
  "indexes_built": ["copernicus"],
  "chunks_loaded": ["copernicus", "einstein"],
  "rag_mode": "faiss | keyword | off",
  "embedder_loaded": true,
  "kb_path": "/path/to/data/knowledge_base",
  "kb_exists": true,
  "app_version": "dev"
}
```

Notes:
- `chunks_loaded` is a list of character IDs with KB loaded.
- `rag_mode` indicates retrieval backend.
- `app_version` comes from env `APP_VERSION` (default `dev`).

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

Notes:
- `history` must be an array of objects; each object requires `role` (`user` or `assistant` only) and `content` (string). Max 40 entries; each `content` max 6000 characters (same order of magnitude as `message`).
- `sourceStem`, if present, must be a string (or omit / null).

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
- 401: API authentication required (`API_AUTH_ENABLED=true`)
- 429: rate limit or daily budget exceeded

### Brak kluczy LLM (OpenAI / Gemini)

Gdy nie ustawiono ani `OPENAI_API_KEY`, ani `GEMINI_API_KEY`, odpowiedź nadal ma **HTTP 200** (kontrakt bez zmian dla frontu), a pole `answer` zawiera komunikat konfiguracyjny po polsku z instrukcją ustawienia `.env` — nie jest to treść historyczna z RAG.

## `GET /api/routes`

Zwraca **200** i listę reguł URL (diagnostyka): `{ "rule": string, "methods": string[] }[]`.

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
- 401: API authentication required (`API_AUTH_ENABLED=true`)
- 429: rate limit or daily budget exceeded

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
- 401: API authentication required (`API_AUTH_ENABLED=true`)
- 429: rate limit or daily budget exceeded

