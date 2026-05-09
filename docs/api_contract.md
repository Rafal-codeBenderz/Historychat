# HistoryChat API Contract

Base URL (dev): `http://localhost:8000`

## Conventions

- All responses are JSON unless noted otherwise.
- Errors return JSON: `{ "error": string }`
- Validation errors use **400** (or **422**) — never **500** due to missing/invalid input.
- Feature-flagged endpoints return **503** when disabled.

## `GET /api/health`

### Response 200

```json
{
  "status": "ok",
  "rag_mode": "faiss | keyword | off",
  "chunks_loaded": ["copernicus", "einstein"],
  "embedder_loaded": true
}
```

Notes:
- `chunks_loaded` is a list of character IDs with KB loaded.
- `rag_mode` indicates retrieval backend.

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

---

## Tryb „Podróż w czasie"

Zestaw trzech endpointów obsługujących tryb TT (frontend: `surface === "timeTravel"`).
Źródło prawdy metadanych: `data/time_travel/characters.json` (mapa `char_id → { start_year, end_year, locations, ... }`).

Stałe walidacji muszą być zgodne z `src/constants/timeTravel.ts`:

| Pole | Limit |
|------|-------|
| `year` | `-3000` … `2100` (`TIME_TRAVEL_YEAR_MIN/MAX`) |
| `location` | max 200 znaków (`TIME_TRAVEL_LOCATION_MAX`) |
| `message` | max 6000 znaków (`TIME_TRAVEL_MESSAGE_MAX`) |

### Rozszerzenie `GET /api/characters` (pole `time_travel`)

Dla postaci, które mają wpis w `data/time_travel/characters.json`, odpowiedź `GET /api/characters` zawiera dodatkowe pole `time_travel`:

```json
{
  "id": "copernicus",
  "name": "Mikołaj Kopernik",
  "time_travel": {
    "start_year": 1473,
    "end_year": 1543,
    "locations": ["Toruń", "Frombork", "Kraków"]
  }
}
```

Postacie bez wpisu nie mają tego pola (back-compat — pole opcjonalne).

---

## `GET /api/characters/time-travel-meta`

Zwraca mapę metadanych TT dla wszystkich postaci, które mają wpis w `data/time_travel/characters.json`.

### Response 200

```json
{
  "copernicus": {
    "start_year": 1473,
    "end_year": 1543,
    "locations": ["Toruń", "Frombork", "Kraków"]
  },
  "einstein": {
    "start_year": 1879,
    "end_year": 1955,
    "locations": ["Ulm", "Bern", "Princeton"]
  }
}
```

### Errors

- 500: błąd odczytu / parsowania `characters.json` (logowane; w odpowiedzi `{ "error": "..." }`).

---

## `POST /api/chat/time-travel`

Generuje odpowiedź postaci osadzoną w wybranej scenie (rok + miejsce). Walidacja sceny dzieje się **przed** wywołaniem LLM.

### Request body

```json
{
  "characterId":      "copernicus",
  "message":          "Co teraz robisz?",
  "history":          [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "year":             1510,
  "location":         "Frombork",
  "sourceStem":       "de_revolutionibus",
  "returningVisitor": false
}
```

### Walidacja

- `characterId` — wymagany, znany `char_id`.
- `message` — wymagany, niepusty, max `TIME_TRAVEL_MESSAGE_MAX`.
- `year` — wymagany, integer, w zakresie `TIME_TRAVEL_YEAR_MIN…MAX`.
- `location` — wymagany, niepusty string, max `TIME_TRAVEL_LOCATION_MAX`.
- `sourceStem` — opcjonalny (jak w `POST /api/chat`).
- `returningVisitor` — opcjonalny boolean (sterowanie tonem promptu).

### Reguła sceny

Scena jest dozwolona, gdy łącznie:

1. `year` mieści się w oknie życia/aktywności postaci z `time_travel.start_year` … `time_travel.end_year`.
2. `location` pasuje (substring, case-insensitive, w obie strony) do choć jednego wpisu z `time_travel.locations` (heurystyka jak w `filterCharacterIdsForTimeTravel` na froncie).

### Response 200

```json
{
  "answer":    "…",
  "fragments": [
    { "text": "…", "source": "De Revolutionibus", "score": 0.42 }
  ],
  "character": { "id": "copernicus", "name": "Mikołaj Kopernik" },
  "scene":     { "year": 1510, "location": "Frombork" }
}
```

### Errors

- **400** — brak / nieprawidłowy typ pola wejściowego.
- **422** — pola w złych zakresach (`year`, długości); szczególny przypadek: scena niedozwolona — **bez wywołania LLM**:

```json
{
  "error":        "Scena niedozwolona dla wybranej postaci.",
  "error_code":   "scene_not_allowed",
  "user_message": "Mikołaj Kopernik nie żył w roku 1510 w mieście Berlin. Wybierz inny rok lub miejsce."
}
```

Frontend (`useTimeTravelChat`) wykrywa `error_code === "scene_not_allowed"` i pokazuje `user_message` użytkownikowi (zamiast generycznego błędu).

---

## `POST /api/time-travel/suggest-scene`

Sugeruje listę miejsc dla wskazanego roku — bez wywołań zewnętrznych API. Heurystyka łączy metadane z `data/time_travel/characters.json` z opcjonalnym lokalnym `public/data/scenes-catalog.json`.

### Request body

| Pole | Typ | Wymagane | Opis |
|------|-----|----------|------|
| `year` | integer | tak | Zakres `TIME_TRAVEL_YEAR_MIN…MAX` |
| `regionToken` | string | nie | Token regionu (alias: `region`); dozwolone `^[a-z0-9_-]{1,64}$`, pusty dozwolony |

### Response 200

```json
{
  "places": ["Frombork", "Toruń", "Kraków"]
}
```

Lista jest deduplikowana, posortowana, ograniczona do sensownego rozmiaru (do 20 pozycji).

### Errors

- **400** — nie-JSON, `year` nie jest integerem, `regionToken` nie jest stringiem.
- **422** — `year` poza zakresem; `regionToken` zbyt długi lub o niedozwolonym formacie.


