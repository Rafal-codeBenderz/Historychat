# Enterprise — krótki runbook (HistoryChat)

## Włączenie ochrony API

1. Ustaw `API_AUTH_ENABLED=true` oraz `HISTORYCHAT_API_KEY` (lub lista `HISTORYCHAT_API_KEYS`).
2. Na froncie ustaw `VITE_API_KEY` na ten sam sekret (build-time), albo serwuj frontend z reverse proxy, który nie wystawia klucza do przeglądarki (preferowane: BFF / własna domena API z cookies — poza zakresem tego repozytorium).
3. Ustaw `CORS_ORIGINS` na dozwolone originy (nie zostawiaj pustego w produkcji).

## Rate limiting na wielu instancjach

1. Uruchom Redis.
2. `RATE_LIMIT_STORAGE_URI=redis://.../0`
3. `RATE_LIMIT_ENABLED=true` i dostosuj `RATE_LIMIT_*`.

## Budżet dzienny

1. `API_DAILY_REQUEST_BUDGET=<liczba>` (UTC).
2. Ustaw `REDIS_URL` dla współdzielonego licznika między instancjami.
3. Bez Redis licznik jest **w pamięci procesu** (nie nadaje się do skalowania horyzontalnego).

## Observability

- `METRICS_ENABLED=true` → `GET /api/metrics` (Prometheus text).
- `GET /api/health/live` — liveness.
- `GET /api/health/ready` — readiness (KB, RAG, Redis jeśli wymagany, poprawność auth).

## Rotacja kluczy

1. Dodaj nowy klucz do `HISTORYCHAT_API_KEYS`.
2. Zaktualizuj klientów / `VITE_API_KEY`.
3. Usuń stary klucz z listy.
