"""Per-route rate limiting for the HTTP layer."""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Literal, ParamSpec, TypeVar

from flask import g, request

from clipnote.constants import RATE_LIMIT_MESSAGE
from clipnote.domain import RateLimitError
from clipnote.interfaces.http.auth import container

P = ParamSpec("P")
R = TypeVar("R")


def rate_limited(
    scope: str, limit: tuple[int, int], *, by: Literal["ip", "user"] = "ip"
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Reject requests beyond ``limit`` (requests, seconds) with a 429.

    Args:
        scope: Name of the limited action; each scope counts separately.
        limit: ``(requests, per_seconds)``.
        by: Count per client IP, or per signed-in user. ``"user"`` must sit below
            ``login_required`` so the caller is known.
    """
    requests, window = limit

    def decorator(view: Callable[P, R]) -> Callable[P, R]:
        @wraps(view)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            who = str(g.user_id) if by == "user" else (request.remote_addr or "unknown")
            decision = container().rate_limiter.hit(f"{scope}:{who}", requests, window)
            if not decision.allowed:
                raise RateLimitError(RATE_LIMIT_MESSAGE, decision.retry_after_seconds)
            return view(*args, **kwargs)

        return wrapper

    return decorator
