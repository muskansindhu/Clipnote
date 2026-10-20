"""Every named constant in the application, in one place.

Only the standard library is imported here, so every layer (domain, application,
infrastructure and interfaces) may import from this module without breaking the
dependency rule.
"""

from __future__ import annotations

import re
from datetime import timedelta
from pathlib import Path
from typing import Any

# --- Paths ---------------------------------------------------------------------------

PACKAGE_DIR = Path(__file__).resolve().parent
SERVER_DIR = PACKAGE_DIR.parent
DEFAULT_LOCAL_DATA_DIR = SERVER_DIR / ".local-data"
MIGRATIONS_DIR = PACKAGE_DIR / "infrastructure" / "db" / "migrations"

# --- Server --------------------------------------------------------------------------

DEFAULT_HOST = "0.0.0.0"  # noqa: S104  # the app runs inside a container
DEFAULT_PORT = 5001
BACKGROUND_WORKERS = 4
TEMP_TOKEN_COOKIE_SECONDS = 60
CLIPCHAT_STREAM_CHUNK_CHARS = 28
CLIPCHAT_ANSWER_FAILED_MESSAGE = "Clipchat could not answer right now"

# --- Time ----------------------------------------------------------------------------

SECONDS_PER_MINUTE = 60
SECONDS_PER_HOUR = 3600
ONE_DAY = timedelta(days=1)

# --- Accounts and security -----------------------------------------------------------

USERNAME_FALLBACK = "user"
MIN_PASSWORD_LENGTH = 6
USERNAME_SANITISE_PATTERN = re.compile(r"[^a-zA-Z0-9_]+")
ACCESS_TOKEN_LIFETIME = timedelta(days=15)
JWT_ALGORITHM = "HS256"
RETIRED_TRIAL_PREFIX = "guest_"
GOOGLE_ONLY_LOGIN_MESSAGE = (
    "This account uses Google sign-in. Use Google login or add a password first."
)

# --- API tokens ----------------------------------------------------------------------

API_TOKEN_PREFIX = "cn_"  # noqa: S105  # public marker, not a secret
CAPTURE_SCOPE = "capture"
MAX_ACTIVE_TOKENS = 10
API_TOKEN_LABEL_MAX_LENGTH = 60
API_TOKEN_DISPLAY_PREFIX_LENGTH = 8

# --- Notes and library ---------------------------------------------------------------

PAGE_SIZE = 10
STATS_WINDOW_DAYS = 7
DUPLICATE_WINDOW_SECONDS = 60
DEFAULT_VIDEO_TITLE = "YouTube video"
SORT_RECENT = "recent"
SORT_TITLE = "title"
LABEL_NAME_MAX_LENGTH = 60
RECOVERY_BATCH_SIZE = 100
DEFAULT_SNIPPET_WINDOW_SECONDS = 15

# --- YouTube -------------------------------------------------------------------------

VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
    }
)
YOUTUBE_SHORT_HOSTS = frozenset({"youtu.be", "www.youtu.be"})
YOUTUBE_ID_PATH_PREFIXES = frozenset({"shorts", "embed", "live", "v"})
START_TIME_PATTERN = re.compile(r"^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$")
START_TIME_PARAMS = ("t", "start", "time_continue")
OEMBED_URL = "https://www.youtube.com/oembed"
OEMBED_TIMEOUT_SECONDS = 4

# --- Transcripts ---------------------------------------------------------------------

TRANSCRIPT_PREFERRED_LANGUAGES = ("en", "en-US", "en-GB")
APIFY_ACTOR_ID = "pintostudio/youtube-transcript-scraper"
APIFY_RUN_TIMEOUT_SECONDS = 20

# --- Configuration defaults ----------------------------------------------------------

DEFAULT_GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

# --- Clipchat ------------------------------------------------------------------------

MAX_CLIPCHAT_CONTEXT_TOKENS = 120_000
CLIPCHAT_CHUNK_CHAR_BUDGET = 90_000
CLIPCHAT_CHUNK_OVERLAP_ENTRIES = 3
MAX_CLIPCHAT_ITERATION_CHUNKS = 5
RETRIEVAL_CONTEXT_WINDOW = 2
RETRIEVAL_MAX_HITS = 24
RETRIEVAL_STOP_WORDS = {
    "a",
    "about",
    "all",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "do",
    "does",
    "for",
    "from",
    "how",
    "i",
    "in",
    "into",
    "is",
    "it",
    "key",
    "main",
    "moments",
    "of",
    "on",
    "show",
    "speaker",
    "takeaways",
    "tell",
    "that",
    "the",
    "this",
    "to",
    "transcript",
    "video",
    "what",
    "where",
    "which",
    "who",
    "why",
    "with",
}
CLIPCHAT_SCHEMA_NAME = "clipchat_response"
CLIPCHAT_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["answer"],
    "properties": {"answer": {"type": "string"}},
}
CITATION_BLOCK_PATTERN = re.compile(r"\[([^\[\]]+)\]")
TIMESTAMP_TOKEN_PATTERN = re.compile(r"\d+:\d{1,2}(?::\d{1,2})?|\d+(?:\.\d+)?")
TIMESTAMP_LABEL_PATTERN = re.compile(
    r"\(?\s*timestamps?\s*:\s*((?:\[\d+\](?:\s+\[\d+\])*))\s*\)?",
    re.IGNORECASE,
)
PARENTHESISED_CITATION_PATTERN = re.compile(r"\(\s*((?:\[\d+\](?:\s+\[\d+\])*))\s*\)")

# --- Prompts -------------------------------------------------------------------------

SUMMARY_SYSTEM_PROMPT = """You summarize video transcripts into exactly five concise bullet points.
Return only the five bullets and do not add any introduction or closing text."""

VIDEO_SUMMARY_SYSTEM_PROMPT = """You write a short and concise video summary.
Use only the provided transcript, keep the response within 100-150 words, and return only the summary text."""

AI_NOTE_SYSTEM_PROMPT = """You write a single-line note from a short transcript snippet.
Return only the note text and do not add labels, bullets, or extra commentary."""

CLIPCHAT_SYSTEM_PROMPT_TEMPLATE = """You are Clipchat, an AI assistant dedicated to this specific video: "{title}".
Use ONLY the provided transcript as your context.
Answer the user's question based ONLY on the transcript.
If the answer is not in the transcript, say so.

Return ONLY a valid JSON object with this exact shape:
{{"answer":"string"}}

Timestamps:
- When you cite a moment from the video, use inline citations with raw seconds inside square brackets.
- Examples: [135], [6238].
- Do not use mm:ss or hh:mm:ss in the answer. The frontend will format the seconds.
- Do not write labels such as "Timestamp:" or "Timestamps:" anywhere in the answer.
- Do not wrap citations in parentheses.
- Cite a single relevant timestamp per citation. Do not use ranges or dashes.
- If multiple nearby timestamps are relevant and they are within 15 seconds of each other, cite only the first timestamp.

Formatting:
- When you provide a direct answer to the user's question, wrap that answer in **bold**.
- When you state the main point of the response, wrap that main point in **bold**.
- Use clear, readable formatting with line breaks where helpful.

Out-of-scope:
- If the user's query is not about the video or goes beyond the transcript, reply: "I am Clipchat - assistant to help you with this video. I can't answer this question."

Transcript:
{transcript}
"""
