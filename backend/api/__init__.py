"""
Blueprint Flask dla REST API HistoryChat (czat, postacie, health, TTS, awatary, historia).

Submoduły rejestrują trasy przez import side-effect w sekcji poniżej — kolejność
importów ma znaczenie tam, gdzie moduł podpina `before_app_request` (bootstrap).
"""

from flask import Blueprint

api = Blueprint("api", __name__)

from backend.api import (  # noqa: E402,F401
    bootstrap,
    avatar_route,
    avatars_static_route,
    characters,
    chat,
    health_route,
    history_route,
    metrics_route,
    misc_route,
    tts_route,
)
