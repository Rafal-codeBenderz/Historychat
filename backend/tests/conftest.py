"""
Test defaults: synchronous RAG (no async warmup thread) so health/chat tests are deterministic.
"""
import os

# Must be set before `backend.server` is imported anywhere in the suite.
os.environ.setdefault("HISTORYCHAT_RAG_WARMUP", "0")
