"""Rules for usernames and emails."""

from __future__ import annotations

from typing import Any

from clipnote.constants import (
    USERNAME_FALLBACK,
    USERNAME_SANITISE_PATTERN,
)


def normalise_username(raw_username: Any) -> str:
    """Trim a user-provided username while preserving its casing."""
    return str(raw_username or "").strip()


def normalise_email(raw_email: Any) -> str:
    """Trim and lowercase an email for consistent storage and lookup."""
    return str(raw_email or "").strip().lower()


def derive_username_from_email(email: str) -> str:
    """Build a safe default username candidate from an email address."""
    local_part = email.split("@", 1)[0]
    sanitised = USERNAME_SANITISE_PATTERN.sub("_", local_part).strip("_")
    return sanitised or USERNAME_FALLBACK
