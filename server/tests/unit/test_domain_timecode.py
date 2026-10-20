from datetime import UTC, datetime

import pytest

from clipnote.domain import Note, format_clock, parse_clock
from clipnote.domain.entities import EnrichmentStatus, NoteSource, NoteType


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("45", 45), ("1:23", 83), ("01:23", 83), ("1:02:03", 3723), ("0:00", 0), ("1:23.6", 84)],
)
def test_parse_clock(raw: str, expected: int) -> None:
    assert parse_clock(raw) == expected


@pytest.mark.parametrize("raw", ["", "--:--", "1:2:3:4", "a:b", "-1:00"])
def test_parse_clock_rejects_invalid_input(raw: str) -> None:
    with pytest.raises(ValueError, match="Invalid clock string"):
        parse_clock(raw)


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [(0, "0:00"), (5, "0:05"), (83, "1:23"), (3599, "59:59"), (3600, "1:00:00"), (3723, "1:02:03")],
)
def test_format_clock(seconds: int, expected: str) -> None:
    assert format_clock(seconds) == expected


def test_format_and_parse_round_trip() -> None:
    assert all(parse_clock(format_clock(s)) == s for s in range(0, 8000, 37))


def _note(seconds: int | None) -> Note:
    now = datetime.now(UTC)
    return Note(
        id=1,
        user_id="u",
        video_id="v",
        text="t",
        timestamp_seconds=seconds,
        source=NoteSource.USER,
        note_type=NoteType.NOTE,
        status=EnrichmentStatus.READY,
        created_at=now,
        updated_at=now,
    )


def test_note_display_time_formats_seconds() -> None:
    assert _note(83).display_time == "1:23"


def test_note_display_time_is_none_for_video_level_notes() -> None:
    assert _note(None).display_time is None
