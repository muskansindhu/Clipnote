from unittest.mock import MagicMock
from xml.etree.ElementTree import ParseError

import pytest
import requests
from youtube_transcript_api import IpBlocked, NoTranscriptFound, TranscriptsDisabled

from clipnote.domain import ExternalServiceError
from clipnote.infrastructure.transcripts import YouTubeTranscriptApiProvider

VID = "dQw4w9WgXcQ"


def _provider(api: MagicMock) -> YouTubeTranscriptApiProvider:
    provider = YouTubeTranscriptApiProvider()
    provider._api = api
    return provider


def _fetched(raw: list[dict[str, float | str]]) -> MagicMock:
    fetched = MagicMock()
    fetched.to_raw_data.return_value = raw
    return fetched


def test_maps_library_output_to_the_stored_transcript_shape() -> None:
    api = MagicMock()
    api.fetch.return_value = _fetched([{"text": "hi", "start": 1.5, "duration": 2.0}])

    assert _provider(api).fetch(VID) == [{"text": "hi", "start": 1.5, "dur": 2.0}]


def test_falls_back_to_any_available_language() -> None:
    api = MagicMock()
    api.fetch.side_effect = NoTranscriptFound(VID, ["en"], MagicMock())
    other = MagicMock()
    other.fetch.return_value = _fetched([{"text": "hola", "start": 0.0, "duration": 1.0}])
    api.list.return_value = [other]

    assert _provider(api).fetch(VID) == [{"text": "hola", "start": 0.0, "dur": 1.0}]


def test_returns_empty_when_the_video_has_no_transcript() -> None:
    api = MagicMock()
    api.fetch.side_effect = TranscriptsDisabled(VID)

    assert _provider(api).fetch(VID) == []


@pytest.mark.parametrize(
    "failure",
    [IpBlocked(VID), ParseError("no element found"), requests.ConnectionError("offline")],
)
def test_raises_a_service_error_when_youtube_blocks_or_breaks(failure: Exception) -> None:
    api = MagicMock()
    api.fetch.side_effect = failure

    with pytest.raises(ExternalServiceError):
        _provider(api).fetch(VID)
