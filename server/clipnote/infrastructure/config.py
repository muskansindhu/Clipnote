"""Application settings loaded from environment variables."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from clipnote.constants import (
    DEFAULT_AI_DAILY_LIMIT,
    DEFAULT_GOOGLE_DISCOVERY_URL,
    DEFAULT_LOCAL_DATA_DIR,
    DEFAULT_OPENAI_MODEL,
)
from clipnote.infrastructure.errors import ConfigurationError


@dataclass(frozen=True)
class Settings:
    """Immutable, validated application configuration."""

    environment: str
    database_url: str
    jwt_secret: str
    google_client_id: str | None
    google_client_secret: str | None
    google_discovery_url: str
    openai_api_key: str | None
    openai_model: str
    apify_token: str | None
    s3_bucket: str | None
    aws_access_key: str | None
    aws_secret_key: str | None
    storage_backend: str
    llm_provider: str
    transcript_providers: tuple[str, ...]
    local_data_dir: Path
    trusted_proxies: int
    ai_daily_limit: int
    csp_report_only: bool

    @property
    def is_production(self) -> bool:
        """Return whether the app runs with production settings."""
        return self.environment.lower() == "production"


def _resolve_database_url(env: Mapping[str, str]) -> str | None:
    """Pick the database URL, keeping the legacy Supabase variable names working."""
    explicit = env.get("DATABASE_URL")
    if explicit:
        return explicit
    is_production = env.get("FLASK_ENV", "development").lower() == "production"
    preferred = f"IPv{4 if is_production else 6}_SUPABASE_CONNECTION_STRING"
    return env.get(preferred) or env.get("SUPABASE_CONNECTION_STRING")


def _parse_count(value: str, name: str) -> int:
    """Parse a non-negative whole number from an environment variable."""
    try:
        count = int(value)
    except ValueError as exc:
        raise ConfigurationError(f"{name} must be a whole number, got {value!r}.") from exc
    if count < 0:
        raise ConfigurationError(f"{name} must not be negative.")
    return count


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Build settings from ``env`` (defaults to ``os.environ`` after loading ``.env``).

    Args:
        env: Optional mapping used instead of the process environment (tests).

    Returns:
        The validated settings.

    Raises:
        ConfigurationError: If the database URL or JWT secret is missing.
    """
    if env is None:
        load_dotenv()
        env = os.environ

    database_url = _resolve_database_url(env)
    if not database_url:
        raise ConfigurationError(
            "Set DATABASE_URL (or SUPABASE_CONNECTION_STRING) to a Postgres connection string."
        )
    jwt_secret = env.get("JWT_SECRET")
    if not jwt_secret:
        raise ConfigurationError("Set JWT_SECRET to a long random string.")

    providers = tuple(
        name.strip()
        for name in env.get("TRANSCRIPT_PROVIDERS", "youtube_transcript_api,apify").split(",")
        if name.strip()
    )
    return Settings(
        environment=env.get("FLASK_ENV", "development"),
        database_url=database_url,
        jwt_secret=jwt_secret,
        google_client_id=env.get("GOOGLE_CLIENT_ID"),
        google_client_secret=env.get("GOOGLE_CLIENT_SECRET"),
        google_discovery_url=env.get("GOOGLE_DISCOVERY_URL", DEFAULT_GOOGLE_DISCOVERY_URL),
        openai_api_key=env.get("OPENAI_API_KEY"),
        openai_model=env.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
        apify_token=env.get("APIFY_TOKEN"),
        s3_bucket=env.get("S3_BUCKET"),
        aws_access_key=env.get("ACCESS_KEY"),
        aws_secret_key=env.get("SECRET_KEY"),
        storage_backend=env.get("STORAGE_BACKEND", "s3"),
        llm_provider=env.get("LLM_PROVIDER", "openai"),
        transcript_providers=providers,
        local_data_dir=Path(env.get("LOCAL_DATA_DIR", str(DEFAULT_LOCAL_DATA_DIR))),
        trusted_proxies=_parse_count(env.get("TRUSTED_PROXIES", "0"), "TRUSTED_PROXIES"),
        ai_daily_limit=_parse_count(
            env.get("AI_DAILY_LIMIT", str(DEFAULT_AI_DAILY_LIMIT)), "AI_DAILY_LIMIT"
        ),
        csp_report_only=env.get("CSP_REPORT_ONLY", "").strip().lower() in {"1", "true", "yes"},
    )
