"""Postgres-backed daily AI allowance."""

from __future__ import annotations

from clipnote.infrastructure.db.connection import Database

# The WHERE clause makes the check and the increment one atomic statement, so concurrent
# requests can never push a user past the limit.
_CONSUME = """
INSERT INTO ai_usage (user_id, day, calls)
VALUES (%(user_id)s, (now() AT TIME ZONE 'utc')::date, 1)
ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_usage.calls + 1
WHERE ai_usage.calls < %(limit)s
RETURNING calls
"""


class PostgresAiBudget:
    """Counts AI calls per user per UTC day in the ``ai_usage`` table."""

    def __init__(self, db: Database, daily_limit: int) -> None:
        self._db = db
        self._limit = daily_limit

    def try_consume(self, user_id: str) -> bool:
        """Use one call; ``False`` once ``daily_limit`` is reached. A limit of 0 means no cap."""
        if self._limit <= 0:
            return True
        with self._db.connection() as conn:
            row = conn.execute(_CONSUME, {"user_id": user_id, "limit": self._limit}).fetchone()
        return row is not None
