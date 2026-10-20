"""Background work that fills in a note after it has been saved."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any, TypeVar

from clipnote.application import prompts
from clipnote.application.ports import LanguageModel, NoteRepository, TaskRunner, VideoRepository
from clipnote.application.services.transcripts import TranscriptService
from clipnote.constants import (
    AI_NOTE_SYSTEM_PROMPT,
    RECOVERY_BATCH_SIZE,
    VIDEO_SUMMARY_SYSTEM_PROMPT,
)
from clipnote.domain import (
    EnrichmentStatus,
    Note,
    NoteSource,
    snippet_around,
    transcript_text,
)

logger = logging.getLogger(__name__)
T = TypeVar("T")


class EnrichmentService:
    """Fetches transcripts, writes summaries and AI notes without blocking capture."""

    def __init__(
        self,
        *,
        videos: VideoRepository,
        notes: NoteRepository,
        transcripts: TranscriptService,
        llm: LanguageModel,
        runner: TaskRunner,
    ) -> None:
        self._videos = videos
        self._notes = notes
        self._transcripts = transcripts
        self._llm = llm
        self._runner = runner

    def schedule(self, note_id: int) -> None:
        """Queue ``note_id`` for enrichment on the background runner."""
        self._runner.submit(self.enrich_note, note_id)

    def recover_pending(self) -> int:
        """Re-queue notes left pending, e.g. by a restart. Returns how many were queued."""
        pending = self._notes.list_pending(RECOVERY_BATCH_SIZE)
        for note in pending:
            self.schedule(note.id)
        return len(pending)

    def enrich_note(self, note_id: int) -> None:
        """Complete one pending note. Safe to call twice; never raises."""
        note = self._notes.get_by_id(note_id)
        if note is None or note.status is not EnrichmentStatus.PENDING:
            return
        try:
            self._enrich(note)
        except Exception:
            logger.exception("Enrichment failed for note %s", note_id)
            self._notes.complete_enrichment(note_id, status=EnrichmentStatus.FAILED)

    def _enrich(self, note: Note) -> None:
        # Transcript and summary are best effort: a note that already has the user's own
        # text must never be marked failed because they are unavailable.
        entries = self._best_effort(self._transcripts.get_or_fetch, note.video_id)
        summary = self._best_effort(self._ensure_summary, note.video_id, entries)

        if note.text:
            self._notes.complete_enrichment(note.id, status=EnrichmentStatus.READY)
            return

        generated = self._generate_text(note, entries, summary)
        if generated:
            self._notes.complete_enrichment(
                note.id, status=EnrichmentStatus.READY, text=generated, source=NoteSource.AI
            )
        else:
            self._notes.complete_enrichment(note.id, status=EnrichmentStatus.FAILED)

    @staticmethod
    def _best_effort(step: Callable[..., T | None], *args: Any) -> T | None:
        try:
            return step(*args)
        except Exception:
            logger.warning("Enrichment step %s failed", step.__name__, exc_info=True)
            return None

    def _ensure_summary(self, video_id: str, entries: list[dict[str, object]] | None) -> str | None:
        video = self._videos.get(video_id)
        if video is not None and video.summary:
            return video.summary
        if not entries:
            return None
        text = transcript_text(entries)
        if not text:
            return None
        summary = self._llm.complete_text(
            system=VIDEO_SUMMARY_SYSTEM_PROMPT, user=prompts.transcript_user_prompt(text)
        )
        if summary:
            self._videos.set_summary_if_empty(video_id, summary)
        return summary or None

    def _generate_text(
        self, note: Note, entries: list[dict[str, object]] | None, summary: str | None
    ) -> str | None:
        if note.timestamp_seconds is not None and entries:
            context = snippet_around(entries, note.timestamp_seconds)
        else:
            context = summary or ""
        if not context.strip():
            return None
        text = self._llm.complete_text(
            system=AI_NOTE_SYSTEM_PROMPT, user=prompts.ai_note_user_prompt(context)
        )
        return text.strip() or None
