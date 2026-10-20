"""Personal API tokens, used by the iOS Shortcut to save notes."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass

from clipnote.application.ports import ApiTokenRepository
from clipnote.domain import ApiToken, AuthenticationError, NotFoundError, ValidationError

TOKEN_PREFIX = "cn_"  # noqa: S105  # public marker, not a secret
CAPTURE_SCOPE = "capture"
MAX_ACTIVE_TOKENS = 10
MAX_LABEL_LENGTH = 60
DISPLAY_PREFIX_LENGTH = 8


@dataclass(frozen=True, slots=True)
class CreatedToken:
    """A freshly created token. ``secret`` is shown to the user exactly once."""

    secret: str
    record: ApiToken


def hash_token(secret: str) -> str:
    """Return the storage hash of a token secret."""
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


class ApiTokenService:
    """Creates, authenticates and revokes capture-only API tokens."""

    def __init__(self, tokens: ApiTokenRepository) -> None:
        self._tokens = tokens

    def create(self, user_id: str, label: str) -> CreatedToken:
        """Create a capture-scoped token.

        Raises:
            ValidationError: If the label is invalid or the user has too many tokens.
        """
        label = label.strip() or "Shortcut"
        if len(label) > MAX_LABEL_LENGTH:
            raise ValidationError(f"Label must be at most {MAX_LABEL_LENGTH} characters")
        active = sum(token.is_active for token in self._tokens.list_for_user(user_id))
        if active >= MAX_ACTIVE_TOKENS:
            raise ValidationError(f"You can have at most {MAX_ACTIVE_TOKENS} active tokens")

        secret = TOKEN_PREFIX + secrets.token_urlsafe(32)
        record = self._tokens.add(
            user_id=user_id,
            label=label,
            scope=CAPTURE_SCOPE,
            token_hash=hash_token(secret),
            prefix=secret[:DISPLAY_PREFIX_LENGTH],
        )
        return CreatedToken(secret=secret, record=record)

    def authenticate(self, secret: str, *, required_scope: str = CAPTURE_SCOPE) -> ApiToken:
        """Verify a token secret and record its use.

        Raises:
            AuthenticationError: If the token is unknown, revoked or lacks the scope.
        """
        record = self._tokens.get_by_hash(hash_token(secret))
        if record is None or not record.is_active:
            raise AuthenticationError("Invalid or revoked API token")
        if record.scope != required_scope:
            raise AuthenticationError("This API token cannot be used here")
        self._tokens.touch(record.id)
        return record

    def list_for_user(self, user_id: str) -> list[ApiToken]:
        """List the user's tokens, newest first."""
        return self._tokens.list_for_user(user_id)

    def revoke(self, user_id: str, token_id: int) -> None:
        """Revoke one of the user's tokens.

        Raises:
            NotFoundError: If the token does not belong to the user.
        """
        if not self._tokens.revoke(user_id, token_id):
            raise NotFoundError("Token not found")
