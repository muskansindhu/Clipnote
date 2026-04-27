from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

USERNAME_FALLBACK = "user"
USERNAME_SANITISE_PATTERN = re.compile(r"[^a-zA-Z0-9_]+")


def issue_access_token(
    *,
    user_id: str,
    username: str | None,
    email: str | None,
    jwt_secret: str,
    picture: str | None = None,
) -> str:
    """Create a signed Clipnote access token for an authenticated user."""
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=15),
    }
    if username:
        payload["username"] = username
    if email:
        payload["email"] = email
    if picture:
        payload["picture"] = picture
    return jwt.encode(payload, jwt_secret, algorithm="HS256")


def issue_guest_access_token(
    *,
    guest_id: str,
    jwt_secret: str,
    clipchat_usage: dict[str, int] | None = None,
    trial_start: str | None = None,
    expires_at: datetime | None = None,
) -> str:
    """Create a signed Clipnote access token for a Clipchat trial guest."""
    issued_at = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(guest_id),
        "exp": expires_at or (issued_at + timedelta(days=3)),
        "trial_start": trial_start or issued_at.isoformat(),
        "account_tier": "clipchat_trial",
        "clipchat_usage": clipchat_usage or {},
    }
    return jwt.encode(payload, jwt_secret, algorithm="HS256")


def normalise_username(raw_username: Any) -> str:
    """Trim a user-provided username while preserving its casing."""
    return str(raw_username or "").strip()


def normalise_email(raw_email: Any) -> str:
    """Trim and lowercase a user email for consistent storage and lookup."""
    return str(raw_email or "").strip().lower()


def derive_username_from_email(email: str) -> str:
    """Build a safe default username candidate from an email address."""
    local_part = email.split("@", 1)[0]
    sanitised = USERNAME_SANITISE_PATTERN.sub("_", local_part).strip("_")
    return sanitised or USERNAME_FALLBACK
