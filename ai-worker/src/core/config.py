import os
from dotenv import load_dotenv

load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
QUEUE_NAME = os.getenv("RABBITMQ_QUEUE_SUBTITLES", "subtitles_tasks")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "shortlearn_secret")
DB_NAME = os.getenv("DB_NAME", "shortlearn_db")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip() or "llama-3.3-70b-versatile"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, min(value, maximum))


PRIMARY_LLM = os.getenv("PRIMARY_LLM", "groq").strip().lower()
if PRIMARY_LLM not in {"groq", "gemini"}:
    PRIMARY_LLM = "groq"

# A batch keeps one LLM request small enough for stable JSON while avoiding one
# network round-trip per subtitle sentence. The bound prevents accidental cost
# and latency spikes from a malformed environment variable.
LLM_BATCH_SIZE = _bounded_int("LLM_BATCH_SIZE", default=6, minimum=1, maximum=12)

# Local Whisper is the default so subtitle generation does not depend on a
# paid cloud key. Set WHISPER_PROVIDER=groq to prefer Groq while retaining the
# local engine as a fallback.
WHISPER_PROVIDER = os.getenv("WHISPER_PROVIDER", "local").strip().lower()
if WHISPER_PROVIDER not in {"local", "groq"}:
    WHISPER_PROVIDER = "local"

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base.en").strip() or "base.en"
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu").strip().lower() or "cpu"
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8").strip() or "int8"
WHISPER_MODEL_DIR = os.getenv("WHISPER_MODEL_DIR", "").strip() or None
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "en").strip().lower() or "en"
WHISPER_CPU_THREADS = _bounded_int("WHISPER_CPU_THREADS", default=4, minimum=1, maximum=32)
WHISPER_BEAM_SIZE = _bounded_int("WHISPER_BEAM_SIZE", default=5, minimum=1, maximum=10)
WHISPER_VAD_MIN_SILENCE_MS = _bounded_int(
    "WHISPER_VAD_MIN_SILENCE_MS", default=500, minimum=100, maximum=5000
)
