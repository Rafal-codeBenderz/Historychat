import logging
from pathlib import Path

from flask import jsonify, request

from backend.api import api
from backend.api.bootstrap import fingerprint_text, save_chat_history
from backend.config.limiter import limiter
from backend.config.limits import rate_limit_chat, rate_limit_enabled
from backend.core.characters import CHARACTERS
from backend.core.prompting import build_llm_messages
from backend.core.rag_engine import get_engine
from backend.services.llm import call_llm

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 6000
MAX_HISTORY_ITEMS = 40
MAX_HISTORY_ENTRY_LENGTH = 6000
RAG_TOP_K = 4

_ALLOWED_HISTORY_ROLES = frozenset({"user", "assistant"})


def _history_validation_error(history: list):
    """Zwraca (jsonify(...), status) przy błędzie, w przeciwnym razie None."""
    if len(history) > MAX_HISTORY_ITEMS:
        return (
            jsonify({"error": f"Historia ma zbyt wiele wpisów (maks. {MAX_HISTORY_ITEMS})"}),
            422,
        )
    for idx, item in enumerate(history):
        if not isinstance(item, dict):
            return jsonify({"error": f"history[{idx}] musi być obiektem JSON"}), 400
        role = item.get("role")
        content = item.get("content")
        if role not in _ALLOWED_HISTORY_ROLES:
            return (
                jsonify({"error": f"history[{idx}]: pole role musi być \"user\" lub \"assistant\""}),
                400,
            )
        if not isinstance(content, str):
            return jsonify({"error": f"history[{idx}]: pole content musi być stringiem"}), 400
        if len(content) > MAX_HISTORY_ENTRY_LENGTH:
            return jsonify({"error": f"history[{idx}]: treść jest zbyt długa"}), 422
    return None

@api.post("/api/chat")
@limiter.limit(lambda: rate_limit_chat() if rate_limit_enabled() else "1000000 per minute")
def chat():
    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Nieprawidłowe dane wejściowe (JSON)"}), 400

    char_id = data.get("characterId")
    message = data.get("message", "")
    history = data.get("history", [])
    if "sourceStem" in data and data["sourceStem"] is not None and not isinstance(data["sourceStem"], str):
        return jsonify({"error": "Pole sourceStem musi być stringiem"}), 400
    source_stem = data.get("sourceStem") or None
    if isinstance(source_stem, str):
        source_stem = source_stem.strip() or None

    if not char_id or not isinstance(char_id, str):
        return jsonify({"error": "Brak characterId"}), 400
    if char_id not in CHARACTERS:
        return jsonify({"error": "Nieznana postać"}), 400

    if not isinstance(message, str):
        return jsonify({"error": "Pole message musi być stringiem"}), 400
    message = message.strip()
    if not message:
        return jsonify({"error": "Pusta wiadomość"}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": "Wiadomość jest zbyt długa"}), 422

    if not isinstance(history, list):
        return jsonify({"error": "Pole history musi być listą"}), 400
    hist_err = _history_validation_error(history)
    if hist_err is not None:
        body, status = hist_err
        return body, status

    character = CHARACTERS[char_id]
    rag_engine = get_engine()

    fragments = rag_engine.retrieve(char_id, message, top_k=RAG_TOP_K, source_stem=source_stem)
    if not fragments and char_id in rag_engine.chunks:
        logger.warning(
            "[chat] char=%s puste fragmenty mimo chunków — query_len=%s query_fp=%s sourceStem=%r",
            char_id,
            len(message or ""),
            fingerprint_text(message or ""),
            source_stem,
        )
    elif not fragments and char_id not in rag_engine.chunks:
        logger.warning("[chat] char=%s brak chunków w pamięci (brak plików KB?)", char_id)

    pinned_label = None
    if source_stem:
        pinned_label = Path(source_stem).stem.replace("_", " ").title()

    system_message, user_message = build_llm_messages(
        character, message, fragments, history, pinned_source_label=pinned_label
    )
    answer = call_llm(system_message, user_message)

    save_chat_history(char_id, "user", message)
    save_chat_history(char_id, "assistant", answer, [f["source"] for f in fragments])

    return jsonify({"answer": answer, "fragments": fragments, "character": character})
