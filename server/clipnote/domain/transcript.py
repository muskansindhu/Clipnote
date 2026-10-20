"""Helpers for working with timestamped transcripts."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

TranscriptEntry = dict[str, Any]
DEFAULT_SNIPPET_WINDOW_SECONDS = 15


def transcript_text(entries: Sequence[TranscriptEntry]) -> str:
    """Join the text of every entry into one string."""
    return " ".join(
        str(entry.get("text", "")).strip()
        for entry in entries
        if isinstance(entry, dict) and str(entry.get("text", "")).strip()
    )


def snippet_around(
    entries: Sequence[TranscriptEntry],
    center_seconds: float,
    window: int = DEFAULT_SNIPPET_WINDOW_SECONDS,
) -> str:
    """Return the transcript text within ``window`` seconds either side of a moment."""
    start, end = center_seconds - window, center_seconds + window
    parts: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict) or "text" not in entry:
            continue
        try:
            entry_start = float(entry["start"])
        except (KeyError, TypeError, ValueError):
            continue
        if start <= entry_start <= end:
            parts.append(str(entry["text"]))
    return " ".join(parts)
