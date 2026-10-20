"""Signed access tokens (JWT, HS256)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from clipnote.application import AccessClaims
from clipnote.domain import AuthenticationError, User

TOKEN_LIFETIME = timedelta(days=15)
ALGORITHM = "HS256"


class JwtAccessTokenCodec:
    """Issues and verifies the bearer tokens used by the web app and extension."""

    def __init__(self, secret: str) -> None:
        self._secret = secret

    def issue(self, user: User, *, picture: str | None = None) -> str:
        payload: dict[str, Any] = {
            "sub": user.id,
            "exp": datetime.now(UTC) + TOKEN_LIFETIME,
            "username": user.username,
            "email": user.email,
        }
        if picture:
            payload["picture"] = picture
        return jwt.encode(payload, self._secret, algorithm=ALGORITHM)

    def decode(self, token: str) -> AccessClaims:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationError("Token expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationError("Invalid token") from exc
        subject = payload.get("sub")
        if not subject:
            raise AuthenticationError("Invalid token")
        return AccessClaims(
            user_id=str(subject), username=payload.get("username"), email=payload.get("email")
        )
