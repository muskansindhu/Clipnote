"""Postgres implementation of the user repository."""

from __future__ import annotations

from clipnote.domain import User
from clipnote.infrastructure.db.connection import Database, Row

_COLUMNS = "id, username, email, password_hash, google_sub"


def _to_user(row: Row) -> User:
    return User(
        id=str(row["id"]),
        username=row["username"],
        email=row["email"],
        password_hash=row["password_hash"],
        google_sub=row["google_sub"],
    )


class PostgresUserRepository:
    """Users stored in the ``users`` table."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def get_by_id(self, user_id: str) -> User | None:
        with self._db.connection() as conn:
            row = conn.execute(f"SELECT {_COLUMNS} FROM users WHERE id = %s", (user_id,)).fetchone()
        return _to_user(row) if row else None

    def get_by_email(self, email: str) -> User | None:
        with self._db.connection() as conn:
            row = conn.execute(
                f"SELECT {_COLUMNS} FROM users WHERE lower(email) = lower(%s)", (email,)
            ).fetchone()
        return _to_user(row) if row else None

    def get_by_google_sub(self, google_sub: str) -> User | None:
        with self._db.connection() as conn:
            row = conn.execute(
                f"SELECT {_COLUMNS} FROM users WHERE google_sub = %s", (google_sub,)
            ).fetchone()
        return _to_user(row) if row else None

    def username_exists(self, username: str, *, exclude_user_id: str | None = None) -> bool:
        with self._db.connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM users WHERE username = %s AND (%s::text IS NULL OR id <> %s)",
                (username, exclude_user_id, exclude_user_id),
            ).fetchone()
        return row is not None

    def add(
        self, *, username: str, email: str, password_hash: str | None, google_sub: str | None
    ) -> User:
        with self._db.connection() as conn:
            row = conn.execute(
                f"""
                INSERT INTO users (username, email, password_hash, google_sub)
                VALUES (%s, %s, %s, %s)
                RETURNING {_COLUMNS}
                """,
                (username, email, password_hash, google_sub),
            ).fetchone()
        assert row is not None  # noqa: S101  # RETURNING always yields a row
        return _to_user(row)

    def set_credentials(
        self, user_id: str, *, username: str, email: str, password_hash: str
    ) -> None:
        with self._db.connection() as conn:
            conn.execute(
                "UPDATE users SET username = %s, email = %s, password_hash = %s WHERE id = %s",
                (username, email, password_hash, user_id),
            )

    def set_google_sub(self, user_id: str, google_sub: str) -> None:
        with self._db.connection() as conn:
            conn.execute("UPDATE users SET google_sub = %s WHERE id = %s", (google_sub, user_id))

    def set_password_hash(self, user_id: str, password_hash: str) -> None:
        with self._db.connection() as conn:
            conn.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, user_id)
            )
