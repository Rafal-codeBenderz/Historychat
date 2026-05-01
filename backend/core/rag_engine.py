import datetime
import logging
import os
import re
import threading
import unicodedata
from pathlib import Path
from typing import Optional

import numpy as np

from backend.config.paths import KB_PATH
from backend.config.rag_config import CHUNK_OVERLAP, CHUNK_SIZE, MAX_FRAGMENTS, SIMILARITY_THRESHOLD

try:
    import faiss  # type: ignore
except Exception as faiss_import_error:  # pragma: no cover - environment-dependent
    faiss = None
    FAISS_IMPORT_ERROR = faiss_import_error
else:
    FAISS_IMPORT_ERROR = None

try:
    import torch  # type: ignore
except Exception as torch_import_error:  # pragma: no cover - environment-dependent
    torch = None
    TORCH_IMPORT_ERROR = torch_import_error
else:
    TORCH_IMPORT_ERROR = None

logger = logging.getLogger(__name__)


class RAGEngine:
    def __init__(self):
        self.indexes = {}  # character_id -> FAISS index
        self.chunks = {}  # character_id -> list of {"text", "source"}
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
            if torch is None:
                logger.error(
                    "Błąd ładowania PyTorch (wymagany przez sentence-transformers): %s",
                    TORCH_IMPORT_ERROR,
                )
                self.embedder = None
                return
            logger.info("PyTorch wersja: %s", getattr(torch, "__version__", "unknown"))

            from sentence_transformers import SentenceTransformer

            logger.info("Ładowanie modelu embeddingów: paraphrase-multilingual-MiniLM-L12-v2")
            self.embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
            logger.info("Model embeddingów załadowany pomyślnie.")
        except ImportError as e:
            logger.error("Błąd importu biblioteki (sentence-transformers / zależności): %s", e)
            self.embedder = None
        except Exception as e:
            logger.error("Błąd ładowania embeddera: %s", e)
            logger.error("Typ błędu: %s", type(e).__name__)
            self.embedder = None

    def _chunk_text(self, text: str, source: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk_words = words[i : i + chunk_size]
            chunk_text = " ".join(chunk_words)
            if len(chunk_text.strip()) > 50:
                chunks.append({"text": chunk_text, "source": source})
            i += chunk_size - overlap
        return chunks

    def _build_all_indexes(self):
        kb_path = KB_PATH
        if not kb_path.exists():
            logger.warning("Brak folderu knowledge_base: %s", kb_path)
            return

        for char_dir in kb_path.iterdir():
            if char_dir.is_dir():
                char_id = char_dir.name
                self._build_index(char_id, char_dir)

    def _build_index(self, char_id: str, char_dir: Path):
        all_chunks = []
        for file_path in char_dir.glob("*.txt"):
            source_name = file_path.stem.replace("_", " ").title()
            text = file_path.read_text(encoding="utf-8")
            chunks = self._chunk_text(text, source_name)
            all_chunks.extend(chunks)
            logger.info("[%s] Zaindeksowano %s fragmentów z: %s", char_id, len(chunks), file_path.name)

        if not all_chunks:
            logger.warning("[%s] Brak treści .txt — pomijam.", char_id)
            return

        self.chunks[char_id] = all_chunks

        if self.embedder is None:
            logger.warning(
                "[%s] Brak embeddera — chunki w pamięci (%s), wyszukiwanie po słowach.",
                char_id,
                len(all_chunks),
            )
            return
        if faiss is None:
            logger.warning(
                "[%s] Brak FAISS (%s) — chunki w pamięci (%s), wyszukiwanie po słowach.",
                char_id,
                FAISS_IMPORT_ERROR,
                len(all_chunks),
            )
            return

        texts = [c["text"] for c in all_chunks]
        embeddings = self.embedder.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        embeddings = embeddings.astype(np.float32)

        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)
        faiss.normalize_L2(embeddings)
        index.add(embeddings)
        self.indexes[char_id] = index
        logger.info("[%s] Zbudowano indeks FAISS: %s fragmentów, dim=%s", char_id, len(all_chunks), dim)

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
        chunks = self.chunks[char_id]
        q_words = self._word_set(query)
        target = self._normalize_source_stem(source_stem) if source_stem else None

        pool = self._keyword_pool(chunks, q_words, target)
        if not pool and target is not None:
            pool = self._keyword_pool(chunks, q_words, None)

        pool.sort(key=lambda x: (-x[0], x[1]))
        picked = pool[:top_k] if pool else []
        if not picked:
            picked = [(0, i, ch) for i, ch in enumerate(chunks[:top_k])]

        results = []
        for overlap, _i, ch in picked[:top_k]:
            base = 0.35 + min(overlap, 8) * 0.08 if overlap else 0.22
            results.append({"text": ch["text"], "source": ch["source"], "score": min(0.95, base)})

        logger.info(
            "[RETRIEVAL-keyword] char=%s query='%s...' znaleziono=%s fragmentów",
            char_id,
            (query or "")[:60],
            len(results),
        )
        return results

    def _keyword_pool(self, chunks: list, q_words: set, stem: Optional[str]) -> list:
        out = []
        for i, ch in enumerate(chunks):
            if stem is not None and self._stem_from_chunk_source(ch["source"]) != stem:
                continue
            c_words = self._word_set(ch["text"])
            overlap = len(q_words & c_words) if q_words else 0
            out.append((overlap, i, ch))
        return out

    def _pack_results(self, char_id: str, pairs: list) -> list:
        out = []
        for score, idx in pairs:
            if idx < 0:
                continue
            chunk = self.chunks[char_id][idx]
            out.append({"text": chunk["text"], "source": chunk["source"], "score": float(score)})
        return out

    @staticmethod
    def _normalize_source_stem(stem: str) -> str:
        s = unicodedata.normalize("NFC", stem.strip())
        if s.lower().endswith(".txt"):
            s = Path(s).stem
        return unicodedata.normalize("NFC", s).lower().replace("-", "_")

    @staticmethod
    def _stem_from_chunk_source(display_source: str) -> str:
        return unicodedata.normalize("NFC", display_source).lower().replace(" ", "_")

    def retrieve(
        self,
        char_id: str,
        query: str,
        top_k: int = MAX_FRAGMENTS,
        source_stem: Optional[str] = None,
    ) -> list:
        if char_id not in self.chunks:
            logger.warning("[%s] Brak załadowanych chunków (baza wiedzy?).", char_id)
            return []

        if char_id not in self.indexes or self.embedder is None or faiss is None:
            return self._retrieve_keyword(char_id, query, top_k, source_stem)

        query_vec = self.embedder.encode([query], convert_to_numpy=True).astype(np.float32)

        faiss.normalize_L2(query_vec)

        index = self.indexes[char_id]
        n_total = index.ntotal

        if source_stem:
            target = self._normalize_source_stem(source_stem)
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
                results = self._pack_results(char_id, filtered[:top_k])
                logger.info(
                    "[RETRIEVAL] char=%s source_stem=%s query='%s...' znaleziono=%s fragmentów (filtrowane)",
                    char_id,
                    target,
                    (query or "")[:60],
                    len(results),
                )
                return results
            logger.warning(
                "[%s] Brak chunków dla source_stem='%s' — fallback globalny.",
                char_id,
                target,
            )

        search_k = min(max(top_k * 4, 16), n_total)
        scores, indices = index.search(query_vec, search_k)
        candidates = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            s = float(score)
            if s != s:
                continue
            chunk = self.chunks[char_id][idx]
            candidates.append({"text": chunk["text"], "source": chunk["source"], "score": s})

        above = [c for c in candidates if c["score"] > SIMILARITY_THRESHOLD]
        results = above[:top_k]
        if not results and candidates:
            results = candidates[:top_k]
            logger.info(
                "[RETRIEVAL] char=%s query='%s...' fallback best-effort (kandydatów=%s)",
                char_id,
                (query or "")[:60],
                len(candidates),
            )

        logger.info(
            "[RETRIEVAL] char=%s query='%s...' znaleziono=%s fragmentów",
            char_id,
            (query or "")[:60],
            len(results),
        )
        return results


_engine: Optional[RAGEngine] = None
_engine_lock = threading.Lock()


def peek_engine() -> Optional[RAGEngine]:
    """Zwraca silnik bez inicjalizacji — do szybkiego /health (unika wolnego pierwszego requestu)."""
    return _engine


def get_engine() -> RAGEngine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = RAGEngine()
    return _engine

