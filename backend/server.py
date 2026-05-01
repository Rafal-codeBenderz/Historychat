#!/usr/bin/env python3
"""
HistoryChat RAG – Backend (refactored entrypoint).
Keeps the same HTTP API while splitting implementation into modules.
"""

import logging
import os

from dotenv import load_dotenv
from flask import Flask
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


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(api_blueprint)

    return app


app = create_app()


if __name__ == "__main__":
    logger.info("Uruchamianie HistoryChat RAG Backend...")
    app.run(host="0.0.0.0", port=8000, debug=False)
