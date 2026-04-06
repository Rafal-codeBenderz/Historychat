import os

from flask import Response

from backend.api import api
from backend.services.metrics import prometheus_text


@api.get("/api/metrics")
def metrics():
    if not _metrics_enabled():
        return Response("Not Found", status=404)
    body = prometheus_text()
    return Response(body, mimetype="text/plain; version=0.0.4; charset=utf-8")


def _metrics_enabled() -> bool:
    raw = os.environ.get("METRICS_ENABLED", "false")
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}
