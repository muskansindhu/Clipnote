"""An in-process sliding-window rate limiter."""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from collections.abc import Callable

from clipnote.application.ports import RateLimitDecision
from clipnote.constants import RATE_LIMIT_PRUNE_EVERY


class InMemoryRateLimiter:
    """Remembers recent request times per key.

    State lives in this process, so it resets on restart and is not shared between
    instances. That is enough for one container; use a shared store (Redis) before
    running several.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = {}
        self._windows: dict[str, int] = {}
        self._calls = 0

    def hit(self, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        """Record a request and decide whether it fits within ``limit`` per window."""
        now = self._clock()
        with self._lock:
            self._calls += 1
            if self._calls % RATE_LIMIT_PRUNE_EVERY == 0:
                self._prune(now)
            hits = self._hits.setdefault(key, deque())
            self._windows[key] = window_seconds
            while hits and hits[0] <= now - window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                wait = math.ceil(hits[0] + window_seconds - now)
                return RateLimitDecision(allowed=False, retry_after_seconds=max(1, wait))
            hits.append(now)
            return RateLimitDecision(allowed=True)

    def _prune(self, now: float) -> None:
        """Drop keys whose every hit is outside their window, so memory stays bounded."""
        for key in [
            k for k, hits in self._hits.items() if not hits or hits[-1] <= now - self._windows[k]
        ]:
            del self._hits[key]
            del self._windows[key]
