# config.py - Static application configuration only
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).parent
CHAT_DIR = BASE_DIR / "conversations"
CHAT_DIR.mkdir(exist_ok=True)

NOTEBOOKS_DIR = BASE_DIR / "notebooks"
NOTEBOOKS_DIR.mkdir(exist_ok=True)

DATA_REFERENCES_DIR = BASE_DIR / "data" / "references"
DATA_REFERENCES_DIR.mkdir(parents=True, exist_ok=True)

# Server configuration
WS_HOST = "127.0.0.1"
WS_PORT = 8000

# External services
SEARXNG_BASE_URL = "http://127.0.0.1:8888"

# Available options (for UI dropdowns)
AVAILABLE_PROVIDERS = ["Groq"]  # Future: OpenAI, Anthropic, etc.
AVAILABLE_MODELS = {
    "Groq": [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b"
    ]
}
EMBEDDING_MODELS = ["BGE Small", "GTE Small", "Bert Multilingual"]
DEFAULT_EMBEDDING_MODEL = "BGE Small"

# Feature availability checks
def check_web_deps():
    try:
        import aiohttp, requests
        return True
    except ImportError as e:
        print(f"[CONFIG] Missing web deps: {e}")
        return False

WEB_SEARCH_AVAILABLE = check_web_deps()
