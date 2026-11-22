"""Database health probe."""

from __future__ import annotations

import logging

import psycopg

from clipnote.constants import HEALTH_DB_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)


class PostgresHealthProbe:
    """Checks that Postgres answers ``SELECT 1`` within a short timeout."""

    def __init__(self, url: str) -> None:
        self._url = url

    def is_database_reachable(self) -> bool:
        """Return ``True`` when the query succeeds; log and return ``False`` otherwise."""
        try:
            with psycopg.connect(self._url, connect_timeout=HEALTH_DB_TIMEOUT_SECONDS) as conn:
                conn.execute("SELECT 1")
        except psycopg.Error:
            logger.warning("Database health check failed", exc_info=True)
            return False
        return True
