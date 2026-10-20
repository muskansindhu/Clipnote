"""Fetching and caching video transcripts."""

from __future__ import annotations

import logging
from collections.abc import Sequence

from clipnote.application.ports import TranscriptProvider, TranscriptStore
from clipnote.domain import ExternalServiceError, TranscriptEntry

logger = logging.getLogger(__name__)


class TranscriptService:
    """Returns a transcript from the cache or, failing that, from the provider chain."""

    def __init__(self, store: TranscriptStore, providers: Sequence[TranscriptProvider]) -> None:
        self._store = store
        self._providers = tuple(providers)

    def cached(self, video_id: str) -> list[TranscriptEntry] | None:
        """Return the cached transcript without fetching anything."""
        entries = self._store.get(video_id)
        return entries or None

    def get_or_fetch(self, video_id: str) -> list[TranscriptEntry] | None:
        """Return the transcript, trying each provider in order and caching the result.

        Returns:
            The transcript entries, or ``None`` when no source has one.
        """
        cached = self.cached(video_id)
        if cached:
            return cached
        for provider in self._providers:
            try:
                entries = provider.fetch(video_id)
            except ExternalServiceError:
                logger.warning(
                    "Transcript provider %s failed for %s", provider.name, video_id, exc_info=True
                )
                continue
            if entries:
                if not self._store.put(video_id, entries):
                    logger.warning("Could not cache transcript for %s", video_id)
                return entries
        return None
