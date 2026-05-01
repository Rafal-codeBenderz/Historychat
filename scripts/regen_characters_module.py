"""
Regenerate a migrated characters module for the main project.

Source of truth:
  `debata pozniej na github do wrzucenia/backend/core/characters.py`

Target output:
  `backend/core/characters.py`

Key conversion:
- suggestedTopics from `list[str]` -> `list[{'question': str, 'sourceStem': str}]`
- sourceStem is best-effort:
    - if data/knowledge_base/<id>/ has exactly 1 *.txt -> pin all topics to it
    - else -> pin per-topic using heuristics based on overlap between:
        - topic question text
        - README descriptions for each required *.txt
        - required *.txt stems (filename parts)

Run from project root:
  python scripts/regen_characters_module.py
"""

from __future__ import annotations

import importlib.util
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent.parent
SRC_CHARACTERS_FILE = ROOT / "debata pozniej na github do wrzucenia" / "backend" / "core" / "characters.py"
KB_ROOT = ROOT / "data" / "knowledge_base"
OUT_FILE = ROOT / "backend" / "core" / "characters.py"


def load_characters_module_from_file(py_file: Path):
    spec = importlib.util.spec_from_file_location("characters_source", py_file)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module spec: {py_file}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_README_DOC_RE = re.compile(
    r"^\s*\d+\.\s*`([^`]+\.txt)`\s*-\s*(.+?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def _normalize_for_tokens(text: str) -> str:
    # Normalize diacritics so "władza" and "wladza" get comparable tokens.
    s = unicodedata.normalize("NFKD", text)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower()
    return s


def _tokenize(text: str) -> List[str]:
    s = _normalize_for_tokens(text)
    # Keep word-like tokens only. Works with Polish and any corrupted Unicode too.
    return re.findall(r"[a-z0-9_]+", s)


def parse_readme_required_docs(readme_text: str) -> Dict[str, str]:
    """
    Returns mapping: filename -> description.
    Example line: `zycie_i_dzieciństwo.txt` - Biografia, wczesne lata
    """
    out: Dict[str, str] = {}
    for m in _README_DOC_RE.finditer(readme_text):
        filename = m.group(1).strip()
        desc = m.group(2).strip()
        out[filename] = desc
    return out


def candidates_for_character(character_id: str) -> List[Dict[str, Any]]:
    """
    Returns candidate stems with token sets:
      [{"stem": str, "filename": str, "desc_tokens": set[str], "stem_tokens": set[str]}]
    """
    char_dir = KB_ROOT / character_id
    if not char_dir.is_dir():
        return []

    readme_path = char_dir / "README.md"
    readme_docs: Dict[str, str] = {}
    if readme_path.is_file():
        readme_docs = parse_readme_required_docs(readme_path.read_text(encoding="utf-8", errors="ignore"))

    txt_files = sorted([p for p in char_dir.glob("*.txt") if p.is_file()])
    candidates: List[Dict[str, Any]] = []
    for p in txt_files:
        filename = p.name
        stem = p.stem
        desc = readme_docs.get(filename, "")
        candidates.append(
            {
                "stem": stem,
                "filename": filename,
                "desc_tokens": set(_tokenize(desc)),
                "stem_tokens": set(_tokenize(stem.replace("-", "_").replace(".", "_"))),
            }
        )
    return candidates


def infer_source_stem(character_id: str, question: str) -> str:
    candidates = candidates_for_character(character_id)
    if not candidates:
        return ""

    if len(candidates) == 1:
        return candidates[0]["stem"]

    q_tokens = set(_tokenize(question))
    if not q_tokens:
        return ""

    best = ("", 0)
    second = ("", 0)

    def overlap_score(known_tokens: set[str]) -> int:
        """
        Best-effort overlap between topic tokens and known tokens.
        We allow substring matches to handle basic Polish morphology
        (e.g. 'sojusz' vs 'sojusze').
        """
        score = 0
        known_list = [k for k in known_tokens if len(k) >= 4]
        for q in q_tokens:
            if len(q) < 4:
                continue
            if any((q in k) or (k in q) for k in known_list):
                score += 1
        return score

    for c in candidates:
        # Combine description + filename tokens as "what we know this file is about"
        known = c["desc_tokens"].union(c["stem_tokens"])
        score = overlap_score(known) if known else 0

        if score > best[1]:
            second = best
            best = (c["stem"], score)
        elif score > second[1]:
            second = (c["stem"], score)

    best_stem, best_score = best
    _second_stem, second_score = second

    # Conservative thresholds to avoid wrong pinning:
    # - allow low overlap only when the question is sufficiently specific
    #
    # Rule:
    # - best_score must be at least 1 (at least one matched token)
    # - best must beat second by at least 1
    # - if best_score == 1, require that question has enough tokens (avoid short ambiguous pins)
    if best_score < 1:
        return ""
    if best_score - second_score < 1:
        return ""
    if best_score == 1 and len(q_tokens) < 6:
        return ""
    return best_stem


def migrate_characters(characters: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for cid, ch in characters.items():
        ch2 = dict(ch)
        topics = ch2.get("suggestedTopics")
        migrated_topics: List[Dict[str, str]] = []

        # Pre-compute candidates for this character (so we don't parse/read README repeatedly).
        # candidates_for_character caches nothing, but keeps code simple and deterministic.
        # We'll still only run it once per character.
        # Note: infer_source_stem will call candidates_for_character internally; we keep it for clarity.
        # If you want max speed later, we can refactor to pass candidates.
        _ = cid

        if isinstance(topics, list):
            for t in topics:
                if isinstance(t, str) and t.strip():
                    q = t.strip()
                    migrated_topics.append({"question": q, "sourceStem": infer_source_stem(cid, q)})
                elif isinstance(t, dict) and "question" in t:
                    # If already migrated-like, keep but normalize
                    q = str(t.get("question", "")).strip()
                    # Re-infer to keep consistent with improved heuristic.
                    migrated_topics.append({"question": q, "sourceStem": infer_source_stem(cid, q)})
        if migrated_topics:
            ch2["suggestedTopics"] = migrated_topics
        out[cid] = ch2
    return out


def render_py_module(
    query_expansions: Dict[str, Any],
    voice_map: Dict[str, Any],
    characters: Dict[str, Any],
) -> str:
    header = (
        '"""\n'
        "Generated characters configuration (migrated from debata project).\n\n"
        "DO NOT EDIT MANUALLY.\n"
        "Regenerate via: `python scripts/regen_characters_module.py`\n"
        '"""\n\n'
    )

    def dump(obj: Any) -> str:
        # Use JSON to keep deterministic formatting and avoid Python repr edge cases.
        return json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True)

    body = (
        f"{header}"
        f"QUERY_EXPANSIONS = {dump(query_expansions)}\n\n"
        f"VOICE_MAP = {dump(voice_map)}\n\n"
        f"CHARACTERS = {dump(characters)}\n"
    )
    return body


def main() -> int:
    if not SRC_CHARACTERS_FILE.is_file():
        raise SystemExit(f"Missing source characters file: {SRC_CHARACTERS_FILE}")
    if not (ROOT / "backend").is_dir():
        raise SystemExit(f"Run from project root; backend/ not found at: {ROOT}")

    mod = load_characters_module_from_file(SRC_CHARACTERS_FILE)
    query_expansions = getattr(mod, "QUERY_EXPANSIONS")
    voice_map = getattr(mod, "VOICE_MAP")
    characters = getattr(mod, "CHARACTERS")

    migrated_characters = migrate_characters(characters)
    content = render_py_module(query_expansions, voice_map, migrated_characters)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(content, encoding="utf-8")
    print(f"[ok] wrote {OUT_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

