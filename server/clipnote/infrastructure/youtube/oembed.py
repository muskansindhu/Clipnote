"""Video titles from YouTube's public oEmbed endpoint (no API key needed)."""

from __future__ import annotations

import logging

import requests

from clipnote.application import VideoMetadata
from clipnote.constants import (
    OEMBED_TIMEOUT_SECONDS,
    OEMBED_URL,
)
from clipnote.domain import is_valid_video_id, watch_url

logger = logging.getLogger(__name__)


class OEmbedMetadataProvider:
    """Looks up a video's title and channel name."""

    def fetch(self, video_id: str) -> VideoMetadata | None:
        if not is_valid_video_id(video_id):
            return None
        try:
            response = requests.get(
                OEMBED_URL,
                params={"url": watch_url(video_id), "format": "json"},
                timeout=OEMBED_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError):
            logger.warning("Could not fetch metadata for %s", video_id, exc_info=True)
            return None
        title = str(payload.get("title", "")).strip()
        if not title:
            return None
        author = str(payload.get("author_name", "")).strip() or None
        return VideoMetadata(title=title, author=author)
