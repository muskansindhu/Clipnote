"""Parsing of YouTube URLs into video ids and start times."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from clipnote.constants import (
    START_TIME_PARAMS,
    START_TIME_PATTERN,
    VIDEO_ID_PATTERN,
    YOUTUBE_HOSTS,
    YOUTUBE_ID_PATH_PREFIXES,
    YOUTUBE_SHORT_HOSTS,
)


def is_valid_video_id(value: str) -> bool:
    """Return whether ``value`` has the shape of a YouTube video id."""
    return bool(VIDEO_ID_PATTERN.match(value))


def _parse(url: str) -> tuple[str, str, str, str]:
    """Split a URL, tolerating a missing scheme, into (host, path, query, fragment)."""
    text = url.strip()
    if "://" not in text:
        text = f"https://{text}"
    parsed = urlparse(text)
    return (parsed.hostname or "").lower(), parsed.path, parsed.query, parsed.fragment


def extract_video_id(url: str) -> str | None:
    """Extract the video id from any common YouTube URL form.

    Handles ``watch?v=``, ``youtu.be/``, ``/shorts/``, ``/embed/``, ``/live/`` and the
    mobile and music hosts. Anything that is not an 11-character id is rejected so the
    id is safe to use as a storage key.

    Args:
        url: A URL as pasted or shared by a user.

    Returns:
        The video id, or ``None`` if the URL is not a recognised YouTube video URL.
    """
    host, path, query, _ = _parse(url)
    segments = [segment for segment in path.split("/") if segment]
    candidate: str | None = None

    if host in YOUTUBE_SHORT_HOSTS:
        candidate = segments[0] if segments else None
    elif host in YOUTUBE_HOSTS:
        if segments[:1] == ["watch"]:
            candidate = parse_qs(query).get("v", [None])[0]
        elif len(segments) > 1 and segments[0] in YOUTUBE_ID_PATH_PREFIXES:
            candidate = segments[1]

    if candidate and is_valid_video_id(candidate):
        return candidate
    return None


def _parse_start_value(raw: str) -> int | None:
    """Parse ``"754"``, ``"754s"`` or ``"1h2m3s"`` into seconds."""
    value = raw.strip().lower()
    match = START_TIME_PATTERN.match(value)
    if not value or match is None:
        return None
    hours, minutes, seconds = (int(group) if group else 0 for group in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def extract_start_seconds(url: str) -> int | None:
    """Read the start time from ``t=``, ``start=``, ``time_continue=`` or ``#t=``.

    Args:
        url: A YouTube URL, typically from the share sheet with "start at" enabled.

    Returns:
        The start offset in seconds, or ``None`` if the URL carries no valid time.
    """
    _, _, query, fragment = _parse(url)
    sources = (parse_qs(query), parse_qs(fragment))
    for params in sources:
        for name in START_TIME_PARAMS:
            for raw in params.get(name, []):
                seconds = _parse_start_value(raw)
                if seconds is not None:
                    return seconds
    return None


def watch_url(video_id: str) -> str:
    """Return the canonical watch URL for a video."""
    return f"https://www.youtube.com/watch?v={video_id}"


def timestamp_url(video_id: str, seconds: int | None) -> str:
    """Return a short link that opens the video at ``seconds`` (or the start)."""
    base = f"https://youtu.be/{video_id}"
    return base if not seconds else f"{base}?t={seconds}"
