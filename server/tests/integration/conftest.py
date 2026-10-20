"""Fixtures for tests that need a real Postgres (``docker compose up -d db``)."""

from __future__ import annotations

import os
import uuid
from collections.abc import Callable, Iterator

import psycopg
import pytest
from psycopg import sql

from clipnote.infrastructure.db.migrate import apply_migrations

ADMIN_URL = os.environ.get(
    "CLIPNOTE_TEST_DATABASE_URL", "postgresql://clipnote:clipnote@localhost:5433/postgres"
)


def _url_for(database: str) -> str:
    return ADMIN_URL.rsplit("/", 1)[0] + f"/{database}"


@pytest.fixture
def make_database() -> Iterator[Callable[[], str]]:
    """Return a factory creating throw-away databases, dropped after the test."""
    created: list[str] = []

    def factory() -> str:
        name = f"clipnote_test_{uuid.uuid4().hex[:10]}"
        try:
            with psycopg.connect(ADMIN_URL, autocommit=True, connect_timeout=2) as conn:
                conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        except psycopg.OperationalError:
            pytest.skip("Postgres is not reachable; run `docker compose up -d db`")
        created.append(name)
        return _url_for(name)

    yield factory

    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        for name in created:
            conn.execute(
                sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name))
            )


@pytest.fixture
def database_url(make_database: Callable[[], str]) -> str:
    """A freshly migrated database."""
    url = make_database()
    apply_migrations(url)
    return url
