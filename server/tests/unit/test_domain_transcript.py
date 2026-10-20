from clipnote.domain import snippet_around, transcript_text


def test_snippet_around_uses_window_bounds() -> None:
    transcript = [
        {"start": 10.0, "text": "hello"},
        {"start": 15.0, "text": "world"},
        {"start": 25.0, "text": "foo"},
    ]

    assert snippet_around(transcript, 15.0, window=15) == "hello world foo"
    assert snippet_around(transcript, 15.0, window=5) == "hello world"


def test_snippet_around_accepts_string_starts_and_skips_bad_entries() -> None:
    transcript = [
        {"start": "10.5", "text": "ok"},
        {"start": "n/a", "text": "skipped"},
        {"text": "no start"},
        {"start": 11, "note": "no text"},
    ]

    assert snippet_around(transcript, 10, window=5) == "ok"


def test_transcript_text_joins_non_empty_entries() -> None:
    entries = [{"text": " a "}, {"text": ""}, {"text": "b"}, {"start": 1}]

    assert transcript_text(entries) == "a b"
