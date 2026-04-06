import re

from flask import abort, send_from_directory

from backend.api import api
from backend.config.paths import ROOT

_AVATAR_FILENAME = re.compile(r"^[a-z0-9_]+\.jpg$")


@api.get("/avatars/<filename>")
def serve_avatar_jpg(filename: str):
    if not _AVATAR_FILENAME.fullmatch(filename):
        abort(404)
    directory = ROOT / "public" / "avatars"
    if not directory.is_dir():
        abort(404)
    return send_from_directory(directory, filename, mimetype="image/jpeg")
