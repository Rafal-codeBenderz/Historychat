import datetime
import json
import logging
import os
from pathlib import Path
from typing import Optional

from flask import Blueprint, current_app, jsonify, request

from backend.config.paths import CHAT_HISTORY_PATH, KB_PATH, ROOT
from backend.core.characters_debata_migrated import CHARACTERS, VOICE_MAP
from backend.core.debate import run_debate_turn
from backend.core.prompting import build_prompt
from backend.core.rag_engine import get_engine
from backend.services.llm import call_llm
from backend.services.tts import generate_tts_base64

logger = logging.getLogger(__name__)

api = Blueprint("api", __name__)

_topics_sources_validated = False


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


def save_chat_history(char_id: str, role: str, content: str, sources: list | None = None):
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


@api.before_app_request
def init_once():
    global _topics_sources_validated
    # Ensure RAG engine exists (lazy singleton) and validate topics once.
    _ = get_engine()
    if not _topics_sources_validated:
        validate_suggested_topic_sources()
        _topics_sources_validated = True


@api.get("/api/characters")
def get_characters():
    out = []
    for ch in CHARACTERS.values():
        # Keep legacy `voiceName` support until the generated source data stores
        # `voice_id` natively and all callers stop relying on the transitional shape.
        voice_name = ch.get("voiceName")
        voice_id = None
        if isinstance(voice_name, str) and voice_name:
            voice_id = VOICE_MAP.get(voice_name)
        item = dict(ch)
        item["voice_id"] = voice_id
        out.append(item)
    return jsonify(out)


@api.post("/api/chat")
def chat():
    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Nieprawidłowe dane wejściowe (JSON)"}), 400

    char_id = data.get("characterId")
    message = data.get("message", "")
    history = data.get("history", [])
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
    if len(message) > 6000:
        return jsonify({"error": "Wiadomość jest zbyt długa"}), 422

    if not isinstance(history, list):
        return jsonify({"error": "Pole history musi być listą"}), 400

    character = CHARACTERS[char_id]
    rag_engine = get_engine()

    fragments = rag_engine.retrieve(char_id, message, top_k=4, source_stem=source_stem)
    if not fragments and char_id in rag_engine.chunks:
        logger.warning(
            "[chat] char=%s puste fragmenty mimo chunków — query=%r sourceStem=%r",
            char_id,
            (message or "")[:120],
            source_stem,
        )
    elif not fragments and char_id not in rag_engine.chunks:
        logger.warning("[chat] char=%s brak chunków w pamięci (brak plików KB?)", char_id)

    pinned_label = None
    if source_stem:
        pinned_label = Path(source_stem).stem.replace("_", " ").title()

    prompt = build_prompt(character, message, fragments, history, pinned_source_label=pinned_label)
    answer = call_llm(prompt)

    save_chat_history(char_id, "user", message)
    save_chat_history(char_id, "assistant", answer, [f["source"] for f in fragments])

    return jsonify({"answer": answer, "fragments": fragments, "character": character})


@api.post("/api/tts")
def tts():
    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Nieprawidłowe dane wejściowe (JSON)"}), 400
    text = data.get("text", "")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Brak text"}), 400
    voice_id = data.get("voice_id") or data.get("voice") or None
    status, payload = generate_tts_base64(text=text, voice_id=voice_id)
    return jsonify(payload), status


@api.get("/api/health")
def health():
    eng = get_engine()
    return jsonify(
        {
            "status": "ok",
            "characters": list(CHARACTERS.keys()),
            "indexes_built": list(eng.indexes.keys()) if eng else [],
            "chunks_loaded": list(eng.chunks.keys()) if eng else [],
            "rag_mode": "faiss"
            if (eng and eng.indexes)
            else ("keyword" if (eng and eng.chunks) else "off"),
            "embedder_loaded": eng.embedder is not None if eng else False,
            "kb_path": str(KB_PATH),
            "kb_exists": KB_PATH.is_dir(),
        }
    )


@api.get("/api/routes")
def list_routes():
    rules = []
    for r in current_app.url_map.iter_rules():
        if r.endpoint == "static":
            continue
        methods = sorted(m for m in r.methods if m not in {"HEAD", "OPTIONS"})
        rules.append({"rule": r.rule, "methods": methods})
    rules.sort(key=lambda x: x["rule"])
    return jsonify(rules)


@api.get("/api/history/<char_id>")
def get_history(char_id):
    history = []
    history_file = CHAT_HISTORY_PATH
    if history_file.exists():
        with open(history_file, encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("character_id") == char_id:
                        history.append(entry)
                except Exception:
                    pass
    return jsonify(history)


@api.delete("/api/history/<char_id>/clear")
def clear_history(char_id):
    history_file = CHAT_HISTORY_PATH
    if history_file.exists():
        lines = []
        with open(history_file, encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("character_id") != char_id:
                        lines.append(line)
                except Exception:
                    lines.append(line)
        with open(history_file, "w", encoding="utf-8") as f:
            f.writelines(lines)
    return jsonify({"success": True})


@api.post("/api/generate-avatar")
def generate_avatar():
    if os.environ.get("ENABLE_AVATAR_GENERATION", "false").lower() not in {"1", "true", "yes"}:
        return jsonify({"error": "Avatar generation is disabled (ENABLE_AVATAR_GENERATION=false)"}), 503

    data = request.json or {}
    character_id = data.get("character_id")
    if not character_id or not isinstance(character_id, str):
        return jsonify({"error": "Brak character_id"}), 400
    character_id = character_id.strip()

    if character_id not in CHARACTERS:
        return jsonify({"error": "Nieznana postać"}), 400

    character = CHARACTERS[character_id]
    avatar_prompt = (character.get("avatar_prompt") or "").strip()
    if not avatar_prompt:
        return jsonify({"error": "Brak avatar_prompt dla postaci"}), 400

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("Brak OPENAI_API_KEY dla generowania avatara")
        return jsonify({"error": "Brak OPENAI_API_KEY"}), 503

    try:
        import base64
        import openai
        import requests

        avatars_dir = ROOT / "public" / "avatars"
        avatars_dir.mkdir(parents=True, exist_ok=True)

        avatar_path = avatars_dir / f"{character_id}.jpg"
        if avatar_path.exists():
            logger.info("[AVATAR] Obraz już istnieje: %s", avatar_path)
            return jsonify({"success": True, "image_url": f"/avatars/{character_id}.jpg", "cached": True})

        logger.info("[AVATAR] Generowanie obrazu dla %s...", character_id)
        openai_client = openai.OpenAI(api_key=api_key)

        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=(
                f"{avatar_prompt}. Portrait, looking at the camera, cinematic lighting, "
                "high detail, professional photography, historical style."
            ),
            size="1024x1024",
            quality="standard",
            response_format="b64_json",
            n=1,
        )

        img_b64 = None
        if getattr(response, "data", None):
            img_b64 = getattr(response.data[0], "b64_json", None) or None

        if img_b64:
            avatar_path.write_bytes(base64.b64decode(img_b64))
        else:
            image_url = getattr(response.data[0], "url", None) if getattr(response, "data", None) else None
            if not image_url:
                return jsonify({"error": "Nie udało się wygenerować obrazu (brak url/b64_json)"}), 500
            img_response = requests.get(image_url, timeout=90)
            img_response.raise_for_status()
            avatar_path.write_bytes(img_response.content)

        logger.info("[AVATAR] Obraz zapisany: %s", avatar_path)
        return jsonify({"success": True, "image_url": f"/avatars/{character_id}.jpg", "cached": False})
    except Exception as e:
        logger.error("Błąd generowania avatara: %s", e)
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Debate endpoints
# ---------------------------------------------------------------------------
_VALID_ROLES = {"prosecutor", "defender", "judge"}
_MAX_TRANSCRIPT_TURNS = 50
_MAX_THEME_LEN = 1000


def _validate_debate_payload(data: dict) -> tuple[str | None, int]:
    """Zwraca (error_msg, http_code) lub (None, 0) gdy OK."""
    theme = data.get("theme", "")
    if not isinstance(theme, str) or not theme.strip():
        return "Pole theme jest wymagane i nie może być puste", 400
    if len(theme.strip()) > _MAX_THEME_LEN:
        return f"Teza zbyt długa (max {_MAX_THEME_LEN} znaków)", 400

    roles = data.get("roles")
    if not isinstance(roles, dict):
        return "Pole roles musi być obiektem {prosecutor, defender, judge}", 400
    for role in _VALID_ROLES:
        if role not in roles:
            return f"Brakuje roli: {role}", 400
        char_id = roles[role]
        if not isinstance(char_id, str) or char_id not in CHARACTERS:
            return f"Nieznana postać dla roli {role}: {char_id!r}", 400
    if len({roles[r] for r in _VALID_ROLES}) != 3:
        return "Każda rola musi być przypisana do innej postaci", 400

    transcript = data.get("transcript", [])
    if not isinstance(transcript, list):
        return "Pole transcript musi być listą", 400
    if len(transcript) > _MAX_TRANSCRIPT_TURNS:
        return f"Zbyt długi transkrypt (max {_MAX_TRANSCRIPT_TURNS} tur)", 400

    return None, 0


@api.route("/api/debate/turn", methods=["POST"])
def debate_turn():
    data = request.json or {}

    err, code = _validate_debate_payload(data)
    if err:
        return jsonify({"error": err}), code

    next_role = data.get("next_role")
    if next_role not in _VALID_ROLES:
        return jsonify({"error": f"Nieprawidłowa next_role: {next_role!r}"}), 400

    roles = data["roles"]
    char_id = roles[next_role]
    theme = data["theme"].strip()
    transcript = data.get("transcript", [])

    try:
        result = run_debate_turn(
            char_id=char_id,
            role=next_role,
            theme=theme,
            transcript=transcript,
            verdict_mode=False,
        )
        return jsonify(result)
    except Exception as e:
        logger.error("[debate/turn] Błąd: %s", e)
        return jsonify({"error": "Błąd serwera podczas tury debaty"}), 500


@api.route("/api/debate/verdict", methods=["POST"])
def debate_verdict():
    data = request.json or {}

    err, code = _validate_debate_payload(data)
    if err:
        return jsonify({"error": err}), code

    roles = data["roles"]
    theme = data["theme"].strip()
    transcript = data.get("transcript", [])
    judge_id = roles["judge"]

    try:
        result = run_debate_turn(
            char_id=judge_id,
            role="judge",
            theme=theme,
            transcript=transcript,
            verdict_mode=True,
        )
        return jsonify(result)
    except Exception as e:
        logger.error("[debate/verdict] Błąd: %s", e)
        return jsonify({"error": "Błąd serwera podczas werdyktu"}), 500

