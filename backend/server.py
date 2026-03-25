#!/usr/bin/env python3
"""
HistoryChat RAG – Backend
Prawdziwy RAG z FAISS + sentence-transformers
"""

import os
import re
import sys
import json
import logging
import datetime
import glob
import unicodedata
from pathlib import Path
from typing import Optional
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv

# Zanim załaduje się transformers/sentence-transformers: wymuś PyTorch, omijaj TensorFlow
# (na Windows/conda częsty błąd DLL tensorflow → bez tego ST nie ładuje się i RAG zwracał puste źródła).
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

# Load environment variables from .env (project root, then cwd)
_ROOT = Path(__file__).resolve().parent.parent
LOGS_DIR = _ROOT / "logs"
DATA_DIR = _ROOT / "data"
KB_PATH = DATA_DIR / "knowledge_base"
CHAT_HISTORY_PATH = DATA_DIR / "chat_history.jsonl"

load_dotenv(_ROOT / ".env")
load_dotenv()

# Setup logging (ścieżki względem katalogu projektu, nie CWD)
os.makedirs(LOGS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[
        logging.FileHandler(str(LOGS_DIR / "retrieval.log")),
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
        logger.info(
            "RAG init: KB_PATH=%s exists=%s embedder_ok=%s faiss_chars=%s chunks_chars=%s",
            KB_PATH,
            KB_PATH.is_dir(),
            self.embedder is not None,
            list(self.indexes.keys()),
            list(self.chunks.keys()),
        )
        if self.chunks and not self.indexes:
            logger.warning(
                "Tryb RAG bez FAISS — używane jest dopasowanie słów (zepsuty import embeddera?)."
            )

    def _load_embedder(self):
        try:
            # Try to import torch first to catch DLL errors early
            try:
                import torch
                logger.info(f"PyTorch wersja: {torch.__version__}")
            except Exception as torch_error:
                logger.error(f"Błąd ładowania PyTorch (wymagany przez sentence-transformers): {torch_error}")
                logger.error("Rozwiązanie: Zainstaluj Visual C++ Redistributables lub przeinstaluj PyTorch:")
                logger.error("  pip uninstall torch torchvision torchaudio")
                logger.error("  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu")
                self.embedder = None
                return
            
            from sentence_transformers import SentenceTransformer
            logger.info("Ładowanie modelu embeddingów: paraphrase-multilingual-MiniLM-L12-v2")
            self.embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
            logger.info("Model embeddingów załadowany pomyślnie.")
        except ImportError as e:
            logger.error("Błąd importu biblioteki (sentence-transformers / zależności): %s", e)
            logger.error(
                "RAG użyje trybu zapasowego (słowa kluczowe). Aby włączyć pełne embeddingi: "
                "pip install -r requirements.txt — jeśli pojawia się TensorFlow DLL: "
                "pip uninstall -y tensorflow tensorflow-intel tensorboard"
            )
            self.embedder = None
        except Exception as e:
            logger.error(f"Błąd ładowania embeddera: {e}")
            logger.error("Typ błędu: " + type(e).__name__)
            logger.error(
                "Przy błędzie TensorFlow DLL: pip uninstall -y tensorflow tensorflow-intel"
            )
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
        kb_path = KB_PATH
        if not kb_path.exists():
            logger.warning("Brak folderu knowledge_base: %s", kb_path)
            return

        for char_dir in kb_path.iterdir():
            if char_dir.is_dir():
                char_id = char_dir.name
                self._build_index(char_id, char_dir)

    def _build_index(self, char_id: str, char_dir: Path):
        """Ładuje chunki z plików; buduje FAISS tylko gdy działa embedder."""
        import faiss
        import numpy as np

        all_chunks = []
        for file_path in char_dir.glob("*.txt"):
            source_name = file_path.stem.replace("_", " ").title()
            text = file_path.read_text(encoding="utf-8")
            chunks = self._chunk_text(text, source_name)
            all_chunks.extend(chunks)
            logger.info(f"[{char_id}] Zaindeksowano {len(chunks)} fragmentów z: {file_path.name}")

        if not all_chunks:
            logger.warning(f"[{char_id}] Brak treści .txt — pomijam.")
            return

        self.chunks[char_id] = all_chunks

        if self.embedder is None:
            logger.warning(
                f"[{char_id}] Brak embeddera — chunki w pamięci ({len(all_chunks)}), wyszukiwanie po słowach."
            )
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
        logger.info(f"[{char_id}] Zbudowano indeks FAISS: {len(all_chunks)} fragmentów, dim={dim}")

    @staticmethod
    def _word_set(text: str) -> set:
        t = unicodedata.normalize("NFC", text.lower())
        return set(re.findall(r"\w+", t, flags=re.UNICODE))

    def _retrieve_keyword(
        self,
        char_id: str,
        query: str,
        top_k: int,
        source_stem: Optional[str],
    ) -> list:
        """Gdy brak FAISS: wybór fragmentów po pokryciu słów z zapytania (PL/Unicode)."""
        chunks = self.chunks[char_id]
        q_words = self._word_set(query)
        target = self._normalize_source_stem(source_stem) if source_stem else None

        def pool_for_stem(stem: Optional[str]):
            out = []
            for i, ch in enumerate(chunks):
                if stem is not None:
                    if self._stem_from_chunk_source(ch["source"]) != stem:
                        continue
                c_words = self._word_set(ch["text"])
                overlap = len(q_words & c_words) if q_words else 0
                out.append((overlap, i, ch))
            return out

        pool = pool_for_stem(target)
        if not pool and target is not None:
            pool = pool_for_stem(None)

        pool.sort(key=lambda x: (-x[0], x[1]))
        picked = pool[:top_k] if pool else []
        if not picked:
            picked = [(0, i, ch) for i, ch in enumerate(chunks[:top_k])]

        results = []
        for overlap, _i, ch in picked[:top_k]:
            base = 0.35 + min(overlap, 8) * 0.08 if overlap else 0.22
            results.append(
                {"text": ch["text"], "source": ch["source"], "score": min(0.95, base)}
            )

        logger.info(
            f"[RETRIEVAL-keyword] char={char_id} query='{query[:60]}...' znaleziono={len(results)} fragmentów"
        )
        return results

    @staticmethod
    def _normalize_source_stem(stem: str) -> str:
        """Stem pliku .txt (np. de_revolutionibus) — spójny z porównaniem do chunk['source']."""
        s = unicodedata.normalize("NFC", stem.strip())
        if s.lower().endswith(".txt"):
            s = Path(s).stem
        return unicodedata.normalize("NFC", s).lower().replace("-", "_")

    @staticmethod
    def _stem_from_chunk_source(display_source: str) -> str:
        """Odwrotność: file_path.stem.replace('_',' ').title() -> stem do porównań."""
        return unicodedata.normalize("NFC", display_source).lower().replace(" ", "_")

    def retrieve(
        self,
        char_id: str,
        query: str,
        top_k: int = 4,
        source_stem: Optional[str] = None,
    ) -> list:
        """Wyszukuje najtrafniejsze fragmenty. Opcjonalnie preferuje chunki z jednego pliku (source_stem)."""
        import numpy as np

        if char_id not in self.chunks:
            logger.warning(f"[{char_id}] Brak załadowanych chunków (baza wiedzy?).")
            return []

        if char_id not in self.indexes or self.embedder is None:
            return self._retrieve_keyword(char_id, query, top_k, source_stem)

        query_vec = self.embedder.encode([query], convert_to_numpy=True).astype(np.float32)
        import faiss
        faiss.normalize_L2(query_vec)

        index = self.indexes[char_id]
        n_total = index.ntotal

        def pack_results(pairs: list) -> list:
            out = []
            for score, idx in pairs:
                if idx < 0:
                    continue
                chunk = self.chunks[char_id][idx]
                out.append(
                    {
                        "text": chunk["text"],
                        "source": chunk["source"],
                        "score": float(score),
                    }
                )
            return out

        if source_stem:
            target = self._normalize_source_stem(source_stem)
            # Cały indeks: fragmenty z wskazanego pliku mogłyby nie wejść w wąskie top-N globalnie
            search_k = n_total
            scores, indices = index.search(query_vec, search_k)
            filtered = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0:
                    continue
                ch = self.chunks[char_id][idx]
                if self._stem_from_chunk_source(ch["source"]) == target:
                    filtered.append((float(score), idx))
            if filtered:
                filtered.sort(key=lambda x: -x[0])
                results = pack_results(filtered[:top_k])
                logger.info(
                    f"[RETRIEVAL] char={char_id} source_stem={target} query='{query[:60]}...' "
                    f"znaleziono={len(results)} fragmentów (filtrowane)"
                )
                for r in results:
                    logger.info(
                        f"  -> score={r['score']:.3f} source='{r['source']}' fragment='{r['text'][:80]}...'"
                    )
                return results
            logger.warning(
                f"[{char_id}] Brak chunków dla source_stem='{target}' wśród kandydatów — fallback globalny."
            )

        # Szersze top-N niż samo top_k: przy top_k=4 często wszystkie cosine < 0.2 mimo sensownych trafień
        search_k = min(max(top_k * 4, 16), n_total)
        scores, indices = index.search(query_vec, search_k)
        candidates = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            s = float(score)
            if s != s:  # NaN z zerowego wektora zapytania itp.
                continue
            chunk = self.chunks[char_id][idx]
            candidates.append(
                {
                    "text": chunk["text"],
                    "source": chunk["source"],
                    "score": s,
                }
            )

        above = [c for c in candidates if c["score"] > 0.2]
        results = above[:top_k]
        if not results and candidates:
            results = candidates[:top_k]
            logger.info(
                f"[RETRIEVAL] char={char_id} query='{query[:60]}...' "
                f"fallback best-effort (brak wyników powyżej progu 0.2, kandydatów={len(candidates)})"
            )

        logger.info(
            f"[RETRIEVAL] char={char_id} query='{query[:60]}...' znaleziono={len(results)} fragmentów"
        )
        for r in results:
            logger.info(
                f"  -> score={r['score']:.3f} source='{r['source']}' fragment='{r['text'][:80]}...'"
            )

        return results


# ─────────────────────────────────────────────
# Voice Mapping for TTS
# ─────────────────────────────────────────────
VOICE_MAP = {
    "Charon": "echo",      # Kopernik
    "Kore": "nova",        # Curie, Kleopatra, Joanna
    "Fenrir": "fable",     # Napoleon
    "Zephyr": "shimmer",   # da Vinci
    "Puck": "alloy"        # Einstein
}

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
        "icon": "🌍",
        "voiceName": "Charon",
        "suggestedTopics": [
            {"question": "Co sądzisz o teorii heliocentrycznej?", "sourceStem": "de_revolutionibus"},
            {"question": "Jak doszedłeś do swoich odkryć?", "sourceStem": "de_revolutionibus"},
            {"question": "Dlaczego bałeś się opublikować swoje dzieło?", "sourceStem": "de_revolutionibus"},
            {"question": "Jakie były Twoje obserwacje we Fromborku?", "sourceStem": "de_revolutionibus"},
        ]
    },
    "marie_curie": {
        "id": "marie_curie",
        "name": "Maria Skłodowska-Curie",
        "era": "Przełom XIX/XX wieku (1867–1934)",
        "bio": "Fizyczka i chemiczka polskiego pochodzenia. Dwukrotna laureatka Nagrody Nobla. Odkryła polon i rad, stworzyła teorię promieniotwórczości.",
        "style": "Mów rzeczowo, naukowo, z pasją do odkryć. Jesteś z Polski, co jest dla Ciebie ważne. Odnoś się do konkretnych eksperymentów i danych. Jesteś skromna, ale pewna wartości swojej pracy.",
        "avatar_prompt": "Realistic historical portrait of Marie Curie, Polish-French physicist and chemist, in a 19th century laboratory, oil painting style, scientific equipment visible, determined expression, Victorian era dress",
        "avatar_color": "#2d4a3e",
        "icon": "⚗️",
        "voiceName": "Kore",
        "suggestedTopics": [
            {"question": "Jak odkryłaś promieniotwórczość?", "sourceStem": "pisma_i_listy"},
            {"question": "Jak to było być kobietą-naukowcem?", "sourceStem": "pisma_i_listy"},
            {"question": "Opowiedz o odkryciu polonu i radu.", "sourceStem": "pisma_i_listy"},
            {"question": "Jak wyglądała Twoja praca podczas I wojny światowej?", "sourceStem": "pisma_i_listy"},
        ]
    },
    "napoleon": {
        "id": "napoleon",
        "name": "Napoleon Bonaparte",
        "era": "Epoka napoleońska (1769–1821)",
        "bio": "Cesarz Francuzów, wybitny strateg wojskowy i prawodawca. Twórca Kodeksu Napoleona, zdobywca Europy.",
        "style": "Mów z imperatorską pewnością siebie. Jesteś bezpośredni, konkretny, czasem poetycki. Masz wizję wielkiej Francji i Europy. Lubisz odwoływać się do historii i strategii.",
        "avatar_prompt": "Realistic historical portrait of Napoleon Bonaparte, Emperor of France, in military uniform with medals, oil painting style, 19th century, commanding presence, French imperial court background",
        "avatar_color": "#3d2a1a",
        "icon": "⚔️",
        "voiceName": "Fenrir",
        "suggestedTopics": [
            {"question": "Dlaczego kampania rosyjska się nie powiodła?", "sourceStem": "korespondencja_wspomnienia"},
            {"question": "Co uważasz za swoje największe osiągnięcie?", "sourceStem": "korespondencja_wspomnienia"},
            {"question": "Jak wyglądało Twoje wygnanie na Świętej Helenie?", "sourceStem": "korespondencja_wspomnienia"},
            {"question": "Opowiedz o Kodeksie Napoleona.", "sourceStem": "korespondencja_wspomnienia"},
        ]
    },
    "da_vinci": {
        "id": "da_vinci",
        "name": "Leonardo da Vinci",
        "era": "Renesans (1452–1519)",
        "bio": "Polihistor Renesansu, malarz, wynalazca i wizjoner wyprzedzający swoją epokę. Autor Mony Lisy i Ostatniej Wieczerzy.",
        "style": "Mów z nieskończoną ciekawością świata i artystyczną wrażliwością. Jesteś ciekaw wszystkiego - od anatomii po maszyny latające. Używasz metafor i obrazów. Jesteś skromny, ale świadomy swojego geniuszu.",
        "avatar_prompt": "Realistic historical portrait of Leonardo da Vinci, 60-year-old artist and inventor, long white beard, wise eyes, Renaissance velvet robes, studio background with flying machine sketches, oil painting style, soft natural lighting",
        "avatar_color": "#8b7355",
        "icon": "🎨",
        "voiceName": "Zephyr",
        "suggestedTopics": [
            {"question": "Tajemnica uśmiechu Mony Lisy", "sourceStem": "notatniki_i_dzieła"},
            {"question": "Twoje projekty maszyn latających", "sourceStem": "notatniki_i_dzieła"},
            {"question": "Studia nad anatomią człowieka", "sourceStem": "notatniki_i_dzieła"},
            {"question": "Ostatnia Wieczerza i jej symbolika", "sourceStem": "notatniki_i_dzieła"},
        ]
    },
    "cleopatra": {
        "id": "cleopatra",
        "name": "Kleopatra VII",
        "era": "Starożytność (69–30 p.n.e.)",
        "bio": "Ostatnia władczyni hellenistycznego Egiptu, ikona inteligencji i władzy. Znana z sojuszy z Juliuszem Cezarem i Markiem Antoniuszem.",
        "style": "Mów z godnością królowej i bystrością polityka. Jesteś wykształcona, władcza, ale też kobieca. Używasz retoryki i perswazji. Jesteś świadoma swojej pozycji i władzy.",
        "avatar_prompt": "Realistic historical portrait of Cleopatra VII, 30-year-old Egyptian queen, regal expression, gold jewelry with lapis lazuli, Ptolemaic crown, palace balcony overlooking the Nile at sunset, oil painting style, golden hour lighting",
        "avatar_color": "#d4af37",
        "icon": "👑",
        "voiceName": "Kore",
        "suggestedTopics": [
            {"question": "Sojusz z Juliuszem Cezarem", "sourceStem": "historia_i_legenda"},
            {"question": "Twoja flota pod Akcjum", "sourceStem": "historia_i_legenda"},
            {"question": "Nauka języków i wykształcenie", "sourceStem": "historia_i_legenda"},
            {"question": "Relacja z Markiem Antoniuszem", "sourceStem": "historia_i_legenda"},
        ]
    },
    "einstein": {
        "id": "einstein",
        "name": "Albert Einstein",
        "era": "XX wiek (1879–1955)",
        "bio": "Twórca teorii względności, symbol geniuszu i pacyfizmu. Laureat Nagrody Nobla z fizyki. Autor słynnego równania E=mc².",
        "style": "Mów z humorem, skromnością i głębokim zrozumieniem wszechświata. Używasz prostych analogii do wyjaśniania skomplikowanych konceptów. Jesteś pacyfistą i humanistą. Lubisz żartować.",
        "avatar_prompt": "Realistic historical portrait of Albert Einstein, 70-year-old scientist, iconic wild hair, gentle eyes, simple sweater, blackboard with complex equations background, oil painting style, warm indoor lighting",
        "avatar_color": "#5f9ea0",
        "icon": "🧪",
        "voiceName": "Puck",
        "suggestedTopics": [
            {"question": "Teoria względności (E=mc²)", "sourceStem": "teoria_i_życie"},
            {"question": "Efekt fotoelektryczny i Nobel", "sourceStem": "teoria_i_życie"},
            {"question": "Twoje poglądy na pacyfizm", "sourceStem": "teoria_i_życie"},
            {"question": "Gra na skrzypcach i miłość do muzyki", "sourceStem": "teoria_i_życie"},
        ]
    },
    "joan_of_arc": {
        "id": "joan_of_arc",
        "name": "Joanna d'Arc",
        "era": "Średniowiecze (1412–1431)",
        "bio": "Dziewica Orleańska, która poprowadziła armię francuską do zwycięstwa podczas Wojny Stuletniej. Spalona na stosie jako heretyczka, później kanonizowana.",
        "style": "Mów z niezłomną wiarą i odwagą. Jesteś prosta, bezpośrednia, ale głęboko wierząca. Odwołujesz się do wizji i głosów świętych. Jesteś gotowa na poświęcenie dla Francji.",
        "avatar_prompt": "Realistic historical portrait of Joan of Arc, 19-year-old warrior, short hair, shining steel armor, holding a white banner, battlefield background with medieval flags, oil painting style, dramatic overcast lighting",
        "avatar_color": "#c0c0c0",
        "icon": "⚔️",
        "voiceName": "Kore",
        "suggestedTopics": [
            {"question": "Głosy świętych w Domrémy", "sourceStem": "życie_i_męczeństwo"},
            {"question": "Oblężenie Orleanu", "sourceStem": "życie_i_męczeństwo"},
            {"question": "Spotkanie z Karolem VII w Chinon", "sourceStem": "życie_i_męczeństwo"},
            {"question": "Twoja zbroja i sztandar", "sourceStem": "życie_i_męczeństwo"},
        ]
    }
}


def validate_suggested_topic_sources():
    """Ostrzeżenie w logu, gdy sourceStem nie ma dopasowanego pliku .txt."""
    kb = KB_PATH
    for cid, ch in CHARACTERS.items():
        char_dir = kb / cid
        for topic in ch.get("suggestedTopics") or []:
            if not isinstance(topic, dict):
                continue
            stem = topic.get("sourceStem")
            if not stem:
                continue
            expected = char_dir / f"{stem}.txt"
            if not expected.is_file():
                logger.warning(
                    f"suggestedTopics: brak pliku {expected} dla postaci '{cid}' (sourceStem={stem!r})"
                )


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
    with open(CHAT_HISTORY_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


# ─────────────────────────────────────────────
# LLM Client (OpenAI lub Gemini)
# ─────────────────────────────────────────────
def build_prompt(
    character: dict,
    question: str,
    fragments: list,
    history: list,
    pinned_source_label: Optional[str] = None,
) -> str:
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
        if pinned_source_label:
            fragments_text += (
                f"\n(Użytkownik wybrał temat powiązany z dziełem / zapisami: „{pinned_source_label}”. "
                "Traktuj poniższe fragmenty jako właściwe źródło do tego pytania.)\n"
            )
        for i, frag in enumerate(fragments, 1):
            fragments_text += f"\n[Fragment {i} – {frag['source']}]\n{frag['text']}\n"
    else:
        fragments_text = "\n\nUWAGA: Brak pasujących fragmentów w bazie wiedzy dla tego pytania."

    rule_when_sources = ""
    if fragments:
        rule_when_sources = (
            "\n7. Poniżej masz co najmniej jeden fragment źródłowy — NIE używaj wtedy frazy o braku zapisków. "
            "Odpowiedz na podstawie tego, co da się wyczytać z fragmentów (nawet ogólnie lub częściowo). "
            "Formułę o braku informacji stosuj WYŁĄCZNIE gdy fragmenty naprawdę nie dotyczą pytania.\n"
        )

    prompt = f"""Jesteś {char_name}, historyczną postacią z epoki: {char_era}.

INSTRUKCJE CHARAKTERU:
{char_style}

ZASADY ODPOWIADANIA:
1. Odpowiadaj WYŁĄCZNIE w pierwszej osobie, jako {char_name}.
2. Bazuj odpowiedź NA KONKRETNYCH FRAGMENTACH podanych poniżej.
3. Jeśli NIE MA żadnych fragmentów albo fragmenty w ogóle nie dotyczą pytania, powiedz: "Nie mam w moich zapiskach informacji na ten temat" lub "Nie pamiętam tego szczegółu z mojej pracy."
4. NIE wymyślaj faktów spoza podanych fragmentów.
5. Możesz naturalnie odwoływać się do źródła: "Jak pisałem w..." lub "Jak wspominałem w moich listach..."
6. Zachowaj spójność z poprzednimi wypowiedziami w historii rozmowy.{rule_when_sources}
{history_text}
{fragments_text}

PYTANIE UŻYTKOWNIKA: {question}

Odpowiedź {char_name}:"""
    
    return prompt


def call_openai(prompt: str) -> str:
    """Wywołuje OpenAI Chat Completions (gpt-4o-mini domyślnie)."""
    try:
        import openai

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return "Błąd: Brak klucza API OPENAI_API_KEY w zmiennych środowiskowych."

        client = openai.OpenAI(api_key=api_key)
        model = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.choices[0].message.content
        return (content or "").strip()
    except Exception as e:
        logger.error(f"Błąd OpenAI API: {e}")
        return f"Przepraszam, nie mogę w tej chwili odpowiedzieć. Błąd: {str(e)}"


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


def call_llm(prompt: str) -> str:
    """Czat: OPENAI_API_KEY ma pierwszeństwo, inaczej GEMINI_API_KEY."""
    if os.environ.get("OPENAI_API_KEY"):
        return call_openai(prompt)
    if os.environ.get("GEMINI_API_KEY"):
        return call_gemini(prompt)
    return (
        "Błąd: Brak klucza API. Dodaj do pliku .env w katalogu projektu "
        "OPENAI_API_KEY=... lub GEMINI_API_KEY=... i uruchom backend ponownie."
    )


# ─────────────────────────────────────────────
# Flask Routes
# ─────────────────────────────────────────────
rag_engine = None
_topics_sources_validated = False


@app.before_request
def init_rag():
    global rag_engine, _topics_sources_validated
    if rag_engine is None:
        rag_engine = RAGEngine()
        if not _topics_sources_validated:
            validate_suggested_topic_sources()
            _topics_sources_validated = True

@app.route("/api/characters", methods=["GET"])
def get_characters():
    return jsonify(list(CHARACTERS.values()))

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    char_id = data.get("characterId")
    message = data.get("message", "")
    history = data.get("history", [])
    source_stem = data.get("sourceStem") or None
    if isinstance(source_stem, str):
        source_stem = source_stem.strip() or None

    if char_id not in CHARACTERS:
        return jsonify({"error": "Nieznana postać"}), 400

    character = CHARACTERS[char_id]

    # RAG Retrieval (opcjonalnie: wąski zakres do jednego pliku .txt)
    fragments = rag_engine.retrieve(
        char_id, message, top_k=4, source_stem=source_stem
    )
    if not fragments and char_id in rag_engine.chunks:
        logger.warning(
            "[chat] char=%s puste fragmenty mimo chunków — query=%r sourceStem=%r",
            char_id,
            (message or "")[:120],
            source_stem,
        )
    elif not fragments and char_id not in rag_engine.chunks:
        logger.warning("[chat] char=%s brak chunków w pamięci (brak plików KB?)", char_id)

    pinned_label = None
    if source_stem:
        pinned_label = Path(source_stem).stem.replace("_", " ").title()

    # Build prompt & call LLM
    prompt = build_prompt(
        character, message, fragments, history, pinned_source_label=pinned_label
    )
    answer = call_llm(prompt)
    
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
    history_file = CHAT_HISTORY_PATH
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
    history_file = CHAT_HISTORY_PATH
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

@app.route("/api/tts", methods=["POST"])
def generate_tts():
    """Generuje audio TTS dla odpowiedzi."""
    try:
        import openai
        import base64
        
        data = request.json
        text = data.get("text", "")
        voice = data.get("voice", "nova")  # Domyślny głos
        
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            logger.warning("Brak OPENAI_API_KEY dla TTS")
            return jsonify({"error": "Brak OPENAI_API_KEY"}), 400
        
        openai_client = openai.OpenAI(api_key=api_key)
        
        response = openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text
        )
        
        # Zwróć audio jako base64
        audio_base64 = base64.b64encode(response.content).decode('utf-8')
        
        logger.info(f"[TTS] Wygenerowano audio dla tekstu o długości {len(text)} znaków, głos: {voice}")
        
        return jsonify({
            "audio": audio_base64,
            "format": "mp3"
        })
    except Exception as e:
        logger.error(f"Błąd TTS: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health():
    eng = rag_engine
    return jsonify({
        "status": "ok",
        "characters": list(CHARACTERS.keys()),
        "indexes_built": list(eng.indexes.keys()) if eng else [],
        "chunks_loaded": list(eng.chunks.keys()) if eng else [],
        "rag_mode": "faiss" if (eng and eng.indexes) else ("keyword" if (eng and eng.chunks) else "off"),
        "embedder_loaded": eng.embedder is not None if eng else False,
        "kb_path": str(KB_PATH),
        "kb_exists": KB_PATH.is_dir(),
    })

if __name__ == "__main__":
    logger.info("Uruchamianie HistoryChat RAG Backend...")
    rag_engine = RAGEngine()
    app.run(host="0.0.0.0", port=8000, debug=False)
