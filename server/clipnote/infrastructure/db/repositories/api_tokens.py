"""Postgres implementation of the API token repository."""

from __future__ import annotations

from clipnote.domain import ApiToken
from clipnote.infrastructure.db.connection import Database, Row

_COLUMNS = "id, user_id, label, scope, token_prefix, created_at, last_used_at, revoked_at"


def _to_token(row: Row) -> ApiToken:
    return ApiToken(
        id=row["id"],
        user_id=row["user_id"],
        label=row["label"],
        scope=row["scope"],
        prefix=row["token_prefix"],
        created_at=row["created_at"],
        last_used_at=row["last_used_at"],
        revoked_at=row["revoked_at"],
    )


class PostgresApiTokenRepository:
    """Token metadata and hashes in the ``api_tokens`` table."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def add(
        self, *, user_id: str, label: str, scope: str, token_hash: str, prefix: str
    ) -> ApiToken:
        with self._db.connection() as conn:
            row = conn.execute(
                f"""
                INSERT INTO api_tokens (user_id, label, scope, token_hash, token_prefix)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING {_COLUMNS}
                """,
                (user_id, label, scope, token_hash, prefix),
            ).fetchone()
        assert row is not None  # noqa: S101  # RETURNING always yields a row
        return _to_token(row)

    def get_by_hash(self, token_hash: str) -> ApiToken | None:
        with self._db.connection() as conn:
            row = conn.execute(
                f"SELECT {_COLUMNS} FROM api_tokens WHERE token_hash = %s", (token_hash,)
            ).fetchone()
        return _to_token(row) if row else None

    def list_for_user(self, user_id: str) -> list[ApiToken]:
        with self._db.connection() as conn:
            rows = conn.execute(
                f"SELECT {_COLUMNS} FROM api_tokens WHERE user_id = %s ORDER BY id DESC",
                (user_id,),
            ).fetchall()
        return [_to_token(row) for row in rows]

    def revoke(self, user_id: str, token_id: int) -> bool:
        with self._db.connection() as conn:
            cur = conn.execute(
                """
                UPDATE api_tokens SET revoked_at = now()
                WHERE id = %s AND user_id = %s AND revoked_at IS NULL
                """,
                (token_id, user_id),
            )
        return cur.rowcount > 0

    def touch(self, token_id: int) -> None:
        with self._db.connection() as conn:
            conn.execute("UPDATE api_tokens SET last_used_at = now() WHERE id = %s", (token_id,))
