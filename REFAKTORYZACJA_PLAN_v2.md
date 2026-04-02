# Plan refaktoryzacji v2.0
**Projekt:** HistoryChat RAG (React/Vite + Flask/Python)
**Data aktualizacji:** 2026-04-02
**Wersja:** 2.0 — zaktualizowana na podstawie Code Quality Review

---

## Cel

- Zmniejszyć ryzyko regresji i ułatwić rozwój: porządek w repo, wyraźne granice modułów, przewidywalne API, stabilne audio/TTS.
- Utrzymać działanie aplikacji przez cały proces (małe, odwracalne kroki).

---

## Zmiany względem v1.0

Poniżej lista luk zidentyfikowanych w przeglądzie Code Quality — każda zaadresowana w odpowiednim etapie.

| Problem (priorytet) | Zmiana w v2.0 |
|---|---|
| Brak testów automatycznych przed Etapem 2 — **KRYTYCZNE** | Dodano **Etap 2.0** (baseline tests): min. 8 asercji pytest przed podziałem monolitu |
| Ryzyko `create_app()` — RAG init per-request — **KRYTYCZNE** | Jawny wzorzec singletona `get_engine()` z opisem anty-wzorców i obsługi Gunicorn multi-worker |
| Niezdecydowane mapowanie głosów (Opcja A vs B) — **WAŻNE** | **ADR-01** zamknięty: backend zwraca `voice_id` gotowy dla OpenAI, frontend nie mapuje |
| Niekompletna sekwencja cleanup audio — **WAŻNE** | Jawna sekwencja: `disconnect()` → `revokeObjectURL()` → `src = ''` + guard na duplikat `MediaElementSource` |
| Duplikat projektu bez decyzji — **SUGESTIA** | **ADR-00** zamknięty: przenieś do osobnego repo/ZIP, `git rm`, commit |

---

## Zasady bezpieczeństwa (obowiązują w każdym etapie)

- Pracuj na osobnej gałęzi (np. `refactor/etap-N`) — nigdy bezpośrednio na `main`.
- Małe commity: jeden logiczny krok = jeden commit = łatwy rollback.
- Nie zmieniaj jednocześnie kontraktu API i UI — zawsze dwa oddzielne kroki (backend kompatybilny wstecz → frontend przełącza się).
- Funkcje kosztowe (TTS, generowanie avatarów) zawsze za feature-flagami w `.env`.
- Dane runtime (np. `data/*.db`) traktuj jako lokalne — **zrób kopię zapasową przed Etapem 0** i nie wykonuj „porządków” w `data/` w ramach refaktoru.

---

## Checklista testów ręcznych (po każdym etapie)

Jeśli którykolwiek punkt nie przechodzi — cofnij ostatni commit.

1. Frontend startuje, lista postaci się ładuje.
2. Wysyłka wiadomości → odpowiedź przychodzi + wyświetlają się fragmenty źródeł.
3. TTS z kluczem: audio generuje się i odtwarza; bez klucza: UI nie psuje czatu.
4. `GET /api/health` zwraca status z polami: `rag_mode`, `chunks_loaded`, `embedder_loaded`.

---

## Rekomendowana kolejność realizacji

```
Etap 0 → Etap 1 → Etap 2.0 (baseline tests) → Etap 2 → Etap 3 → Etap 5 → Etap 4 (opcjonalnie)
```

---

## Etap 0 — Porządek w repo
> **Ryzyko:** niskie | **Zwrot:** wysoki | Wykonaj jako pierwsze.

### 0.0 Kopia zapasowa danych (obowiązkowe przed 0.1)

> **Ryzyko:** niskie | **Krytyczne dla bezpieczeństwa danych**

Jeśli w repo istnieje `data/` z bazami danych (np. `data/historychat.db`, `data/cache.db`), wykonaj kopię zapasową **poza repozytorium** (np. do `backups/` poza tree projektu lub jako osobny ZIP). Ten plan refaktoryzacji nie obejmuje migracji danych — celem jest tylko porządek i stabilność kodu.

### 0.1 Dodaj / uzupełnij `.gitignore`

Ignoruj pliki runtime, baz danych i artefaktów lokalnych. **NIE usuwaj danych użytkownika bez kopii.**

```gitignore
data/*.db
data/chat_history.jsonl
logs/
*.log
public/avatars/*.jpg
__pycache__/
.env
node_modules/
```

**Uwaga o avatarach:** ignoruj `public/avatars/*.jpg` tylko jeśli to artefakty generowane lokalnie. Jeśli masz avatary „produktowe” (asset stały), przenieś je do katalogu wersjonowanego (np. `public/avatars/static/`) i ignoruj wyłącznie część generowaną.

### 0.2 Duplikat projektu — ADR-00 *(nowość v2.0)*

> **Decyzja zamknięta:** folder `debata pozniej na github do wrzucenia/` przenosimy poza repozytorium główne.

**Kroki:**
1. Stwórz osobne repo archiwalne lub ZIP z zawartością folderu.
2. `git rm -r "debata pozniej na github do wrzucenia/"`.
3. Commit: `chore: remove legacy archive folder`.

**Uzasadnienie:** folder nie może wpływać na build ani być źródłem importów. Git tag zachowuje całą historię bez zaśmiecania tree. Alternatywa "zostaw jako archiwum" odrzucona — w praktyce nigdy nie dostaje opisu i zostaje na zawsze.

### Kryterium zakończenia Etapu 0

- `git status` czysty lub wyłącznie celowe zmiany kodu (zero artefaktów).
- Build frontu i uruchomienie backendu działają identycznie jak przed etapem.

---

## Etap 1 — Stabilizacja kontraktów i konfiguracji
> **Ryzyko:** średnie | Stabilizuj kontrakt zanim ruszysz kod.

### 1.1 Ustal i spisz kontrakt API

Zapisz jako `api_contract.md` w repo.

| Endpoint | Metoda | Request | Response |
|---|---|---|---|
| `/api/characters` | GET | — | `id, name, era, bio, icon, avatar_color, voice_id, suggestedTopics[]` |
| `/api/chat` | POST | `characterId, message, history[], sourceStem?` | `answer, fragments[], character?` |
| `/api/tts` | POST | `text, voice_id` | `audio_base64, format` — tylko gdy `ENABLE_TTS=true` |
| `/api/health` | GET | — | `status, rag_mode, chunks_loaded, embedder_loaded, version` |

Kody błędów: `400`/`422` dla błędnych danych wejściowych, `503` dla wyłączonych feature flags — **nigdy `500` z powodu braku walidacji**.

### 1.2 Feature flags w `.env`

```env
ENABLE_TTS=false               # domyślnie false; bez klucza OpenAI endpoint zwraca 503, nie 500
ENABLE_AVATAR_GENERATION=false # domyślnie false; bez flagi generowanie nie odpala się w tle
```

### 1.3 Mapowanie głosów — ADR-01 *(nowość v2.0)*

> **Decyzja zamknięta:** Opcja A.

Backend jest właścicielem danych postaci — zwraca pole `voice_id` z wartością bezpośrednio akceptowaną przez OpenAI TTS (np. `"nova"`, `"echo"`). Frontend tylko przekazuje — nie mapuje.

**Kroki migracji:**
1. Dodaj pole `voice_id` do modelu postaci w backendzie.
2. Usuń tablicę mapowania z frontendu po wdrożeniu backendu (krok wstecz-kompatybilny).
3. Dodaj fallback + log `WARN` jeśli `voiceName` istnieje ale `voice_id` brak.

### Kryterium zakończenia Etapu 1

- `api_contract.md` istnieje w repo i jest aktualny.
- TTS bez klucza zwraca `503` z komunikatem — weryfikacja ręczna.
- ADR-01 zamknięty: `/api/characters` zwraca `voice_id` zamiast `voiceName`.

---

## Etap 2.0 — Baseline tests (siatka bezpieczeństwa) *(nowy w v2.0)*
> **Ryzyko:** n/d | **Ten etap musi być ukończony przed Etapem 2.**

Etap 2 (rozbicie monolitu) niesie najwyższe ryzyko regresji. Bez automatycznej siatki bezpieczeństwa jedyną weryfikacją są 4 testy ręczne — to za mało przy 5–6 wydzielanych modułach.

### Wymagane testy — `backend/tests/test_api_baseline.py`

Uruchamiaj przez: `pytest backend/tests/`

```
1. GET /api/health → 200, pola rag_mode i chunks_loaded obecne
2. GET /api/characters → 200, lista niepusta, każdy element ma id i name
3. POST /api/chat z poprawnym characterId → 200, pole answer niepuste
4. POST /api/chat z brakującym characterId → 400 lub 422 (nie 500)
5. POST /api/chat z za długim message (> limit) → 400 lub 422
6. POST /api/tts przy ENABLE_TTS=false → 503 z komunikatem (nie crash)
7. POST /api/chat → fragments[] jest listą (może być pusta, ale klucz musi istnieć)
8. Dwukrotne wywołanie get_engine() → ten sam obiekt (singleton)
```

### Wzorzec singletona RAGEngine *(krytyczne — nowość v2.0)*

```python
# backend/core/rag_engine.py

_engine = None

def get_engine() -> RAGEngine:
    global _engine
    if _engine is None:
        _engine = RAGEngine()
    return _engine
```

**Ważne (thread-safety):** w środowisku wielowątkowym (np. `gthread`, niektóre konfiguracje WSGI) powyższy wzorzec może zainicjalizować `RAGEngine()` więcej niż raz przy równoległych żądaniach. Rozwiązanie: zabezpieczyć inicjalizację lockiem albo wykonać inicjalizację w kontrolowanym miejscu na starcie workera. W testach baseline dopuszczalne jest sprawdzenie „ten sam obiekt po 2 wywołaniach”, ale implementacja docelowa powinna być odporna na wyścigi.

**Niedozwolone wzorce:**

```python
# ❌ NIE — init wewnątrz create_app()
def create_app():
    app = Flask(__name__)
    rag_engine = RAGEngine()   # błąd: init per app context
    return app

# ❌ NIE — init wewnątrz handlera
@app.route("/api/chat", methods=["POST"])
def chat():
    engine = RAGEngine()       # błąd: init per request
    ...

# ❌ NIE — init w before_request bez guarda
@app.before_request
def setup():
    g.engine = RAGEngine()     # błąd: nowy obiekt przy każdym żądaniu
```

**Gunicorn multi-worker:** każdy worker inicjalizuje swój singleton przy pierwszym żądaniu (lazy-init). Dla dużych modeli embeddings rozważ `preload_app = true` w konfiguracji Gunicorn — fork procesu następuje po inicjalizacji, workers dziedziczą załadowany model.

### Kryterium zakończenia Etapu 2.0

- `pytest backend/tests/test_api_baseline.py`: **8/8 PASS**.
- Testy działają na oryginalnym `server.py` (przed podziałem).

---

## Etap 2 — Refaktoryzacja backendu: monolit → moduły
> **Ryzyko:** wysokie | Testy z Etapu 2.0 muszą przechodzić po każdym kroku.

Cel: podzielić `backend/server.py` na mniejsze pliki **bez zmiany logiki i bez zmiany endpointów**.

### 2.1 Wydzielenie modułów (jeden moduł = jeden commit)

| Moduł | Zawartość |
|---|---|
| `backend/core/rag_engine.py` | `RAGEngine`, chunking, retrieval, `get_engine()` singleton |
| `backend/core/prompting.py` | `build_prompt()` — logika budowania promptu |
| `backend/services/llm.py` | `call_openai()`, `call_gemini()`, `call_llm()` — abstrakcja modelu |
| `backend/services/tts.py` | `generate_tts()` — logika TTS bez dekoratora Flask |
| `backend/api/routes.py` | Definicje endpointów Flask — cienkie kontrolery (tylko routing + walidacja) |
| `backend/config/paths.py` | `_ROOT`, `LOGS_DIR`, `DATA_DIR`, `KB_PATH`, `CHAT_HISTORY_PATH` |

### 2.2 Inicjalizacja aplikacji

- Zastąp globalny `rag_engine` + `before_request` wywołaniem `get_engine()` z `core/rag_engine.py`.
- `create_app()` tworzy tylko aplikację Flask — **nie inicjalizuje RAG**. Patrz wzorzec z Etapu 2.0.

### 2.3 Walidacja wejścia (lekka, bez nowych ciężkich zależności)

- Dodaj funkcje walidujące `request.json`: typy, wymagane pola, limity długości `message`.
- Zwracaj `400`/`422` z czytelnym komunikatem — nie `500`.
- Opcjonalnie w kolejnych iteracjach: `pydantic` / `marshmallow`.

### Kryterium zakończenia Etapu 2

- `pytest backend/tests/test_api_baseline.py`: nadal **8/8 PASS**.
- Wszystkie endpointy działają tak samo — zweryfikuj checklista testów ręcznych.
- Logi i ścieżki plików liczone od root projektu (`paths.py`).

---

## Etap 3 — Frontend: porządek w logice czatu i audio
> **Ryzyko:** średnie | Bez zmian UI.

### 3.1 Usuń mutacje obiektów w state

```typescript
// ❌ NIE — mutacja obiektu już dodanego do state
messages[i].audioUrl = url;
setState(messages);

// ✅ TAK — nowa referencja przez map()
setState(prev =>
  prev.map(msg => msg.id === id ? { ...msg, audioUrl: url } : msg)
);
```

### 3.2 Wydziel logikę do hooków

| Hook | Odpowiedzialność |
|---|---|
| `useCharactersLoader()` | Fetch `/api/characters`, retry z backoff, obsługa błędu |
| `useChat()` | `submitChat`, `suggestedTopics`, historia wiadomości, obsługa błędów |
| `useAudioPlayer()` | `AudioContext`, analyser, play/stop, cleanup sekwencja (patrz 3.3) |

### 3.3 Stabilność audio — sekwencja cleanup *(uzupełnione v2.0)*

```typescript
// Kolejność jest istotna — nie zamieniaj kroków

// 1. Odłącz źródło przed tworzeniem nowego (Chrome rzuca błąd przy duplikacie)
if (sourceRef.current) {
  sourceRef.current.disconnect();
  sourceRef.current = null;
}

// 2. Zwolnij blob URL — po zakończeniu odtwarzania lub na abort
//    NIE przy starcie nowego odtwarzania (odtwarzanie by się urwało)
if (currentUrlRef.current) {
  URL.revokeObjectURL(currentUrlRef.current);
  currentUrlRef.current = null;
}

// 3. Zwolnij referencję do blob
audioElement.src = '';
```

**Guard na duplikat `MediaElementSource`:**

```typescript
// Chrome rzuca InvalidStateError jeśli element jest już połączony
if (!sourceRef.current) {
  sourceRef.current = audioCtx.createMediaElementSource(audioElement);
  sourceRef.current.connect(analyserRef.current);
  analyserRef.current.connect(audioCtx.destination);
}
```

**Limit `AudioContext`:** przeglądarki dozwalają ~6 otwartych instancji. Pilnuj `audioCtx.close()` po zakończeniu sesji — nie twórz nowego kontekstu przy każdym odtworzeniu.

### Kryterium zakończenia Etapu 3

- `App.tsx` jest zauważalnie mniejszy — logika czatu i audio w hookach.
- Wielokrotne odtwarzanie audio nie powoduje błędów w konsoli przeglądarki.
- Memory profiler: brak rosnącej liczby blob URL po kilku wiadomościach z TTS.

---

## Etap 4 — RAG: jakość i testowalność *(opcjonalnie, po stabilizacji)*
> **Ryzyko:** niskie

### 4.1 Testy jednostkowe dla chunkingu i retrieval

```
backend/tests/test_rag.py
```

- `chunk_size` / `overlap` — edge case'y: puste dokumenty, dokumenty krótsze niż chunk.
- Retrieval w trybie FAISS vs keyword — wyniki deterministyczne dla tych samych danych.
- `sourceStem`: filtrowanie i fallback gdy brak dopasowania.

### 4.2 Stałe konfiguracyjne — koniec z magic numbers

```python
# backend/config/rag_config.py — zamiast rozsianych literałów

SIMILARITY_THRESHOLD = 0.2   # był: magiczne 0.2 w rag_engine.py
MAX_FRAGMENTS = 5
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
```

Dodaj logowanie metryk w spójnej formie: `retrieval_time_ms`, `fragments_found`, `mode`.

### Kryterium zakończenia Etapu 4

- `pytest backend/tests/test_rag.py`: PASS.
- Brak magic numbers w `rag_engine.py`.

---

## Etap 5 — Dokumentacja i zgodność
> **Ryzyko:** niskie

### 5.1 README — synchronizacja z rzeczywistością

- Liczba postaci, sposób konfiguracji, lista feature flags (`.env`).
- Opis struktury katalogów po refaktorze: `backend/core`, `backend/services`, `backend/api`, `backend/config`.
- Sekcja "Uruchomienie testów": `pytest backend/tests/`.
- Zapis o usuniętym archiwum (co to było i gdzie trafiło).

### 5.2 Plik `api_contract.md`

Wygenerowany lub uzupełniony w Etapie 1 — upewnij się że jest aktualny po Etapie 2. Zawiera: endpoint, metoda, schema request/response, kody błędów.

### 5.3 Observability *(opcjonalnie)*

- Jeśli planujesz Sentry: osobny moduł konfiguracji + sanitizacja (bez PII, bez promptów w logach).
- Minimalne metryki: czas odpowiedzi RAG, liczba fragmentów, tryb retrieval.

---

## Scenariusze rollback

| Sytuacja | Działanie |
|---|---|
| Etap N psuje działanie | Preferuj `git revert` (bezpieczne, niedestrukcyjne) do cofnięcia commitów na gałęzi współdzielonej / wypchniętej. `git reset --hard` stosuj wyłącznie lokalnie i tylko jeśli masz pewność, że nie stracisz niezacommitowanych zmian (najpierw `git status`, a najlepiej backup/stash). Zostaw tylko nieinwazyjne zmiany (np. `.gitignore`). |
| Refaktor "przeniósł" kod | Rollback = powrót do poprzedniego układu plików. Dlatego małe commity po jednym module są krytyczne. |
| Test baseline FAIL po Etapie 2 | Nie kontynuuj. Zlokalizuj regresję przed przejściem do kolejnego modułu. |
| Audio crash po Etapie 3 | Cofnij hook `useAudioPlayer`, zdiagnozuj cleanup sekwencję, wróć z poprawką. |

---

## Checklista przed mergem każdego etapu

- [ ] Kod czytelny i zgodny ze stylem projektu
- [ ] `pytest backend/tests/test_api_baseline.py` — 8/8 PASS
- [ ] Checklista testów ręcznych zaliczona — 4/4 scenariusze
- [ ] Brak zakomentowanego kodu i debugowych `print()` / `console.log()`
- [ ] Brak hardcodowanych sekretów i kluczy API
- [ ] Feature flagi działają — kosztowe endpointy nie odpytują OpenAI bez klucza
- [ ] PR opis zawiera: co zmieniono, jak przetestowano, link do etapu w tym dokumencie

---

*Plan refaktoryzacji v2.0 — HistoryChat RAG. Główne zmiany względem v1.0: Etap 2.0 (baseline tests), ADR-00 (duplikat projektu), ADR-01 (voice_id), wzorzec singletona RAGEngine, sekwencja cleanup audio.*
