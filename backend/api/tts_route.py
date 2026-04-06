from flask import jsonify, request

from backend.api import api
from backend.services.tts import generate_tts_base64


@api.post("/api/tts")
def tts():
    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Nieprawidłowe dane wejściowe (JSON)"}), 400
    text = data.get("text", "")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Brak text"}), 400
    voice_id = data.get("voice_id") or data.get("voice") or None
    status, payload = generate_tts_base64(text=text, voice_id=voice_id)
    return jsonify(payload), status
