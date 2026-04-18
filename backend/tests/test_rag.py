from backend.core.rag_engine import RAGEngine


def test_normalize_source_stem_strips_txt_and_normalizes():
    assert RAGEngine._normalize_source_stem("de_revolutionibus.txt") == "de_revolutionibus"
    assert RAGEngine._normalize_source_stem(" De-Revolutionibus ") == "de_revolutionibus"


def test_stem_from_chunk_source_is_space_to_underscore_lower():
    assert RAGEngine._stem_from_chunk_source("De Revolutionibus") == "de_revolutionibus"


def test_chunk_text_handles_empty_and_short_text():
    eng = object.__new__(RAGEngine)  # avoid heavy __init__
    assert eng._chunk_text("", "X") == []
    assert eng._chunk_text("a b c", "X") == []


def test_chunk_text_produces_overlapping_chunks():
    eng = object.__new__(RAGEngine)  # avoid heavy __init__
    words = ["word"] * 200
    text = " ".join(words)
    chunks = eng._chunk_text(text, "Source", chunk_size=60, overlap=10)
    assert len(chunks) >= 2
    assert all("text" in c and "source" in c for c in chunks)

