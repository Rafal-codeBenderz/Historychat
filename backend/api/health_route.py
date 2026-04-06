import os

from flask import jsonify

from backend.api import api
from backend.config.auth import api_auth_enabled, configured_api_keys_non_empty
from backend.config.cost import budget_redis_url, daily_request_budget_limit
from backend.config.limits import rate_limit_enabled
from backend.config.paths import KB_PATH
from backend.core.characters import CHARACTERS
from backend.core.rag_engine import get_engine
from backend.services.avatar_config import is_avatar_image_generation_enabled


def _redis_ping(url: str) -> bool:
    try:
        import redis

        r = redis.Redis.from_url(url, socket_connect_timeout=1.0)
        return bool(r.ping())
    except Exception:
        return False


def _rate_limit_needs_redis() -> bool:
    if not rate_limit_enabled():
        return False
    uri = (os.environ.get("RATE_LIMIT_STORAGE_URI") or "").strip().lower()
    return uri.startswith("redis")


@api.get("/api/health/live")
def health_live():
    return jsonify({"status": "ok"})


@api.get("/api/health/ready")
def health_ready():
    issues: list[str] = []
    if not KB_PATH.is_dir():
        issues.append("kb_missing")
    if api_auth_enabled() and not configured_api_keys_non_empty():
        issues.append("api_auth_misconfigured")
    rl_uri = (os.environ.get("RATE_LIMIT_STORAGE_URI") or "").strip()
    if _rate_limit_needs_redis() and rl_uri:
        if not _redis_ping(rl_uri):
            issues.append("rate_limit_redis_unavailable")
    _bru = budget_redis_url()
    if daily_request_budget_limit() is not None and _bru:
        if not _redis_ping(_bru):
            issues.append("budget_redis_unavailable")

    try:
        get_engine()
    except Exception:
        issues.append("rag_engine_failed")

    if issues:
        return jsonify({"status": "not_ready", "issues": issues}), 503
    return jsonify({"status": "ok"})


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
            "app_version": os.environ.get("APP_VERSION", "dev"),
            "avatar_image_generation_enabled": is_avatar_image_generation_enabled(),
        }
    )
