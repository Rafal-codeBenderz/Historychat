import base64
import logging
import os
from typing import Optional

from backend.services.retry_utils import retry_transient

logger = logging.getLogger(__name__)


def _is_transient(err: Exception) -> bool:
    name = type(err).__name__
    if name in {"RateLimitError", "APITimeoutError", "APIConnectionError", "InternalServerError"}:
        return True
    msg = str(err).lower()
    return any(s in msg for s in ["rate limit", "429", "timeout", "temporarily", "overloaded", "connection"])


def _flag_enabled(name: str) -> bool:
    return os.environ.get(name, "false").lower() in {"1", "true", "yes"}


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


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
    except ImportError:
        logger.error("Brak pakietu openai — zainstaluj zależności backendu.", exc_info=True)
        return 500, {"error": "Nie udało się wygenerować audio. Spróbuj ponownie później."}

    try:
        timeout_s = _env_float("TTS_HTTP_TIMEOUT", 60.0)

        def _do_call() -> tuple[int, dict]:
            openai_client = openai.OpenAI(api_key=api_key, timeout=timeout_s)
            voice = voice_id or "nova"
            response = openai_client.audio.speech.create(model="tts-1", voice=voice, input=text)
            audio_base64 = base64.b64encode(response.content).decode("utf-8")
            logger.info("[TTS] Wygenerowano audio (len=%s), voice=%s", len(text or ""), voice)
            return 200, {"audio_base64": audio_base64, "audio": audio_base64, "format": "mp3"}

        attempts = int(os.environ.get("TTS_RETRY_ATTEMPTS", "3") or "3")
        return retry_transient(_do_call, attempts=max(1, attempts), should_retry=_is_transient)
    except Exception:
        # SDK / sieć / nieoczekiwane błędy po wyczerpaniu retry — bez szczegółów w JSON.
        logger.error("Błąd TTS po wyczerpaniu prób", exc_info=True)
        return 500, {"error": "Nie udało się wygenerować audio. Spróbuj ponownie później."}

