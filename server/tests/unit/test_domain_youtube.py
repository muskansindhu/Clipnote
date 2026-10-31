import pytest

from clipnote.domain import (
    extract_start_seconds,
    extract_video_id,
    timestamp_url,
    watch_url,
)

VID = "dQw4w9WgXcQ"


@pytest.mark.parametrize(
    "url",
    [
        f"https://www.youtube.com/watch?v={VID}",
        f"https://youtube.com/watch?v={VID}&t=30s",
        f"https://m.youtube.com/watch?v={VID}",
        f"https://music.youtube.com/watch?v={VID}",
        f"https://youtu.be/{VID}?si=abc&t=754",
        f"youtu.be/{VID}",
        f"https://www.youtube.com/shorts/{VID}",
        f"https://www.youtube.com/embed/{VID}",
        f"https://www.youtube.com/live/{VID}?feature=share",
        f"  https://www.youtube.com/watch?v={VID}  ",
    ],
)
def test_extract_video_id_accepts_common_url_forms(url: str) -> None:
    assert extract_video_id(url) == VID


@pytest.mark.parametrize(
    "url",
    [
        "",
        "not a url",
        "https://example.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch",
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/watch?v=../../etc/passwd",
        "https://youtu.be/",
        "https://www.youtube.com/playlist?list=PL123",
    ],
)
def test_extract_video_id_rejects_unrecognised_urls(url: str) -> None:
    assert extract_video_id(url) is None


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (f"https://youtu.be/{VID}?t=754", 754),
        (f"https://youtu.be/{VID}?si=x&t=754s", 754),
        (f"https://www.youtube.com/watch?v={VID}&t=1h2m3s", 3723),
        (f"https://www.youtube.com/watch?v={VID}&t=2m", 120),
        (f"https://www.youtube.com/watch?v={VID}&start=90", 90),
        (f"https://www.youtube.com/watch?v={VID}&time_continue=15", 15),
        (f"https://www.youtube.com/watch?v={VID}#t=1m5s", 65),
        (f"https://youtu.be/{VID}?t=0", 0),
        (f"https://youtu.be/{VID}", None),
        (f"https://youtu.be/{VID}?t=", None),
        (f"https://youtu.be/{VID}?t=abc", None),
        (f"https://youtu.be/{VID}?t=-5", None),
    ],
)
def test_extract_start_seconds(url: str, expected: int | None) -> None:
    assert extract_start_seconds(url) == expected


def test_watch_url_is_canonical() -> None:
    assert watch_url(VID) == f"https://www.youtube.com/watch?v={VID}"


def test_timestamp_url_adds_offset_only_when_positive() -> None:
    assert timestamp_url(VID, 754) == f"https://youtu.be/{VID}?t=754"
    assert timestamp_url(VID, 0) == f"https://youtu.be/{VID}"
    assert timestamp_url(VID, None) == f"https://youtu.be/{VID}"
