"""Transcript sources."""

from clipnote.infrastructure.transcripts.apify import ApifyTranscriptProvider
from clipnote.infrastructure.transcripts.youtube_transcript_api import (
    YouTubeTranscriptApiProvider,
)

__all__ = ["ApifyTranscriptProvider", "YouTubeTranscriptApiProvider"]
