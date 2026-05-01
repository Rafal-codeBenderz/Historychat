# HistoryChat — instrukcja uruchomienia

Krok po kroku: jak uruchomić aplikację lokalnie (Windows / macOS / Linux).

---

## 1. Wymagania wstępne

| Narzędzie | Wersja | Sprawdzenie |
|-----------|--------|-------------|
| Python    | 3.10+  | `python --version` |
| Node.js   | 18+    | `node --version` |
| npm       | (z Node) | `npm --version` |
| git       | dowolna | `git --version` |

Opcjonalnie: **OpenAI API key** (do czatu, TTS i generowania awatarów DALL-E) **lub** **Gemini API key** (tylko czat, jako fallback gdy brak OpenAI).

---

## 2. Pobranie kodu

```bash
git clone https://github.com/Rafal-codeBenderz/Historychat.git
cd Historychat
```

---

## 3. Konfiguracja `.env`

Skopiuj przykładowy plik konfiguracji do katalogu głównego projektu:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

Otwórz `.env` i uzupełnij klucze:

```env
OPENAI_API_KEY=sk-...                  # zalecane (czat + TTS + awatary)
# GEMINI_API_KEY=...                   # fallback, gdy brak OPENAI_API_KEY
# OPENAI_CHAT_MODEL=gpt-4o-mini        # opcjonalnie inny model
ENABLE_TTS=true                        # true/false — odczyt odpowiedzi głosem
ENABLE_AVATAR_GENERATION=false         # true/false — generowanie awatarów DALL-E 3
```

> **Uwaga:** sam RAG (indeks + wyszukiwanie) **nie wymaga** żadnego klucza — działa lokalnie. Klucz jest potrzebny dopiero do wygenerowania **odpowiedzi** (czat) oraz — osobno — **TTS** i **awatarów**.

---

## 4. Instalacja zależności

### Backend (Python)

Z katalogu głównego projektu (tam gdzie `package.json`, `backend/`, `data/`):

```bash
pip install -r requirements.txt
```

### Frontend (Node)

```bash
npm install
```

---

## 5. Uruchomienie

Masz do wyboru 3 tryby:

### A. Najprostszy — backend + frontend jedną komendą

```bash
npm run start
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

### B. Osobno (w dwóch terminalach)

**Terminal 1 — backend:**
```bash
python -m backend.server
```

**Terminal 2 — frontend:**
```bash
npm run dev
```

### C. Tylko backend (np. do testów API)

```bash
python -m backend.server
```

Następnie sprawdź:
```bash
curl http://localhost:8000/api/health
```

---

## 6. Pierwsze uruchomienie — co się dzieje

Przy starcie backendu:
1. Ładowane są pliki `.txt` z `data/knowledge_base/<id_postaci>/`.
2. Jeśli zadziała **sentence-transformers** — budowany jest indeks **FAISS** (embeddingi 384-wymiarowe).
3. Jeśli embedder zawiedzie — RAG przechodzi w tryb zapasowy (dopasowanie słów).

Status można zobaczyć w: `GET http://localhost:8000/api/health`:
- `characters`, `chunks_loaded`, `indexes_built`, `rag_mode`, `embedder_loaded`, `kb_path`, `kb_exists`

Pełny opis pól: `docs/api_contract.md`.

---

## 7. Testy

Z katalogu głównego repozytorium:

```bash
pytest backend/tests/
python -m pytest backend/tests/
```

---

## 8. Problemy i diagnostyka

### Windows / conda — błąd DLL przy ładowaniu transformers (TensorFlow)

Backend na starcie ustawia `USE_TORCH=1` i `TRANSFORMERS_NO_TF=1`, żeby unikać TF. Jeśli nadal są problemy:

```bash
pip uninstall -y tensorflow tensorflow-intel tensorboard
```

### Frontend nie łączy się z backendem

- Sprawdź, czy backend żyje: `curl http://localhost:8000/api/health`.
- Domyślnie front woła `http://localhost:8000`. Możesz nadpisać: `VITE_API_URL=http://inny-host:port`.
- W `vite.config.ts` jest proxy `/api` → `localhost:8000`.

### Brak odpowiedzi / endpoint zwraca 503

- `/api/tts` → ustaw `ENABLE_TTS=true` w `.env` i `OPENAI_API_KEY`.
- `/api/generate-avatar` → ustaw `ENABLE_AVATAR_GENERATION=true` w `.env` i `OPENAI_API_KEY`.

### Logi

- Retrieval: `logs/retrieval.log`
- Historia czatów: `data/chat_history.jsonl`

---

## 9. Zatrzymanie

W każdym terminalu: **Ctrl + C**.

---

## 10. Dodanie nowej postaci (opcjonalnie)

1. Utwórz folder `data/knowledge_base/<id_postaci>/`.
2. Wrzuć pliki `.txt` ze źródłami.
3. Regeneracja konfiguracji postaci:
   ```bash
   python scripts/regen_characters_module.py
   ```
4. Upewnij się, że postać ma `voice_id` (wyliczany z `voiceName` + `VOICE_MAP`).
5. Restart backendu.

---

Dokumentacja techniczna: `docs/ARCHITEKTURA.md`, `docs/STRUKTURA.md`, `docs/api_contract.md`.
