# Retrieval / chunking defaults (centralizacja — unikamy magic numbers w rag_engine.py)
SIMILARITY_THRESHOLD = 0.2
MAX_FRAGMENTS = 4
CHUNK_SIZE = 300
CHUNK_OVERLAP = 50

# Fragment musi mieć więcej znaków (po strip), żeby trafić do indeksu
MIN_CHUNK_TEXT_LEN = 50

# Punktacja heurystyczna przy wyszukiwaniu po słowach (keyword fallback)
KEYWORD_SCORE_BASE_WITH_OVERLAP = 0.35
KEYWORD_SCORE_PER_OVERLAP = 0.08
KEYWORD_OVERLAP_WORD_CAP = 8
KEYWORD_SCORE_NO_QUERY_OVERLAP = 0.22
KEYWORD_SCORE_CAP = 0.95

# Szerokość okna przy przeszukiwaniu FAISS (przed przycięciem do top_k według progu)
FAISS_SEARCH_TOPK_MULTIPLIER = 4
FAISS_SEARCH_MIN_POOL = 16

# SentenceTransformers — musi być zgodny z modelem załadowanym w rag_engine
EMBEDDING_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
