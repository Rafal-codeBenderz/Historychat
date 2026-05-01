#!/usr/bin/env python3
"""
HistoryChat RAG – Backend (refactored entrypoint).
Keeps the same HTTP API while splitting implementation into modules.
"""

import logging
import os
import threading

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

from backend.api.routes import api as api_blueprint
from backend.config.paths import DATA_DIR, LOGS_DIR, ROOT

# Ensure transformers stack doesn't try to pull in TensorFlow on Windows
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

load_dotenv(ROOT / ".env")
load_dotenv()

LOGS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(str(LOGS_DIR / "retrieval.log")), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


def _start_rag_warmup_background() -> None:
    """Ładuje embedder/indeksy w tle, żeby pierwszy chat nie płacił kosztu cold start."""

    def _worker() -> None:
        try:
            from backend.core.rag_engine import get_engine as _get_engine

            logger.info("RAG warmup (thread): start")
            _get_engine()
            logger.info("RAG warmup (thread): zakończono")
        except Exception:
            logger.exception("RAG warmup (thread): błąd")

    threading.Thread(target=_worker, name="rag-warmup", daemon=True).start()


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(api_blueprint)

    if os.environ.get("HISTORYCHAT_RAG_WARMUP", "1").strip().lower() in {"1", "true", "yes"}:
        _start_rag_warmup_background()

    @app.get("/api/routes")
    def list_routes():
        rules = []
        for r in app.url_map.iter_rules():
            if r.endpoint == "static":
                continue
            methods = sorted(m for m in r.methods if m not in {"HEAD", "OPTIONS"})
            rules.append({"rule": r.rule, "methods": methods})
        rules.sort(key=lambda x: x["rule"])
        return jsonify(rules)

    return app


app = create_app()


if __name__ == "__main__":
    logger.info("Uruchamianie HistoryChat RAG Backend...")
    app.run(host="0.0.0.0", port=8000, debug=False)
