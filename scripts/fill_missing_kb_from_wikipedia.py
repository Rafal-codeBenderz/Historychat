"""
Fill missing knowledge base .txt files from Wikipedia.

This script is meant to be run manually (one-off) before starting the backend.
It inspects `data/knowledge_base/<character_id>/` directories and, for those
that have 0 `.txt` files, it parses `README.md` to determine the required
document filenames and brief descriptions, then tries to fetch matching
Wikipedia pages and saves the content as `.txt`.

Notes:
- This is best-effort. If some pages cannot be found, the script will still try
  to create at least one `.txt` per character (fallback searches).
- Wikipedia is used as a source of truth to keep KB "source-based".
- The hardcoded aliases and extra title fallbacks are intentionally non-exhaustive.
  Characters not listed there still fall back to generic name-based heuristics.
"""

from __future__ import annotations

import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

try:
    import wikipediaapi  # type: ignore
except Exception as e:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: wikipedia-api. Install backend deps first:\n"
        "  pip install -r requirements.txt\n"
        f"Import error: {e}"
    )


ROOT = Path(__file__).resolve().parent.parent
KB_ROOT = ROOT / "data" / "knowledge_base"

# Safety / politeness
SLEEP_SECONDS = 0.5
MIN_TEXT_LEN = 400  # characters
WIKI_LANG = "pl"
USER_AGENT = "HistoryChat/KB-Filler (local script)"


@dataclass(frozen=True)
class RequiredDoc:
    filename: str
    description: str


def _character_display_name(character_id: str) -> str:
    # Simple heuristic (no network calls, no extra files).
    # Keep this mapping short on purpose: the generic fallback below handles
    # every character ID, while special cases only cover names that are likely
    # to map poorly to Polish Wikipedia titles.
    special = {
        "da_vinci": "Leonardo da Vinci",
        "joan_of_arc": "Joanna d’Arc",
        "marie_curie": "Maria Skłodowska-Curie",
        "vangogh": "Vincent van Gogh",
        "antoinette": "Marie Antoinette",
        "confucius": "Konfucjusz",
        "kahlo": "Frida Kahlo",
    }
    if character_id in special:
        return special[character_id]
    return character_id.replace("_", " ").title()


def parse_required_docs(readme_text: str) -> List[RequiredDoc]:
    """
    Parse README.md format used in repo, e.g.:
      1. `zycie_i_dzieciństwo.txt` - Biografia, wczesne lata
    """
    docs: List[RequiredDoc] = []
    # Allow markdown numbering, bulleting, and minor variations.
    pattern = re.compile(r"^\s*\d+\.\s+`([^`]+\.txt)`\s*-\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
    for m in pattern.finditer(readme_text):
        filename = m.group(1).strip()
        desc = m.group(2).strip()
        docs.append(RequiredDoc(filename=filename, description=desc))
    return docs


def build_title_candidates(character_id: str, doc: RequiredDoc) -> List[str]:
    """
    Build a ranked list of Wikipedia page titles to try.
    """
    name = _character_display_name(character_id)
    stem = Path(doc.filename).stem.replace("_", " ").strip()
    desc = re.sub(r"\s+", " ", doc.description).strip()

    candidates: List[str] = []

    # Most likely: person page.
    candidates.append(name)

    # Person + keyword-ish stem/description (often fails, but useful).
    if stem:
        candidates.append(f"{name} {stem}")
    if desc:
        candidates.append(f"{name} {desc}")

    # Topic-focused fallbacks (these might exist as separate pages).
    if stem:
        candidates.append(stem)
    if desc:
        candidates.append(desc)

    # Very small extra fallbacks for common cases
    if character_id == "freud":
        candidates.extend(["Sigmund Freud", "Psychoanaliza", "Objaśnianie marzeń sennych"])
    if character_id == "darwin":
        candidates.extend(["Karol Darwin", "O powstawaniu gatunków", "Teoria ewolucji"])
    if character_id == "tesla":
        candidates.extend(["Nikola Tesla", "Prąd przemienny", "Cewka Tesli"])
    if character_id == "montessori":
        candidates.extend(["Maria Montessori", "Metoda Montessori"])
    if character_id == "lovelace":
        candidates.extend(["Ada Lovelace", "Maszyna analityczna", "Charles Babbage"])
    if character_id == "fibonacci":
        candidates.extend(["Fibonacci", "Ciąg Fibonacciego", "Liber Abaci"])
    if character_id == "confucius":
        candidates.extend(["Konfucjusz", "Analekty konfucjańskie", "Konfucjanizm"])
    if character_id == "kahlo":
        candidates.extend(["Frida Kahlo", "Diego Rivera"])
    if character_id == "vangogh":
        candidates.extend(["Vincent van Gogh", "Gwiaździsta noc", "Słoneczniki (obrazy)"])
    if character_id == "antoinette":
        candidates.extend(["Maria Antonina", "Rewolucja francuska"])

    # De-duplicate while keeping order
    out: List[str] = []
    seen = set()
    for c in candidates:
        c2 = c.strip()
        if not c2:
            continue
        key = c2.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(c2)
    return out


def fetch_wikipedia_text(wiki: wikipediaapi.Wikipedia, title_candidates: Iterable[str]) -> Optional[Tuple[str, str]]:
    """
    Returns (title_used, text) if found.
    """
    for title in title_candidates:
        try:
            page = wiki.page(title)
            if not page.exists():
                time.sleep(SLEEP_SECONDS)
                continue
            text = (page.text or "").strip()
            if len(text) < MIN_TEXT_LEN:
                time.sleep(SLEEP_SECONDS)
                continue
            return (title, text)
        except Exception:
            # Keep going; we don't want one failure to stop the run.
            time.sleep(SLEEP_SECONDS)
            continue
        finally:
            time.sleep(SLEEP_SECONDS)
    return None


def ensure_docs_for_character(char_dir: Path) -> List[Path]:
    """
    If the character has 0 .txt files, try to create the required docs.
    Returns list of created files.
    """
    created: List[Path] = []
    existing_txt = list(char_dir.glob("*.txt"))
    if existing_txt:
        return created

    readme = char_dir / "README.md"
    if not readme.is_file():
        print(f"[skip] {char_dir.name}: no README.md and no .txt", file=sys.stderr)
        return created

    required = parse_required_docs(readme.read_text(encoding="utf-8"))
    if not required:
        print(f"[skip] {char_dir.name}: README.md has no required docs list", file=sys.stderr)
        return created

    wiki = wikipediaapi.Wikipedia(language=WIKI_LANG, user_agent=USER_AGENT)
    char_id = char_dir.name

    print(f"[character] {char_id}: creating up to {len(required)} docs")
    for doc in required:
        out_path = char_dir / doc.filename
        if out_path.exists():
            continue

        candidates = build_title_candidates(char_id, doc)
        found = fetch_wikipedia_text(wiki, candidates)
        if not found:
            print(f"  [warn] {doc.filename}: no wikipedia match", file=sys.stderr)
            continue

        title_used, text = found
        header = (
            f"Źródło: Wikipedia ({WIKI_LANG})\n"
            f"Hasło: {title_used}\n"
            f"Postać: {char_id} ({_character_display_name(char_id)})\n"
            f"Dokument: {doc.filename}\n"
            f"Opis: {doc.description}\n"
            "\n"
        )
        out_path.write_text(header + text + "\n", encoding="utf-8")
        created.append(out_path)
        print(f"  [ok] wrote {out_path.relative_to(ROOT)} (title={title_used!r}, len={len(text)})")

    # Minimal guarantee: at least 1 .txt
    if not created:
        fallback_doc = RequiredDoc(filename="wikipedia_bio.txt", description="Fallback: biografia z Wikipedii")
        out_path = char_dir / fallback_doc.filename
        if not out_path.exists():
            wiki = wikipediaapi.Wikipedia(language=WIKI_LANG, user_agent=USER_AGENT)
            candidates = [*_dedupe([_character_display_name(char_id), char_id.replace("_", " ").title()])]
            found = fetch_wikipedia_text(wiki, candidates)
            if found:
                title_used, text = found
                header = (
                    f"Źródło: Wikipedia ({WIKI_LANG})\n"
                    f"Hasło: {title_used}\n"
                    f"Postać: {char_id} ({_character_display_name(char_id)})\n"
                    f"Dokument: {fallback_doc.filename}\n"
                    f"Opis: {fallback_doc.description}\n\n"
                )
                out_path.write_text(header + text + "\n", encoding="utf-8")
                created.append(out_path)
                print(f"  [ok] wrote fallback {out_path.relative_to(ROOT)} (title={title_used!r})")

    return created


def _dedupe(items: Iterable[str]) -> List[str]:
    out: List[str] = []
    seen = set()
    for it in items:
        k = it.strip().casefold()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(it.strip())
    return out


def main() -> int:
    if not KB_ROOT.is_dir():
        print(f"KB root not found: {KB_ROOT}", file=sys.stderr)
        return 2

    created_total: List[Path] = []
    for char_dir in sorted([p for p in KB_ROOT.iterdir() if p.is_dir()], key=lambda p: p.name):
        created = ensure_docs_for_character(char_dir)
        created_total.extend(created)

    print("\n=== Summary ===")
    if created_total:
        print(f"Created {len(created_total)} file(s):")
        for p in created_total:
            print(f"- {p.relative_to(ROOT)}")
    else:
        print("No files created (all characters already had .txt files, or imports failed).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

