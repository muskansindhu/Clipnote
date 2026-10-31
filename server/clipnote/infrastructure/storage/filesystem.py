"""Transcript cache on the local disk, for development without AWS."""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from pathlib import Path

from clipnote.domain import TranscriptEntry, is_valid_video_id

logger = logging.getLogger(__name__)


class FilesystemTranscriptStore:
    """Stores each transcript as ``<directory>/<video_id>.json``."""

    def __init__(self, directory: Path) -> None:
        self._directory = directory

    def _path(self, video_id: str) -> Path | None:
        if not is_valid_video_id(video_id):
            logger.warning("Refusing to use %r as a file name", video_id)
            return None
        return self._directory / f"{video_id}.json"

    def get(self, video_id: str) -> list[TranscriptEntry] | None:
        path = self._path(video_id)
        if path is None or not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.warning("Could not read cached transcript %s", path, exc_info=True)
            return None
        return data if isinstance(data, list) else None

    def put(self, video_id: str, entries: Sequence[TranscriptEntry]) -> bool:
        path = self._path(video_id)
        if path is None:
            return False
        try:
            self._directory.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(list(entries)), encoding="utf-8")
        except OSError:
            logger.exception("Could not store transcript for %s", video_id)
            return False
        return True
