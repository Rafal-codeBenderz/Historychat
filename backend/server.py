#!/usr/bin/env python3
"""
HistoryChat RAG – Backend
Prawdziwy RAG z FAISS + sentence-transformers
"""

import os
import sys
import json
import logging
import datetime
import glob
from pathlib import Path
from typing import Optional
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Setup logging
os.makedirs("logs", exist_ok=True)
os.makedirs("data", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.FileHandler("logs/retrieval.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# RAG Engine
# ─────────────────────────────────────────────
class RAGEngine:
    def __init__(self):
        self.indexes = {}       # character_id -> FAISS index
        self.chunks = {}        # character_id -> list of {"text", "source"}
        self.embedder = None
        self._load_embedder()
        self._build_all_indexes()

    def _load_embedder(self):
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Ładowanie modelu embeddingów: paraphrase-multilingual-MiniLM-L12-v2")
            self.embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
            logger.info("Model embeddingów załadowany pomyślnie.")
        except Exception as e:
            logger.error(f"Błąd ładowania embeddera: {e}")
            self.embedder = None

    def _chunk_text(self, text: str, source: str, chunk_size: int = 300, overlap: int = 50):
        """Dzieli tekst na nakładające się fragmenty."""
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)
            if len(chunk_text.strip()) > 50:
                chunks.append({"text": chunk_text, "source": source})
            i += chunk_size - overlap
        return chunks

    def _build_all_indexes(self):
        """Buduje indeksy wektorowe dla wszystkich postaci."""
        kb_path = Path("data/knowledge_base")
        if not kb_path.exists():
            logger.warning("Brak folderu data/knowledge_base")
            return

        for char_dir in kb_path.iterdir():
            if char_dir.is_dir():
                char_id = char_dir.name
                self._build_index(char_id, char_dir)

    def _build_index(self, char_id: str, char_dir: Path):
        """Buduje indeks FAISS dla jednej postaci."""
        import faiss
        import numpy as np

        all_chunks = []
        for file_path in char_dir.glob("*.txt"):
            source_name = file_path.stem.replace("_", " ").title()
            text = file_path.read_text(encoding="utf-8")
            chunks = self._chunk_text(text, source_name)
            all_chunks.extend(chunks)
            logger.info(f"[{char_id}] Zaindeksowano {len(chunks)} fragmentów z: {file_path.name}")

        if not all_chunks or self.embedder is None:
            logger.warning(f"[{char_id}] Brak chunks lub embeddera – pomijam.")
            return

        texts = [c["text"] for c in all_chunks]
        embeddings = self.embedder.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        embeddings = embeddings.astype(np.float32)

        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)  # Inner Product (cosine po normalizacji)
        
        # Normalizacja do cosine similarity
        faiss.normalize_L2(embeddings)
        index.add(embeddings)

        self.indexes[char_id] = index
        self.chunks[char_id] = all_chunks
        logger.info(f"[{char_id}] Zbudowano indeks FAISS: {len(all_chunks)} fragmentów, dim={dim}")

    def retrieve(self, char_id: str, query: str, top_k: int = 4) -> list:
        """Wyszukuje najtrafniejsze fragmenty dla zapytania."""
        import numpy as np
        
        if char_id not in self.indexes or self.embedder is None:
            logger.warning(f"[{char_id}] Brak indeksu dla tej postaci.")
            return []

        query_vec = self.embedder.encode([query], convert_to_numpy=True).astype(np.float32)
        import faiss
        faiss.normalize_L2(query_vec)

        scores, indices = self.indexes[char_id].search(query_vec, top_k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and score > 0.2:  # próg podobieństwa
                chunk = self.chunks[char_id][idx]
                results.append({
                    "text": chunk["text"],
                    "source": chunk["source"],
                    "score": float(score)
                })

        logger.info(f"[RETRIEVAL] char={char_id} query='{query[:60]}...' znaleziono={len(results)} fragmentów")
        for r in results:
            logger.info(f"  ↳ score={r['score']:.3f} source='{r['source']}' fragment='{r['text'][:80]}...'")

        return results


# ─────────────────────────────────────────────
# Characters Config
# ─────────────────────────────────────────────
CHARACTERS = {
    "copernicus": {
        "id": "copernicus",
        "name": "Mikołaj Kopernik",
        "era": "Renesans (1473–1543)",
        "bio": "Polski astronom i kanonik, twórca rewolucyjnej teorii heliocentrycznej. Autor dzieła 'De revolutionibus orbium coelestium'.",
        "style": "Mów spokojnie, z głęboką erudycją renesansowego uczonego. Używaj łacińskich wtrąceń. Powołuj się na obserwacje astronomiczne i matematykę. Jesteś ostrożny w formułowaniu rewolucyjnych tez – wiesz, jakie ryzyko niosą.",
        "avatar_prompt": "Realistic historical portrait of Nicolaus Copernicus, Polish Renaissance astronomer, holding astronomical instruments, oil painting style, 15th-16th century, candlelight, scholarly robes, Toruń cathedral background",
        "avatar_color": "#1a3a5c",
        "icon": "🌍"
    },
    "marie_curie": {
        "id": "marie_curie",
        "name": "Maria Skłodowska-Curie",
        "era": "Przełom XIX/XX wieku (1867–1934)",
        "bio": "Fizyczka i chemiczka polskiego pochodzenia. Dwukrotna laureatka Nagrody Nobla. Odkryła polon i rad, stworzyła teorię promieniotwórczości.",
        "style": "Mów rzeczowo, naukowo, z pasją do odkryć. Jesteś z Polski, co jest dla Ciebie ważne. Odnoś się do konkretnych eksperymentów i danych. Jesteś skromna, ale pewna wartości swojej pracy.",
        "avatar_prompt": "Realistic historical portrait of Marie Curie, Polish-French physicist and chemist, in a 19th century laboratory, oil painting style, scientific equipment visible, determined expression, Victorian era dress",
        "avatar_color": "#2d4a3e",
        "icon": "⚗️"
    },
    "napoleon": {
        "id": "napoleon",
        "name": "Napoleon Bonaparte",
        "era": "Epoka napoleońska (1769–1821)",
        "bio": "Cesarz Francuzów, wybitny strateg wojskowy i prawodawca. Twórca Kodeksu Napoleona, zdobywca Europy.",
        "style": "Mów z imperatorską pewnością siebie. Jesteś bezpośredni, konkretny, czasem poetycki. Masz wizję wielkiej Francji i Europy. Lubisz odwoływać się do historii i strategii.",
        "avatar_prompt": "Realistic historical portrait of Napoleon Bonaparte, Emperor of France, in military uniform with medals, oil painting style, 19th century, commanding presence, French imperial court background",
        "avatar_color": "#3d2a1a",
        "icon": "⚔️"
    }
}


# ─────────────────────────────────────────────
# Chat History Logger
# ─────────────────────────────────────────────
def save_chat_history(char_id: str, role: str, content: str, sources: list = None):
    entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "character_id": char_id,
        "role": role,
        "content": content,
        "sources": sources or []
    }
    with open("data/chat_history.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


# ─────────────────────────────────────────────
# LLM Client (Gemini)
# ─────────────────────────────────────────────
def build_prompt(character: dict, question: str, fragments: list, history: list) -> str:
    char_name = character["name"]
    char_era = character["era"]
    char_style = character["style"]
    
    # Format history
    history_text = ""
    if history:
        history_text = "\n\nHISTORIA ROZMOWY:\n"
        for msg in history[-6:]:  # ostatnie 3 wymiany
            role_label = "Użytkownik" if msg["role"] == "user" else char_name
            history_text += f"{role_label}: {msg['content']}\n"
    
    # Format fragments
    if fragments:
        fragments_text = "\n\nDOSTĘPNE ŹRÓDŁA (użyj ich jako podstawy odpowiedzi):\n"
        for i, frag in enumerate(fragments, 1):
            fragments_text += f"\n[Fragment {i} – {frag['source']}]\n{frag['text']}\n"
    else:
        fragments_text = "\n\nUWAGA: Brak pasujących fragmentów w bazie wiedzy dla tego pytania."
    
    prompt = f"""Jesteś {char_name}, historyczną postacią z epoki: {char_era}.

INSTRUKCJE CHARAKTERU:
{char_style}

ZASADY ODPOWIADANIA:
1. Odpowiadaj WYŁĄCZNIE w pierwszej osobie, jako {char_name}.
2. Bazuj odpowiedź NA KONKRETNYCH FRAGMENTACH podanych poniżej.
3. Jeśli fragmenty nie zawierają odpowiedzi na pytanie, powiedz: "Nie mam w moich zapiskach informacji na ten temat" lub "Nie pamiętam tego szczegółu z mojej pracy."
4. NIE wymyślaj faktów spoza podanych fragmentów.
5. Możesz naturalnie odwoływać się do źródła: "Jak pisałem w..." lub "Jak wspominałem w moich listach..."
6. Zachowaj spójność z poprzednimi wypowiedziami w historii rozmowy.
{history_text}
{fragments_text}

PYTANIE UŻYTKOWNIKA: {question}

Odpowiedź {char_name}:"""
    
    return prompt


def call_gemini(prompt: str) -> str:
    """Wywołuje Gemini API."""
    try:
        import google.generativeai as genai
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return "Błąd: Brak klucza API GEMINI_API_KEY w zmiennych środowiskowych."
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Błąd Gemini API: {e}")
        return f"Przepraszam, nie mogę w tej chwili odpowiedzieć. Błąd: {str(e)}"


# ─────────────────────────────────────────────
# Flask Routes
# ─────────────────────────────────────────────
rag_engine = None

@app.before_request
def init_rag():
    global rag_engine
    if rag_engine is None:
        rag_engine = RAGEngine()

@app.route("/api/characters", methods=["GET"])
def get_characters():
    return jsonify(list(CHARACTERS.values()))

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    char_id = data.get("characterId")
    message = data.get("message", "")
    history = data.get("history", [])

    if char_id not in CHARACTERS:
        return jsonify({"error": "Nieznana postać"}), 400

    character = CHARACTERS[char_id]
    
    # RAG Retrieval
    fragments = rag_engine.retrieve(char_id, message, top_k=4)
    
    # Build prompt & call LLM
    prompt = build_prompt(character, message, fragments, history)
    answer = call_gemini(prompt)
    
    # Log history
    save_chat_history(char_id, "user", message)
    save_chat_history(char_id, "assistant", answer, [f["source"] for f in fragments])
    
    return jsonify({
        "answer": answer,
        "fragments": fragments,
        "character": character
    })

@app.route("/api/history/<char_id>", methods=["GET"])
def get_history(char_id):
    """Pobiera historię rozmów dla postaci."""
    history = []
    history_file = Path("data/chat_history.jsonl")
    if history_file.exists():
        with open(history_file, encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("character_id") == char_id:
                        history.append(entry)
                except:
                    pass
    return jsonify(history)

@app.route("/api/history/<char_id>/clear", methods=["DELETE"])
def clear_history(char_id):
    """Czyści historię dla danej postaci."""
    history_file = Path("data/chat_history.jsonl")
    if history_file.exists():
        lines = []
        with open(history_file, encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("character_id") != char_id:
                        lines.append(line)
                except:
                    lines.append(line)
        with open(history_file, "w", encoding="utf-8") as f:
            f.writelines(lines)
    return jsonify({"success": True})

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "characters": list(CHARACTERS.keys()),
        "indexes_built": list(rag_engine.indexes.keys()) if rag_engine else []
    })

if __name__ == "__main__":
    logger.info("Uruchamianie HistoryChat RAG Backend...")
    rag_engine = RAGEngine()
    app.run(host="0.0.0.0", port=8000, debug=False)
