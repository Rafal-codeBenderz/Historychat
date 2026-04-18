from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

LOGS_DIR = ROOT / "logs"
DATA_DIR = ROOT / "data"
KB_PATH = DATA_DIR / "knowledge_base"
CHAT_HISTORY_PATH = DATA_DIR / "chat_history.jsonl"

