from flask import current_app, jsonify

from backend.api import api


@api.get("/api/routes")
def list_routes():
    rules = []
    for r in current_app.url_map.iter_rules():
        if r.endpoint == "static":
            continue
        methods = sorted(m for m in r.methods if m not in {"HEAD", "OPTIONS"})
        rules.append({"rule": r.rule, "methods": methods})
    rules.sort(key=lambda x: x["rule"])
    return jsonify(rules)
