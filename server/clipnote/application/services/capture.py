"""Saving a note from a shared YouTube link (the iPhone share-sheet flow)."""

from __future__ import annotations

from dataclasses import dataclass

from clipnote.application.services.notes import NoteService
from clipnote.domain import (
    Note,
    NoteType,
    ValidationError,
    Video,
    extract_start_seconds,
    extract_video_id,
)


@dataclass(frozen=True, slots=True)
class CaptureResult:
    """Outcome of capturing a link."""

    note: Note
    video: Video
    duplicate: bool


class CaptureService:
    """Turns a shared URL plus optional text into a note."""

    def __init__(self, notes: NoteService) -> None:
        self._notes = notes

    def capture(
        self,
        user_id: str,
        *,
        url: str,
        text: str | None = None,
        note_type: str | None = None,
    ) -> CaptureResult:
        """Save a note for the video and moment in ``url``.

        The time comes from the link (``t=``, ``start=`` and so on). A link without a
        time becomes a video-level note rather than a guessed timestamp. An empty ``text``
        asks the AI to write the note in the background.

        Raises:
            ValidationError: If the URL is not a YouTube video link or the type is unknown.
        """
        video_id = extract_video_id(url)
        if video_id is None:
            raise ValidationError("That does not look like a YouTube video link")
        created = self._notes.create_note(
            user_id,
            video_id=video_id,
            title=None,
            text=text,
            seconds=extract_start_seconds(url),
            note_type=_parse_note_type(note_type),
        )
        return CaptureResult(created.note, created.video, created.duplicate)


def _parse_note_type(raw: str | None) -> NoteType:
    if not raw:
        return NoteType.NOTE
    try:
        return NoteType(raw.strip().lower())
    except ValueError as exc:
        allowed = ", ".join(note_type.value for note_type in NoteType)
        raise ValidationError(f"Unknown note type; use one of: {allowed}") from exc
