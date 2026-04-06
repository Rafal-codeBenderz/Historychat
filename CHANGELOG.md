# Changelog

Wszystkie istotne zmiany w projekcie warto tu krótko opisywać (PR / release).

## [Unreleased]

### Added

- Enterprise: opcjonalne `API_AUTH_ENABLED` + `HISTORYCHAT_API_KEY` / `HISTORYCHAT_API_KEYS` (Bearer / `X-API-Key`) na `POST /api/chat`, `/api/tts`, `/api/generate-avatar`.
- Dzienny budżet żądań: `API_DAILY_REQUEST_BUDGET` + opcjonalnie `REDIS_URL` (współdzielony licznik); `API_BUDGET_WITHOUT_AUTH` gdy auth wyłączone.
- Rate limit: `RATE_LIMIT_STORAGE_URI` (np. Redis) przez `RATELIMIT_STORAGE_URI`; `RATE_LIMIT_AVATAR` dla generowania awatarów.
- Observability: `GET /api/health/live`, `GET /api/health/ready`, `GET /api/metrics` (gdy `METRICS_ENABLED=true`), nagłówek `X-Request-ID`.
- Moduł `backend/core/characters.py` jako publiczny import domeny postaci (implementacja nadal generowana w `characters_debata_migrated.py`).
- Frontend: `VITE_API_KEY`, `apiAuthHeaders()` / `buildApiAuthHeaders()` w `src/utils/utils.ts`; Vitest + RTL (`npm run test`).
- CI: `npm run test`, backend `pytest` z `--cov` i progiem, smoke `GET /api/health/live`; `.coveragerc` (bez `backend/tests` w raporcie).
- Dokumentacja: `docs/ENTERPRISE_RUNBOOK.md`, rozszerzenia `docs/api_contract.md` i `.env.example`.
- CI (informacyjnie): `npm audit` (high+), `pip-audit`, `mypy backend` (`continue-on-error`).
- Dokument `docs/checklista_przed_oddaniem.md` (checklista przed oddaniem kodu).
- Testy: nieznany `characterId` na `/api/chat`; ścieżka OpenAI z mockiem zwraca bezpieczny komunikat użytkownika po wyczerpaniu retry.
- Flaga `ENABLE_CHAT_HISTORY` — warunkowy zapis `data/chat_history.jsonl`.
- Timeouty HTTP: `OPENAI_HTTP_TIMEOUT`, `GEMINI_HTTP_TIMEOUT`, `TTS_HTTP_TIMEOUT` (domyślnie 60 s).
- Walidacja `history` i `sourceStem` na `POST /api/chat` + testy negatywne; `BACKEND_PORT` respektowany w `python -m backend.server`.

### Changed

- `backend/server.py`: `load_dotenv` przed importem limitera; `RATELIMIT_STORAGE_URI` z `RATE_LIMIT_STORAGE_URI`; metryki i `X-Request-ID`.
- `backend/api/chat.py`: stałe limitów (`MAX_MESSAGE_LENGTH`, `RAG_TOP_K`, historia) oraz walidacja `history` / `sourceStem`.
- `backend/api/bootstrap.py`: `enterprise_request_guards` (auth + budżet); zapis `chat_history` tylko przy `ENABLE_CHAT_HISTORY`; leniwy import silnika RAG w `init_once`.
- Domyślne `ENABLE_CHAT_HISTORY` zmienione na `false` przy braku zmiennej środowiskowej (zgodne z `.env.example`).
- `backend/api/__init__.py`: docstring modułu blueprintu API.

### Notes

- Domyślnie `API_AUTH_ENABLED=false` — bez zmian dla istniejących wdrożeń. Po włączeniu auth frontend musi ustawić `VITE_API_KEY` (lub inny mechanizm BFF).
