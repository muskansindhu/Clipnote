"""Spending the per-user daily AI allowance."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from clipnote.application.ports import AiBudget
from clipnote.constants import AI_DAILY_LIMIT_MESSAGE
from clipnote.domain import RateLimitError


def seconds_until_next_utc_day(now: datetime | None = None) -> int:
    """Seconds until the daily allowance resets at 00:00 UTC."""
    current = now or datetime.now(UTC)
    tomorrow = (current + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((tomorrow - current).total_seconds())


def spend_ai_call(budget: AiBudget, user_id: str) -> None:
    """Count one AI call for ``user_id``.

    Raises:
        RateLimitError: If today's allowance is already used up.
    """
    if not budget.try_consume(user_id):
        raise RateLimitError(AI_DAILY_LIMIT_MESSAGE, seconds_until_next_utc_day())
