"""The Postgres health probe against a real database."""

from __future__ import annotations

from collections.abc import Callable

import pytest

from clipnote.infrastructure.db import PostgresHealthProbe

pytestmark = pytest.mark.integration


def test_reachable_database_reports_true(make_database: Callable[[], str]) -> None:
    assert PostgresHealthProbe(make_database()).is_database_reachable() is True


def test_unreachable_database_reports_false() -> None:
    probe = PostgresHealthProbe("postgresql://nobody:wrong@127.0.0.1:1/none")

    assert probe.is_database_reachable() is False
