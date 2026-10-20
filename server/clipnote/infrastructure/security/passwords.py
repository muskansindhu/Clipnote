"""Password hashing with Werkzeug."""

from __future__ import annotations

from werkzeug.security import check_password_hash, generate_password_hash


class WerkzeugPasswordHasher:
    """Salted password hashes compatible with the ones already stored."""

    def hash(self, password: str) -> str:
        return generate_password_hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        return check_password_hash(password_hash, password)
