"""Signed access tokens (JWT, HS256)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import jwt

from clipnote.application import AccessClaims
from clipnote.constants import (
    ACCESS_TOKEN_LIFETIME,
    JWT_ALGORITHM,
    RETIRED_TRIAL_PREFIX,
)
from clipnote.domain import AuthenticationError, User


class JwtAccessTokenCodec:
    """Issues and verifies the bearer tokens used by the web app and extension."""

    def __init__(self, secret: str) -> None:
        self._secret = secret

    def issue(self, user: User, *, picture: str | None = None) -> str:
        payload: dict[str, Any] = {
            "sub": user.id,
            "exp": datetime.now(UTC) + ACCESS_TOKEN_LIFETIME,
            "username": user.username,
            "email": user.email,
        }
        if picture:
            payload["picture"] = picture
        return jwt.encode(payload, self._secret, algorithm=JWT_ALGORITHM)

    def decode(self, token: str) -> AccessClaims:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationError("Token expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationError("Invalid token") from exc
        subject = payload.get("sub")
        # Trial tokens from the retired anonymous Clipchat trial must not authenticate.
        if not subject or str(subject).startswith(RETIRED_TRIAL_PREFIX):
            raise AuthenticationError("Invalid token")
        return AccessClaims(
            user_id=str(subject), username=payload.get("username"), email=payload.get("email")
        )
