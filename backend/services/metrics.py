"""Lightweight in-process metrics (Prometheus text exposition)."""

from __future__ import annotations

import threading
import time
from collections import defaultdict

_lock = threading.Lock()
_request_counts: dict[tuple[str, str, int], int] = defaultdict(int)
_budget_rejects = 0


def record_request(path: str, method: str, status_code: int) -> None:
    with _lock:
        _request_counts[(path, method.upper(), int(status_code))] += 1


def record_budget_reject() -> None:
    global _budget_rejects
    with _lock:
        _budget_rejects += 1


def prometheus_text() -> str:
    lines: list[str] = []
    with _lock:
        lines.append("# HELP historychat_http_requests_total Total HTTP requests")
        lines.append("# TYPE historychat_http_requests_total counter")
        for (path, method, code), n in sorted(_request_counts.items()):
            p = path.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(f'historychat_http_requests_total{{path="{p}",method="{method}",code="{code}"}} {n}')
        lines.append("# HELP historychat_budget_rejects_total Budget rejections (429)")
        lines.append("# TYPE historychat_budget_rejects_total counter")
        lines.append(f"historychat_budget_rejects_total {_budget_rejects}")
    lines.append("# HELP historychat_process_uptime_seconds Approximate process uptime (monotonic)")
    lines.append("# TYPE historychat_process_uptime_seconds gauge")
    lines.append(f"historychat_process_uptime_seconds {time.monotonic():.3f}")
    return "\n".join(lines) + "\n"
