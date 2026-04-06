import datetime
import hashlib
import json
import logging
import os

from flask import jsonify, request

from backend.api import api
from backend.config.paths import CHAT_HISTORY_PATH, KB_PATH
from backend.core.characters import CHARACTERS

logger = logging.getLogger(__name__)

_topics_sources_validated = False


@api.before_app_request
def enterprise_request_guards():
    """API key auth and optional daily budget for costly endpoints (before other hooks)."""
    from backend.config.auth import api_auth_enabled, path_requires_api_auth, validate_request_api_key
    from backend.services.daily_budget import check_and_consume_budget, should_apply_budget_to_request

    path = request.path or ""
    method = request.method or ""

    if not path_requires_api_auth(path, method):
        return None

    if api_auth_enabled():
        ok, err = validate_request_api_key()
        if not ok:
            return jsonify({"error": err}), 401

    if should_apply_budget_to_request(path, method):
        allowed, berr = check_and_consume_budget()
        if not allowed:
            return jsonify({"error": berr}), 429

    return None


def validate_suggested_topic_sources():
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
                    "suggestedTopics: brak pliku %s dla postaci '%s' (sourceStem=%r)",
                    expected,
                    cid,
                    stem,
                )


def _chat_history_persistence_enabled() -> bool:
    return os.environ.get("ENABLE_CHAT_HISTORY", "false").lower() in {"1", "true", "yes"}


def save_chat_history(char_id: str, role: str, content: str, sources: list | None = None):
    if not _chat_history_persistence_enabled():
        return
    entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "character_id": char_id,
        "role": role,
        "content": content,
        "sources": sources or [],
    }
    CHAT_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CHAT_HISTORY_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def fingerprint_text(text: str) -> str:
    b = (text or "").strip().encode("utf-8", errors="ignore")
    if not b:
        return "empty"
    return hashlib.sha256(b).hexdigest()[:12]


@api.before_app_request
def init_once():
    global _topics_sources_validated
    # Lazy import: unika ciężkiego importu rag_engine przy imporcie całego pakietu api (pytest, tooling).
    from backend.core.rag_engine import get_engine

    _ = get_engine()
    if not _topics_sources_validated:
        validate_suggested_topic_sources()
        _topics_sources_validated = True
