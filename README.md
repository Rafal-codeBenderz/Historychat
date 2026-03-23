# HistoryChat RAG 📜

> Interaktywny system czatowy z awatarami postaci historycznych, oparty na prawdziwym systemie RAG (Retrieval-Augmented Generation).

## Co to jest?

HistoryChat RAG pozwala na rozmowę z postaciami historycznymi (Mikołaj Kopernik, Maria Skłodowska-Curie, Napoleon Bonaparte), których odpowiedzi są generowane **wyłącznie na podstawie autentycznych źródeł historycznych** – listów, publikacji i biografii.

## Architektura

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)           │
│  Wybór postaci → Czat → Wyświetlenie przypisów       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP API
┌──────────────────────▼──────────────────────────────┐
│                    BACKEND (Flask + Python)          │
│                                                      │
│  1. RAG Engine                                       │
│     ├── sentence-transformers (embeddingi)           │
│     ├── FAISS (baza wektorowa)                       │
│     └── Chunking z nakładaniem (overlap)             │
│                                                      │
│  2. LLM Client (Gemini 2.0 Flash)                   │
│     └── Prompt z fragmentami + historia rozmowy      │
│                                                      │
│  3. Logowanie                                        │
│     ├── data/chat_history.jsonl                      │
│     └── logs/retrieval.log                           │
└──────────────────────────────────────────────────────┘
```

## Uruchomienie

### 1. Wymagania
- Python 3.10+
- Node.js 18+

### 2. Backend

```bash
# Zainstaluj zależności Python
pip install -r requirements.txt

# Skopiuj i uzupełnij plik konfiguracyjny
cp .env.example .env
# Edytuj .env i dodaj GEMINI_API_KEY

# Uruchom backend
python backend/server.py
```

Backend uruchomi się na `http://localhost:8000`.
Przy starcie automatycznie zbuduje indeksy FAISS z dokumentów w `data/knowledge_base/`.

### 3. Frontend

```bash
# Zainstaluj zależności Node
npm install

# Uruchom frontend (development)
npm run dev
```

Frontend dostępny na `http://localhost:3000`.

### 4. Jednoczesne uruchomienie

```bash
npm run start
```

## Struktura projektu

```
historychat-rag/
├── backend/
│   └── server.py              # Flask API + RAG Engine + LLM Client
├── data/
│   ├── knowledge_base/        # Dokumenty źródłowe (TXT/PDF)
│   │   ├── copernicus/
│   │   │   └── de_revolutionibus.txt
│   │   ├── marie_curie/
│   │   │   └── pisma_i_listy.txt
│   │   └── napoleon/
│   │       └── korespondencja_wspomnienia.txt
│   └── chat_history.jsonl     # Historia rozmów (generowana runtime)
├── logs/
│   └── retrieval.log          # Log wyszukiwania RAG (generowany runtime)
├── src/
│   ├── App.tsx                # Główny komponent React
│   └── main.tsx               # Entry point
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── requirements.txt
├── .env.example
└── README.md
```

## Jak dodać nową postać?

1. Utwórz folder `data/knowledge_base/<id_postaci>/`
2. Dodaj pliki `.txt` z autentycznymi źródłami
3. Dodaj wpis do słownika `CHARACTERS` w `backend/server.py`
4. Restart backendu – indeks zostanie zbudowany automatycznie

## Jak działa RAG?

1. **Indeksowanie**: Przy starcie, każdy plik TXT jest dzielony na nakładające się fragmenty (chunk_size=300 słów, overlap=50). Każdy fragment jest kodowany przez model `paraphrase-multilingual-MiniLM-L12-v2` do 384-wymiarowego wektora i dodawany do indeksu FAISS.

2. **Retrieval**: Gdy użytkownik zadaje pytanie, jest ono kodowane tym samym modelem. FAISS wyszukuje 4 najbardziej podobne fragmenty (cosine similarity > 0.2).

3. **Generowanie**: Znalezione fragmenty są wkładane do promptu wraz z instrukcjami charakteru postaci i historią rozmowy. Gemini generuje odpowiedź w pierwszej osobie.

4. **Logowanie**: Każdy retrieval jest logowany do `logs/retrieval.log` z informacją o score i źródle.

## Metryki jakości

- ✅ 100% odpowiedzi oparte na fragmentach dokumentów źródłowych
- ✅ Cosine similarity score przy każdym fragmencie
- ✅ Pełna historia rozmów w JSONL do analizy
- ✅ Log retrieval z informacją które dokumenty zostały użyte
- ✅ Komunikat "nie pamiętam" gdy brak pasujących fragmentów

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Framer Motion |
| Backend | Python, Flask, Flask-CORS |
| Embeddingi | sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2) |
| Baza wektorowa | FAISS (IndexFlatIP + L2 normalizacja) |
| LLM | Google Gemini 2.0 Flash |
| Logowanie | JSONL (historia) + plain log (retrieval) |
