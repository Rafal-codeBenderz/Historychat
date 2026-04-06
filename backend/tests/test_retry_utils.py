import pytest

from backend.services.retry_utils import retry_transient


def test_retry_transient_succeeds_after_transient_failures(monkeypatch):
    monkeypatch.setattr("backend.services.retry_utils.time.sleep", lambda _s: None)
    n = {"calls": 0}

    def fn():
        n["calls"] += 1
        if n["calls"] < 3:
            raise RuntimeError("rate limit exceeded")
        return "ok"

    out = retry_transient(fn, attempts=5, should_retry=lambda e: "rate" in str(e).lower())
    assert out == "ok"
    assert n["calls"] == 3


def test_retry_transient_raises_after_exhausting_attempts(monkeypatch):
    monkeypatch.setattr("backend.services.retry_utils.time.sleep", lambda _s: None)

    def fn():
        raise RuntimeError("rate limit")

    with pytest.raises(RuntimeError, match="rate limit"):
        retry_transient(fn, attempts=3, should_retry=lambda e: "rate" in str(e).lower())


def test_retry_transient_non_retryable_raises_immediately(monkeypatch):
    monkeypatch.setattr("backend.services.retry_utils.time.sleep", lambda _s: None)
    n = {"calls": 0}

    def fn():
        n["calls"] += 1
        raise ValueError("invalid request")

    with pytest.raises(ValueError, match="invalid"):
        retry_transient(fn, attempts=5, should_retry=lambda e: "rate" in str(e).lower())
    assert n["calls"] == 1
