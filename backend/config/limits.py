import os


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}


def rate_limit_enabled() -> bool:
    return _env_bool("RATE_LIMIT_ENABLED", False)


def rate_limit_chat() -> str:
    return os.environ.get("RATE_LIMIT_CHAT", "60 per minute")


def rate_limit_tts() -> str:
    return os.environ.get("RATE_LIMIT_TTS", "30 per minute")


def rate_limit_avatar() -> str:
    return os.environ.get("RATE_LIMIT_AVATAR", "10 per minute")

