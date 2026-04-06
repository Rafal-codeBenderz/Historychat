# Changelog

Wszystkie istotne zmiany w projekcie warto tu krótko opisywać (PR / release).

## [Unreleased]

### Added

- CI: `npm audit` (poziom high) oraz `pip-audit` i `mypy backend` jako kroki informacyjne (`continue-on-error`), żeby raportować ryzyka bez blokowania merge przy szumie rejestrów.
- Dokument `docs/checklista_przed_oddaniem.md` (checklista przed oddaniem kodu).
- Testy: nieznany `characterId` na `/api/chat`; ścieżka OpenAI z mockiem zwraca bezpieczny komunikat użytkownika po wyczerpaniu retry.
- Flaga `ENABLE_CHAT_HISTORY` — warunkowy zapis `data/chat_history.jsonl`.
- Timeouty HTTP: `OPENAI_HTTP_TIMEOUT`, `GEMINI_HTTP_TIMEOUT`, `TTS_HTTP_TIMEOUT` (domyślnie 60 s).
- Walidacja `history` i `sourceStem` na `POST /api/chat` + testy negatywne; `BACKEND_PORT` respektowany w `python -m backend.server`.

### Changed

- `backend/api/chat.py`: stałe limitów (`MAX_MESSAGE_LENGTH`, `RAG_TOP_K`, historia) oraz walidacja `history` / `sourceStem`.
- `backend/api/bootstrap.py`: zapis `chat_history` tylko przy `ENABLE_CHAT_HISTORY`; leniwy import silnika RAG w `init_once`.
- `backend/api/__init__.py`: docstring modułu blueprintu API.

### Notes

- Nie wprowadzono breaking changes w kontrakcie API frontend–backend.
