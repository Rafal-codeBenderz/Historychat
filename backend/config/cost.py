"""Cost / abuse controls (daily request budget per client identity)."""

from __future__ import annotations

import os


def _env_int(name: str, default: int | None) -> int | None:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(str(raw).strip(), 10)
    except ValueError:
        return default


def daily_request_budget_limit() -> int | None:
    """
    Max successful costly requests per identity per UTC day.
    None = disabled.
    """
    v = _env_int("API_DAILY_REQUEST_BUDGET", None)
    if v is None or v <= 0:
        return None
    return v


def budget_redis_url() -> str | None:
    u = (os.environ.get("REDIS_URL") or "").strip()
    return u or None
