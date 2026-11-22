"""The Postgres daily AI allowance against a real database."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest

from clipnote.infrastructure.db import Database, PostgresAiBudget

pytestmark = pytest.mark.integration


def _budget(database_url: str, limit: int) -> PostgresAiBudget:
    return PostgresAiBudget(Database(database_url), limit)


def test_allows_calls_up_to_the_limit_then_refuses(database_url: str) -> None:
    budget = _budget(database_url, 3)

    results = [budget.try_consume("alice") for _ in range(4)]

    assert results == [True, True, True, False]


def test_users_have_separate_allowances(database_url: str) -> None:
    budget = _budget(database_url, 1)
    budget.try_consume("alice")

    assert budget.try_consume("bob") is True


def test_zero_limit_means_no_cap(database_url: str) -> None:
    budget = _budget(database_url, 0)

    assert all(budget.try_consume("alice") for _ in range(20))


def test_parallel_calls_never_exceed_the_limit(database_url: str) -> None:
    budget = _budget(database_url, 5)

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda _: budget.try_consume("alice"), range(30)))

    assert results.count(True) == 5
