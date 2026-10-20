"""Sign-up, sign-in and password management."""

from __future__ import annotations

from clipnote.application.ports import AccessTokenCodec, PasswordHasher, UserRepository
from clipnote.constants import (
    GOOGLE_ONLY_LOGIN_MESSAGE,
    MIN_PASSWORD_LENGTH,
)
from clipnote.domain import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    User,
    ValidationError,
    derive_username_from_email,
    normalise_email,
    normalise_username,
)


class AuthService:
    """Use cases for accounts and credentials."""

    def __init__(
        self, users: UserRepository, hasher: PasswordHasher, tokens: AccessTokenCodec
    ) -> None:
        self._users = users
        self._hasher = hasher
        self._tokens = tokens

    def login(self, email: str, password: str) -> str:
        """Authenticate with email and password and return an access token.

        Raises:
            ValidationError: If either field is empty.
            AuthenticationError: If the credentials are wrong or the account is Google-only.
        """
        email = normalise_email(email)
        if not email or not password:
            raise ValidationError("Email and password required")

        user = self._users.get_by_email(email)
        if user is None:
            raise AuthenticationError("Invalid credentials")
        if not user.password_hash:
            if user.google_sub:
                raise AuthenticationError(GOOGLE_ONLY_LOGIN_MESSAGE)
            raise AuthenticationError("Invalid credentials")
        if not self._hasher.verify(user.password_hash, password):
            raise AuthenticationError("Invalid credentials")
        return self._tokens.issue(user)

    def signup(self, username: str, email: str, password: str) -> str:
        """Create an account (or add a password to a Google-only one) and sign it in.

        Raises:
            ValidationError: If a field is missing or the password is too short.
            ConflictError: If the email or username is already taken.
        """
        username = normalise_username(username)
        email = normalise_email(email)
        if not username or not email or not password:
            raise ValidationError("Username, email, and password required")
        if len(password) < MIN_PASSWORD_LENGTH:
            raise ValidationError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")

        password_hash = self._hasher.hash(password)
        existing = self._users.get_by_email(email)
        if existing is not None:
            if existing.password_hash:
                raise ConflictError("Email already exists")
            if self._users.username_exists(username, exclude_user_id=existing.id):
                raise ConflictError("Username already exists")
            self._users.set_credentials(
                existing.id, username=username, email=email, password_hash=password_hash
            )
            user = User(existing.id, username, email, password_hash, existing.google_sub)
        else:
            if self._users.username_exists(username):
                raise ConflictError("Username already exists")
            user = self._users.add(
                username=username, email=email, password_hash=password_hash, google_sub=None
            )
        return self._tokens.issue(user)

    def login_with_google(self, *, email: str, google_sub: str, picture: str | None) -> str:
        """Sign in with a verified Google identity, linking or creating the account.

        Raises:
            ValidationError: If Google did not return an email and subject.
        """
        email = normalise_email(email)
        if not email or not google_sub:
            raise ValidationError("Google account info missing")

        user = self._users.get_by_google_sub(google_sub)
        if user is None:
            user = self._users.get_by_email(email)
            if user is not None:
                self._users.set_google_sub(user.id, google_sub)
            else:
                user = self._users.add(
                    username=self._available_username(email),
                    email=email,
                    password_hash=None,
                    google_sub=google_sub,
                )
        return self._tokens.issue(user, picture=picture)

    def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        """Change a password after verifying the current one.

        Raises:
            ValidationError: If the new password is too short, the current one is missing,
                or the account has no password (Google-only).
            NotFoundError: If the user does not exist.
            AuthenticationError: If the current password is wrong.
        """
        if len(new_password) < MIN_PASSWORD_LENGTH:
            raise ValidationError(
                f"New password must be at least {MIN_PASSWORD_LENGTH} characters."
            )
        user = self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        if not user.password_hash:
            raise ValidationError(
                "This account uses Google sign-in. Password changes are not available."
            )
        if not current_password:
            raise ValidationError("Current password is required.")
        if not self._hasher.verify(user.password_hash, current_password):
            raise AuthenticationError("Current password is incorrect.")
        self._users.set_password_hash(user.id, self._hasher.hash(new_password))

    def _available_username(self, email: str) -> str:
        base = derive_username_from_email(email)
        candidate, suffix = base, 1
        while self._users.username_exists(candidate):
            suffix += 1
            candidate = f"{base}{suffix}"
        return candidate
