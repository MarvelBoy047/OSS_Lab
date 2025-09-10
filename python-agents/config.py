from pathlib import Path

BASE_DIR = Path(__file__).parent

GROQ_API_KEY = ""

SEARXNG_BASE_URL = "http://127.0.0.1:8888"

DATA_REFERENCES_DIR = BASE_DIR / "data" / "references"
DATA_REFERENCES_DIR.mkdir(parents=True, exist_ok=True)

def check_web_deps():
    try:
        import aiohttp, requests
        return True
    except ImportError as e:
        print(f"[CONFIG] Missing deps: {e}")
        return False

WEB_SEARCH_AVAILABLE = check_web_deps()

EMBEDDING_MODELS = ["BGE Small", "GTE Small", "Bert Multilingual"]
DEFAULT_EMBEDDING_MODEL = "BGE Small"

MODELS = {
    "default": {
        "model": "openai/gpt-oss-120b",
        "api_key": GROQ_API_KEY,
        "temperature": 0.8,
        "top_p": 0.9,
        "stream": False,
    }
}

CHAT_DIR = BASE_DIR / "conversations"
CHAT_DIR.mkdir(exist_ok=True)

NOTEBOOKS_DIR = BASE_DIR / "notebooks"
NOTEBOOKS_DIR.mkdir(exist_ok=True)

WS_HOST = "127.0.0.1"
WS_PORT = 8000
