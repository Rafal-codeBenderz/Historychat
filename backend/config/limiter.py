import hashlib

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def _rate_limit_identity() -> str:
    """Prefer hashed API key when auth is enabled and header present; else client IP."""
    from backend.config.auth import api_auth_enabled, extract_bearer_or_api_key

    if api_auth_enabled():
        tok = extract_bearer_or_api_key()
        if tok:
            return "apikey:" + hashlib.sha256(tok.encode()).hexdigest()[:32]
    return get_remote_address()


limiter = Limiter(
    key_func=_rate_limit_identity,
    default_limits=[],
)
