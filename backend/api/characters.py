from flask import jsonify

from backend.api import api
from backend.core.characters_debata_migrated import CHARACTERS, VOICE_MAP


@api.get("/api/characters")
def get_characters():
    out = []
    for ch in CHARACTERS.values():
        voice_name = ch.get("voiceName")
        voice_id = None
        if isinstance(voice_name, str) and voice_name:
            voice_id = VOICE_MAP.get(voice_name)
        item = dict(ch)
        item["voice_id"] = voice_id
        out.append(item)
    return jsonify(out)
