"""The in-memory sliding-window rate limiter."""

from __future__ import annotations

from clipnote.infrastructure.ratelimit import InMemoryRateLimiter


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_blocks() -> None:
    limiter = InMemoryRateLimiter(Clock())

    results = [limiter.hit("k", 3, 60).allowed for _ in range(4)]

    assert results == [True, True, True, False]


def test_blocked_call_reports_when_to_retry() -> None:
    clock = Clock()
    limiter = InMemoryRateLimiter(clock)
    limiter.hit("k", 1, 60)
    clock.now += 10

    decision = limiter.hit("k", 1, 60)

    assert not decision.allowed
    assert decision.retry_after_seconds == 50


def test_window_slides_so_old_hits_expire() -> None:
    clock = Clock()
    limiter = InMemoryRateLimiter(clock)
    limiter.hit("k", 1, 60)
    clock.now += 61

    assert limiter.hit("k", 1, 60).allowed


def test_keys_are_counted_separately() -> None:
    limiter = InMemoryRateLimiter(Clock())
    limiter.hit("a", 1, 60)

    assert limiter.hit("b", 1, 60).allowed


def test_idle_keys_are_pruned() -> None:
    clock = Clock()
    limiter = InMemoryRateLimiter(clock)
    for index in range(600):
        limiter.hit(f"user-{index}", 5, 60)
    clock.now += 120
    for _ in range(500):
        limiter.hit("busy", 1000, 60)

    assert len(limiter._hits) == 1  # noqa: SLF001  # white-box check that memory stays bounded
