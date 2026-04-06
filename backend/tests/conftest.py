"""Shared pytest hooks for HistoryChat backend tests."""

import pytest

from backend.config.auth import invalidate_api_keys_cache


@pytest.fixture(autouse=True)
def _reset_auth_key_cache():
    invalidate_api_keys_cache()
    yield
    invalidate_api_keys_cache()


@pytest.fixture(autouse=True)
def _reset_in_memory_budget_counters():
    import backend.services.daily_budget as daily_budget

    with daily_budget._mem_lock:
        daily_budget._mem_counts.clear()
    yield
    with daily_budget._mem_lock:
        daily_budget._mem_counts.clear()
