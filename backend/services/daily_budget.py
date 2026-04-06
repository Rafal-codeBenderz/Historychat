"""
Per-day request budget using Redis when REDIS_URL is set, else in-process memory.

Identity: hashed API key when present, else client IP (best-effort).
"""

from __future__ import annotations

import hashlib
import logging
import threading
from datetime import datetime, timezone

from flask import request

from backend.config.auth import api_auth_enabled, extract_bearer_or_api_key
from backend.config.cost import budget_redis_url, daily_request_budget_limit
from backend.services.metrics import record_budget_reject

logger = logging.getLogger(__name__)

_mem_lock = threading.Lock()
_mem_counts: dict[str, int] = {}


def _utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


def _client_identity() -> str:
    raw = extract_bearer_or_api_key()
    if raw:
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    from flask_limiter.util import get_remote_address

    ip = get_remote_address()
    return hashlib.sha256(f"ip:{ip}".encode("utf-8")).hexdigest()[:32]


def _redis_incr(key: str) -> int | None:
    url = budget_redis_url()
    if not url:
        return None
    try:
        import redis

        r = redis.Redis.from_url(url, decode_responses=True)
        pipe = r.pipeline()
        pipe.incr(key, 1)
        pipe.expire(key, 172800)
        n, _ = pipe.execute()
        return int(n)
    except Exception:
        logger.exception("[budget] Redis error; falling back to memory")
        return None


def _memory_incr(key: str) -> int:
    with _mem_lock:
        _mem_counts[key] = _mem_counts.get(key, 0) + 1
        return _mem_counts[key]


def check_and_consume_budget() -> tuple[bool, str]:
    """
    If budget is configured, increment counter and reject when over limit.
    Returns (allowed, error_message).
    """
    limit = daily_request_budget_limit()
    if limit is None:
        return True, ""

    day = _utc_day()
    ident = _client_identity()
    key = f"hc:budget:{day}:{ident}"

    n = _redis_incr(key)
    if n is None:
        n = _memory_incr(key)

    if n > limit:
        record_budget_reject()
        return False, "Przekroczono dzienny limit żądań (budget)"
    return True, ""


def should_apply_budget_to_request(path: str, method: str) -> bool:
    from backend.config.auth import path_requires_api_auth

    if not path_requires_api_auth(path, method):
        return False
    if daily_request_budget_limit() is None:
        return False
    # When auth is off, only apply budget if explicitly allowed (abuse control still by IP).
    if not api_auth_enabled():
        return _env_bool_allow_budget_without_auth()
    return True


def _env_bool_allow_budget_without_auth() -> bool:
    import os

    raw = os.environ.get("API_BUDGET_WITHOUT_AUTH", "true")
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}
