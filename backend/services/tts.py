import base64
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _flag_enabled(name: str) -> bool:
    return os.environ.get(name, "false").lower() in {"1", "true", "yes"}


def generate_tts_base64(text: str, voice_id: Optional[str]) -> tuple[int, dict]:
    """
    Returns (status_code, json_dict).
    This is a pure function from the Flask perspective (no Flask imports).
    """
    if not _flag_enabled("ENABLE_TTS"):
        return 503, {"error": "TTS is disabled (ENABLE_TTS=false)"}

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.warning("Brak OPENAI_API_KEY dla TTS")
        return 503, {"error": "Brak OPENAI_API_KEY"}

    try:
        import openai

        openai_client = openai.OpenAI(api_key=api_key)
        voice = voice_id or "nova"
        response = openai_client.audio.speech.create(model="tts-1", voice=voice, input=text)
        audio_base64 = base64.b64encode(response.content).decode("utf-8")
        logger.info("[TTS] Wygenerowano audio (len=%s), voice=%s", len(text or ""), voice)
        return 200, {"audio_base64": audio_base64, "audio": audio_base64, "format": "mp3"}
    except Exception as e:
        logger.error("Błąd TTS: %s", e)
        return 500, {"error": str(e)}

