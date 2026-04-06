import json
import logging

from flask import jsonify

from backend.api import api
from backend.config.paths import CHAT_HISTORY_PATH

logger = logging.getLogger(__name__)


@api.get("/api/history/<char_id>")
def get_history(char_id):
    history = []
    history_file = CHAT_HISTORY_PATH
    if history_file.exists():
        with open(history_file, encoding="utf-8") as f:
            bad_lines = 0
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("character_id") == char_id:
                        history.append(entry)
                except json.JSONDecodeError:
                    bad_lines += 1
                    continue
            if bad_lines:
                logger.warning("[history] Pominięto %s uszkodzonych linii JSONL", bad_lines)
    return jsonify(history)


@api.delete("/api/history/<char_id>/clear")
def clear_history(char_id):
    history_file = CHAT_HISTORY_PATH
    if history_file.exists():
        lines = []
        bad_lines = 0
        with open(history_file, encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("character_id") != char_id:
                        lines.append(line)
                except json.JSONDecodeError:
                    bad_lines += 1
                    lines.append(line)
        if bad_lines:
            logger.warning("[history/clear] Pominięto %s uszkodzonych linii JSONL przy czyszczeniu", bad_lines)
        with open(history_file, "w", encoding="utf-8") as f:
            f.writelines(lines)
    return jsonify({"success": True})
