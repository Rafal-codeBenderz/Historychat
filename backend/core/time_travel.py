"""
Modul "Podroz w czasie" (TT) — wczytanie metadanych, dopasowanie sceny, suggest miejsc.

Zrodlo prawdy metadanych: data/time_travel/characters.json (mapa char_id -> meta).
Stale walidacji rok / dlugosc lokalizacji sa duplikatami z `src/constants/timeTravel.ts`
(komentarz krzyzowy "zgodnie z backend").

Wzor: podroz wczasie/backend/core/time_travel_meta.py (prototyp).
"""

from __future__ import annotations

import json
from typing import Any

from backend.config.paths import DATA_DIR

# Stale wspoldzielone z `src/constants/timeTravel.ts` — zmiany TYLKO razem z frontem.
TIME_TRAVEL_YEAR_MIN = -3000
TIME_TRAVEL_YEAR_MAX = 2100
TIME_TRAVEL_LOCATION_MAX = 200
TIME_TRAVEL_MESSAGE_MAX = 6000

# Lokacja JSON w drzewie projektu (lustro `public/data/scenes-catalog.json` jest osobnym assetem frontendu).
META_PATH = DATA_DIR / "time_travel" / "characters.json"

_USER_SCENE_MESSAGE = "Ta postac nie jest dostepna dla podanego roku lub miejsca."

_SCENE_ERROR_BODY: dict[str, str] = {
    "error_code": "scene_not_allowed",
    "user_message": _USER_SCENE_MESSAGE,
}


_RAW_META: dict[str, Any] | None = None


def _load_raw() -> dict[str, Any]:
    if not META_PATH.is_file():
        return {}
    with open(META_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("characters.json must be a JSON object")
    return data


def load_time_travel_meta() -> dict[str, dict[str, Any]]:
    """Zwraca mape char_id -> {start_year, end_year, locations, [perspective, scene_hint, suggested_places, era_tags]}."""
    global _RAW_META
    if _RAW_META is None:
        _RAW_META = _load_raw()
    out: dict[str, dict[str, Any]] = {}
    for cid, entry in _RAW_META.items():
        if not isinstance(entry, dict):
            continue
        if entry.get("time_travel") is False:
            continue
        try:
            sy = int(entry["start_year"])
            ey = int(entry["end_year"])
        except (KeyError, TypeError, ValueError):
            continue
        locs = entry.get("locations") or []
        if not isinstance(locs, list):
            locs = []
        locs_str = [str(x) for x in locs if isinstance(x, (str, int, float))]
        base: dict[str, Any] = {
            "start_year": sy,
            "end_year": ey,
            "locations": locs_str,
        }
        pers = entry.get("perspective")
        if isinstance(pers, str) and pers in ("ruler", "citizen", "artist", "soldier"):
            base["perspective"] = pers
        hint = entry.get("scene_hint")
        if isinstance(hint, str) and hint.strip():
            base["scene_hint"] = hint.strip()
        sug = entry.get("suggested_places")
        if isinstance(sug, list):
            sp = [str(x) for x in sug if isinstance(x, (str, int, float))]
            if sp:
                base["suggested_places"] = sp
        tags = entry.get("era_tags")
        if isinstance(tags, list):
            et = [str(x).strip() for x in tags if isinstance(x, (str, int, float)) and str(x).strip()]
            if et:
                base["era_tags"] = et
        out[str(cid)] = base
    return out


def reload_time_travel_meta_for_tests() -> None:
    """Reset cache (do uzycia w pytest)."""
    global _RAW_META
    _RAW_META = None


def location_matches(user_location: str, tokens: list[str]) -> bool:
    """Substring case-insensitive w obie strony — zgodnie z `filterCharacterIdsForTimeTravel` na froncie."""
    search = user_location.lower().strip()
    if not search:
        return False
    for loc in tokens:
        lo = loc.lower()
        if search in lo or lo in search:
            return True
    return False


def is_scene_allowed(character_id: str, year: int, location: str) -> bool:
    meta = load_time_travel_meta().get(character_id)
    if not meta:
        return False
    if year < meta["start_year"] or year > meta["end_year"]:
        return False
    return location_matches(location, meta["locations"])


def scene_not_allowed_response() -> tuple[dict[str, str], int]:
    return dict(_SCENE_ERROR_BODY), 422


def time_travel_payload_for_character(character_id: str) -> dict[str, Any] | bool:
    """Wartosc dla pola `time_travel` w GET /api/characters: dict z meta lub False gdy postac niedostepna w TT."""
    meta = load_time_travel_meta().get(character_id)
    if not meta:
        return False
    payload: dict[str, Any] = {
        "start_year": meta["start_year"],
        "end_year": meta["end_year"],
        "locations": list(meta["locations"]),
    }
    if "perspective" in meta:
        payload["perspective"] = meta["perspective"]
    if "scene_hint" in meta:
        payload["scene_hint"] = meta["scene_hint"]
    if meta.get("suggested_places"):
        payload["suggested_places"] = list(meta["suggested_places"])
    if meta.get("era_tags"):
        payload["era_tags"] = list(meta["era_tags"])
    return payload


def suggest_places_for_year(year: int, region_token: str) -> list[str]:
    """Distinct tokeny lokalizacji z meta dla postaci aktywnych w `year`, opcjonalnie filtrowane po substringu regionToken."""
    data = _load_raw()
    rt = region_token.strip().lower()
    seen: set[str] = set()
    out: list[str] = []
    for _cid, entry in data.items():
        if not isinstance(entry, dict) or entry.get("time_travel") is False:
            continue
        try:
            sy = int(entry["start_year"])
            ey = int(entry["end_year"])
        except (KeyError, TypeError, ValueError):
            continue
        if year < sy or year > ey:
            continue
        locs = entry.get("locations") or []
        if not isinstance(locs, list):
            continue
        for loc in locs:
            if not isinstance(loc, str):
                continue
            lo = loc.strip()
            if not lo:
                continue
            low = lo.lower()
            if rt and rt not in low:
                continue
            key = low
            if key in seen:
                continue
            seen.add(key)
            out.append(lo)
    out.sort(key=str.lower)
    return out[:50]
