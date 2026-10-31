"""Transcripts via an Apify actor. A paid fallback when YouTube blocks direct access."""

from __future__ import annotations

import logging
from typing import Any

from apify_client import ApifyClient

from clipnote.domain import ExternalServiceError, TranscriptEntry, watch_url

logger = logging.getLogger(__name__)
ACTOR_ID = "pintostudio/youtube-transcript-scraper"
RUN_TIMEOUT_SECONDS = 20


class ApifyTranscriptProvider:
    """Fetches a transcript by running an Apify actor."""

    name = "apify"

    def __init__(self, token: str) -> None:
        self._client = ApifyClient(token=token)

    def fetch(self, video_id: str) -> list[TranscriptEntry]:
        try:
            run = self._client.actor(ACTOR_ID).call(
                run_input={"videoUrl": watch_url(video_id)},
                logger=None,
                build="latest",
                timeout_secs=RUN_TIMEOUT_SECONDS,
                max_items=1,
            )
            if run is None:
                return []
            items: list[Any] = list(self._client.dataset(run["defaultDatasetId"]).iterate_items())
        except Exception as exc:  # the client raises several unrelated exception types
            raise ExternalServiceError(f"Apify failed for {video_id}") from exc
        if not items or not isinstance(items[0].get("data"), list):
            return []
        return [entry for entry in items[0]["data"] if isinstance(entry, dict)]
