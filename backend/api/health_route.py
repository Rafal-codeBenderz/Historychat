import os

from flask import jsonify

from backend.api import api
from backend.config.paths import KB_PATH
from backend.core.characters_debata_migrated import CHARACTERS
from backend.core.rag_engine import get_engine
from backend.services.avatar_config import is_avatar_image_generation_enabled


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
