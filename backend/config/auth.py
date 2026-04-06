"""API authentication (Bearer token / X-API-Key) for costly endpoints."""

from __future__ import annotations

import os
from functools import lru_cache

from flask import request


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}


def api_auth_enabled() -> bool:
    return _env_bool("API_AUTH_ENABLED", False)


@lru_cache(maxsize=1)
def _valid_api_keys() -> frozenset[str]:
    keys: set[str] = set()
    single = os.environ.get("HISTORYCHAT_API_KEY", "").strip()
    if single:
        keys.add(single)
    multi = os.environ.get("HISTORYCHAT_API_KEYS", "").strip()
    if multi:
        for part in multi.split(","):
            k = part.strip()
            if k:
                keys.add(k)
    return frozenset(keys)


def invalidate_api_keys_cache() -> None:
    _valid_api_keys.cache_clear()


def configured_api_keys_non_empty() -> bool:
    return len(_valid_api_keys()) > 0


def extract_bearer_or_api_key() -> str | None:
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        return token or None
    xk = (request.headers.get("X-API-Key") or "").strip()
    return xk or None


def validate_request_api_key() -> tuple[bool, str]:
    """
    Returns (ok, error_message). When auth is disabled, returns (True, "").
    """
    if not api_auth_enabled():
        return True, ""
    if not configured_api_keys_non_empty():
        return False, "API authentication is misconfigured (no API keys)"
    token = extract_bearer_or_api_key()
    if not token:
        return False, "Brak uwierzytelnienia (Authorization: Bearer lub X-API-Key)"
    if token not in _valid_api_keys():
        return False, "Nieprawidłowy klucz API"
    return True, ""


# Paths that incur LLM/TTS/image cost — require API key when API_AUTH_ENABLED.
_PROTECTED_PREFIXES: tuple[tuple[str, str], ...] = (
    ("/api/chat", "POST"),
    ("/api/tts", "POST"),
    ("/api/generate-avatar", "POST"),
)


def path_requires_api_auth(path: str, method: str) -> bool:
    m = (method or "").upper()
    for prefix, meth in _PROTECTED_PREFIXES:
        if m == meth and path == prefix:
            return True
    return False
