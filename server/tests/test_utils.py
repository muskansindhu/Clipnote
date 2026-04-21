import pytest
from utils import extract_video_id, hms_to_seconds, extract_transcript_snippet

@pytest.mark.parametrize("url,expected", [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/watch?v=12345", "12345"),
    ("https://youtube.com/watch?v=someIntId12", "someIntId12")
])
def test_extract_video_id(url, expected):
    assert extract_video_id(url) == expected

@pytest.mark.parametrize("hms,expected", [
    ("1:00:00", 3600),
    ("01:30", 90),
    ("45", 45),
    ("12:34:56", 45296)
])
def test_hms_to_seconds(hms, expected):
    assert hms_to_seconds(hms) == expected

def test_extract_transcript_snippet():
    transcript = [
        {"start": 10.0, "text": "hello"},
        {"start": 15.0, "text": "world"},
        {"start": 25.0, "text": "foo"}
    ]
    # window is default 15. So 15-15=0, 15+15=30.
    snippet = extract_transcript_snippet(transcript, 15.0, window=15)
    assert snippet == "hello world foo"

    # strictly bounded
    snippet = extract_transcript_snippet(transcript, 15.0, window=5)
    assert snippet == "hello world"
