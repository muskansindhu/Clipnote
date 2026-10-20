"""Postgres connection helper."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import DictRow, dict_row


class Database:
    """Opens short-lived connections; each ``with`` block is one transaction."""

    def __init__(self, url: str) -> None:
        self._url = url

    @contextmanager
    def connection(self) -> Iterator[psycopg.Connection[DictRow]]:
        """Yield a connection that commits on success and rolls back on error."""
        with psycopg.connect(self._url, row_factory=dict_row) as conn:
            yield conn


Row = dict[str, Any]
