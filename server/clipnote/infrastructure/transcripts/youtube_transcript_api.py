"""Transcripts straight from YouTube via the ``youtube-transcript-api`` package."""

from __future__ import annotations

import logging
from xml.etree.ElementTree import ParseError

import requests
from youtube_transcript_api import (
    AgeRestricted,
    InvalidVideoId,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
    VideoUnplayable,
    YouTubeTranscriptApi,
    YouTubeTranscriptApiException,
)

from clipnote.domain import ExternalServiceError, TranscriptEntry

logger = logging.getLogger(__name__)
PREFERRED_LANGUAGES = ("en", "en-US", "en-GB")
# Errors that mean "this video has no transcript", as opposed to "we could not ask".
_NO_TRANSCRIPT = (
    AgeRestricted,
    InvalidVideoId,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
    VideoUnplayable,
)


class YouTubeTranscriptApiProvider:
    """Free, keyless transcript source. Used first in the provider chain."""

    name = "youtube_transcript_api"

    def __init__(self) -> None:
        self._api = YouTubeTranscriptApi()

    def fetch(self, video_id: str) -> list[TranscriptEntry]:
        try:
            try:
                fetched = self._api.fetch(video_id, languages=PREFERRED_LANGUAGES)
            except NoTranscriptFound:
                # Fall back to whatever language the video has.
                fetched = next(iter(self._api.list(video_id))).fetch()
        except _NO_TRANSCRIPT:
            logger.info("No transcript available for %s", video_id)
            return []
        except (
            YouTubeTranscriptApiException,
            StopIteration,
            ParseError,  # YouTube answered with an empty or non-XML body (blocked or throttled)
            requests.RequestException,
        ) as exc:
            raise ExternalServiceError(f"Could not fetch transcript for {video_id}") from exc
        return [
            {"text": item["text"], "start": item["start"], "dur": item["duration"]}
            for item in fetched.to_raw_data()
        ]
