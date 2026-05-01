"""Testy RAG: normalizacja stemów, chunking, retrieval keyword (deterministyczny, bez heavy modelu)."""

from backend.config import rag_config as rc
from backend.core.rag_engine import RAGEngine


def _keyword_engine(char_id: str, chunk_rows: list):
    """Silnik bez __init__: tylko ścieżka keyword (brak indeksu FAISS / embeddera)."""
    eng = object.__new__(RAGEngine)
    eng.embedder = None
    eng.indexes = {}
    eng.chunks = {char_id: chunk_rows}
    return eng


def test_normalize_source_stem_strips_txt_and_normalizes():
    assert RAGEngine._normalize_source_stem("de_revolutionibus.txt") == "de_revolutionibus"
    assert RAGEngine._normalize_source_stem(" De-Revolutionibus ") == "de_revolutionibus"


def test_stem_from_chunk_source_is_space_to_underscore_lower():
    assert RAGEngine._stem_from_chunk_source("De Revolutionibus") == "de_revolutionibus"


def test_chunk_text_handles_empty_and_short_text():
    eng = object.__new__(RAGEngine)
    assert eng._chunk_text("", "X") == []
    assert eng._chunk_text("a b c", "X") == []


def test_chunk_text_skips_below_min_length_uses_config():
    eng = object.__new__(RAGEngine)
    # Warunek w silniku: len(strip) > MIN_CHUNK_TEXT_LEN
    boundary = "a" * rc.MIN_CHUNK_TEXT_LEN
    assert len(boundary) == rc.MIN_CHUNK_TEXT_LEN
    assert eng._chunk_text(boundary, "S") == []
    above = "a" * (rc.MIN_CHUNK_TEXT_LEN + 5)
    out = eng._chunk_text(above, "Src", chunk_size=300, overlap=0)
    assert len(out) == 1 and len(out[0]["text"].strip()) > rc.MIN_CHUNK_TEXT_LEN


def test_chunk_text_produces_overlapping_chunks():
    eng = object.__new__(RAGEngine)
    words = ["word"] * 200
    text = " ".join(words)
    chunks = eng._chunk_text(text, "Source", chunk_size=60, overlap=10)
    assert len(chunks) >= 2
    assert all("text" in c and "source" in c for c in chunks)


def test_retrieve_unknown_character_returns_empty():
    eng = _keyword_engine("x", [])
    assert eng.retrieve("missing", "query", top_k=3) == []


def test_retrieve_keyword_source_stem_filters_to_matching_source():
    rows = [
        {"text": "apple banana " * 15, "source": "Book Alpha"},
        {"text": "zebra yawn " * 15, "source": "Book Beta"},
    ]
    eng = _keyword_engine("c1", rows)
    r = eng.retrieve("c1", "apple zebra", top_k=2, source_stem="book_alpha")
    assert len(r) >= 1
    assert all("Alpha" in x["source"] or x["source"] == "Book Alpha" for x in r)


def test_retrieve_keyword_fallback_when_stem_matches_no_chunk():
    """Żaden chunk nie pasuje do stem — pusty filtr → fallback globalny keyword pool."""
    rows = [
        {"text": "uniquefoo uniquefoo " * 12, "source": "Only Here"},
        {"text": "otherbar otherbar " * 12, "source": "Other Doc"},
    ]
    eng = _keyword_engine("c1", rows)
    r = eng.retrieve("c1", "uniquefoo", top_k=2, source_stem="nonexistent_xyz_stem")
    assert any("Only Here" in x["source"] for x in r)


def test_retrieve_keyword_deterministic_same_query_twice():
    rows = [{"text": "quantum field " * 14, "source": "S One"}, {"text": "classical wave " * 14, "source": "S Two"}]
    eng = _keyword_engine("c1", rows)
    a = eng.retrieve("c1", "quantum classical", top_k=2)
    b = eng.retrieve("c1", "quantum classical", top_k=2)
    assert a == b
    assert [x["source"] for x in a] == [x["source"] for x in b]


def test_keyword_pool_respects_stem():
    eng = object.__new__(RAGEngine)
    chunks = [
        {"text": "a b c d e f g h i j k l m n o p q r s t u v w x y z", "source": "Doc A"},
        {"text": "a b c d e f g h i j k l m n o p q r s t u v w x y z", "source": "Doc B"},
    ]
    stem_a = RAGEngine._stem_from_chunk_source("Doc A")
    pool = eng._keyword_pool(chunks, {"a", "b"}, stem_a)
    assert len(pool) == 1
    assert pool[0][2]["source"] == "Doc A"
