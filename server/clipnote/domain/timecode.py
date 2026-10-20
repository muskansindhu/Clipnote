"""Conversions between seconds and the clock strings shown by YouTube."""

from __future__ import annotations

SECONDS_PER_MINUTE = 60
SECONDS_PER_HOUR = 3600


def parse_clock(value: str) -> int:
    """Convert ``"1:23"``, ``"01:02:03"`` or ``"45"`` into whole seconds.

    Args:
        value: A clock string with one to three colon-separated parts.

    Returns:
        The number of seconds, rounded to the nearest whole second.

    Raises:
        ValueError: If ``value`` is not a valid clock string.
    """
    parts = value.strip().split(":")
    if not 1 <= len(parts) <= 3:
        raise ValueError(f"Invalid clock string: {value!r}")
    try:
        numbers = [float(part) for part in parts]
    except ValueError as exc:
        raise ValueError(f"Invalid clock string: {value!r}") from exc
    if any(number < 0 for number in numbers):
        raise ValueError(f"Invalid clock string: {value!r}")

    total = 0.0
    for number in numbers:
        total = total * SECONDS_PER_MINUTE + number
    return int(total + 0.5)


def format_clock(seconds: int) -> str:
    """Format whole seconds as ``m:ss`` or, from one hour up, ``h:mm:ss``."""
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, SECONDS_PER_HOUR)
    minutes, secs = divmod(remainder, SECONDS_PER_MINUTE)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"
