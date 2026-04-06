#!/usr/bin/env python3
"""
HistoryChat RAG – Backend (refactored entrypoint).
Keeps the same HTTP API while splitting implementation into modules.
"""

import logging
import os
import uuid

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS

from backend.config.paths import DATA_DIR, LOGS_DIR, ROOT

# Ensure transformers stack doesn't try to pull in TensorFlow on Windows
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

# Load .env before importing limiter (storage URI, auth flags used at init).
load_dotenv(ROOT / ".env", override=True)

from backend.api import api as api_blueprint  # noqa: E402
from backend.config.limiter import limiter  # noqa: E402
from backend.services.metrics import record_request  # noqa: E402

LOGS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(str(LOGS_DIR / "retrieval.log")), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


def _parse_cors_origins(value: str | None) -> list[str]:
    if value is None:
        return []
    raw = str(value).strip()
    if not raw:
        return []
    parts = [p.strip() for p in raw.split(",")]
    return [p for p in parts if p]


def create_app() -> Flask:
    app = Flask(__name__)
    cors_origins = _parse_cors_origins(os.environ.get("CORS_ORIGINS"))
    if cors_origins:
        CORS(app, origins=cors_origins)
    else:
        # Dev-friendly default (previous behavior): allow all origins.
        CORS(app)

    @app.before_request
    def _assign_request_id() -> None:
        if request.path.startswith("/api"):
            g.request_id = (request.headers.get("X-Request-ID") or "").strip() or uuid.uuid4().hex

    storage_uri = (os.environ.get("RATE_LIMIT_STORAGE_URI") or "").strip() or "memory://"
    app.config["RATELIMIT_STORAGE_URI"] = storage_uri
    limiter.init_app(app)

    app.register_blueprint(api_blueprint)

    @app.after_request
    def _api_request_teardown(response):
        if request.path.startswith("/api"):
            rid = getattr(g, "request_id", None)
            if rid:
                response.headers["X-Request-ID"] = str(rid)
            record_request(request.path, request.method, response.status_code)
        return response

    @app.errorhandler(429)
    def _ratelimit_handler(_e):  # type: ignore[override]
        return jsonify({"error": "Zbyt wiele żądań (rate limit)"}), 429

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8000") or "8000")
    logger.info("Uruchamianie HistoryChat RAG Backend na porcie %s...", port)
    app.run(host="0.0.0.0", port=port, debug=False)
