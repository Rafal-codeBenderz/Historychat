import logging
import os

from flask import jsonify, request

from backend.api import api
from backend.config.paths import ROOT
from backend.core.characters_debata_migrated import CHARACTERS
from backend.services.avatar_config import is_avatar_image_generation_enabled

logger = logging.getLogger(__name__)


@api.post("/api/generate-avatar")
def generate_avatar():
    if not is_avatar_image_generation_enabled():
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
