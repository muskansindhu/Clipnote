"""Creating, reading, editing and deleting notes, and the user's video library."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from clipnote.application.ports import (
    LibraryRepository,
    NoteRepository,
    VideoMetadataProvider,
    VideoRepository,
)
from clipnote.application.services.enrichment import EnrichmentService
from clipnote.constants import (
    DEFAULT_VIDEO_TITLE,
    DUPLICATE_WINDOW_SECONDS,
    ONE_DAY,
    PAGE_SIZE,
    SORT_RECENT,
    SORT_TITLE,
)
from clipnote.domain import (
    EnrichmentStatus,
    NewNote,
    Note,
    NoteSource,
    NoteType,
    NotFoundError,
    ValidationError,
    Video,
    VideoListing,
    is_valid_video_id,
    parse_clock,
    watch_url,
)


@dataclass(frozen=True, slots=True)
class VideoPage:
    """One page of a user's library."""

    videos: list[VideoListing]
    has_next: bool


@dataclass(frozen=True, slots=True)
class VideoNotes:
    """A video with the requesting user's notes on it."""

    video: Video
    notes: list[Note]
    fav: bool


@dataclass(frozen=True, slots=True)
class CreatedNote:
    """Result of saving a note."""

    note: Note
    video: Video
    duplicate: bool


class NoteService:
    """Use cases around a user's notes and library."""

    def __init__(
        self,
        *,
        notes: NoteRepository,
        videos: VideoRepository,
        library: LibraryRepository,
        metadata: VideoMetadataProvider,
        enrichment: EnrichmentService,
    ) -> None:
        self._notes = notes
        self._videos = videos
        self._library = library
        self._metadata = metadata
        self._enrichment = enrichment

    def create_note(
        self,
        user_id: str,
        *,
        video_id: str,
        title: str | None,
        text: str | None,
        seconds: int | None,
        note_type: NoteType = NoteType.NOTE,
    ) -> CreatedNote:
        """Save a note immediately and queue the slow work for later.

        The note is stored before any transcript or AI call, so saving stays fast. When
        the text is empty, or the video has no summary yet, the note is stored as pending
        and completed in the background.

        Raises:
            ValidationError: If the video id or timestamp is invalid.
        """
        if not is_valid_video_id(video_id):
            raise ValidationError("Invalid video id")
        if seconds is not None and seconds < 0:
            raise ValidationError("Timestamp must not be negative")
        clean_text = (text or "").strip() or None

        duplicate = self._notes.find_recent_duplicate(
            user_id=user_id,
            video_id=video_id,
            seconds=seconds,
            text=clean_text,
            within_seconds=DUPLICATE_WINDOW_SECONDS,
        )
        video = self._ensure_video(user_id, video_id, title)
        if duplicate is not None:
            return CreatedNote(duplicate, video, duplicate=True)

        needs_enrichment = clean_text is None or not video.summary
        note = self._notes.add(
            NewNote(
                user_id=user_id,
                video_id=video_id,
                text=clean_text,
                timestamp_seconds=seconds,
                source=NoteSource.USER if clean_text else NoteSource.AI,
                note_type=note_type,
                status=EnrichmentStatus.PENDING if needs_enrichment else EnrichmentStatus.READY,
            )
        )
        if needs_enrichment:
            self._enrichment.schedule(note.id)
        return CreatedNote(note, video, duplicate=False)

    def list_videos(
        self,
        user_id: str,
        *,
        page: int = 1,
        search: str = "",
        label_names: list[str] | None = None,
        sort: str = SORT_RECENT,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> VideoPage:
        """List one page of the user's videos, newest note first by default."""
        page = max(1, page)
        rows = self._library.list_videos(
            user_id=user_id,
            search=search.strip(),
            label_names=label_names or [],
            sort=SORT_TITLE if sort == SORT_TITLE else SORT_RECENT,
            start=start,
            end=end + ONE_DAY if end else None,
            limit=PAGE_SIZE + 1,
            offset=(page - 1) * PAGE_SIZE,
        )
        return VideoPage(videos=rows[:PAGE_SIZE], has_next=len(rows) > PAGE_SIZE)

    def video_notes(self, user_id: str, video_id: str) -> VideoNotes:
        """Return a video with the user's notes on it.

        Raises:
            NotFoundError: If the video is unknown.
        """
        video = self._videos.get(video_id)
        if video is None:
            raise NotFoundError("Video not found")
        return VideoNotes(
            video=video,
            notes=self._notes.list_for_video(user_id, video_id),
            fav=self._library.is_favourite(user_id, video_id),
        )

    def update_text(
        self,
        user_id: str,
        *,
        video_id: str,
        text: str,
        note_id: int | None = None,
        timestamp: str | None = None,
    ) -> None:
        """Edit a note, addressed by id or (for older clients) by video and clock time.

        Raises:
            ValidationError: If neither an id nor a valid timestamp is given.
            NotFoundError: If no note matches.
        """
        clean_text = text.strip()
        if note_id is not None:
            updated = self._notes.update_text(user_id, note_id, clean_text)
        else:
            updated = bool(
                self._notes.update_text_at(
                    user_id, video_id, _seconds_from_clock(timestamp), clean_text
                )
            )
        if not updated:
            raise NotFoundError("Note not found")

    def delete(
        self,
        user_id: str,
        *,
        video_id: str,
        note_id: int | None = None,
        timestamp: str | None = None,
    ) -> None:
        """Delete a note, addressed by id or (for older clients) by video and clock time.

        Raises:
            ValidationError: If neither an id nor a valid timestamp is given.
            NotFoundError: If no note matches.
        """
        if note_id is not None:
            deleted = self._notes.delete(user_id, note_id)
        else:
            deleted = bool(self._notes.delete_at(user_id, video_id, _seconds_from_clock(timestamp)))
        if not deleted:
            raise NotFoundError("Note not found")

    def set_favourite(
        self,
        user_id: str,
        *,
        fav: bool,
        video_id: str | None = None,
        video_title: str | None = None,
    ) -> None:
        """Mark a video as favourite for this user only.

        Older clients identify the video by title; it is resolved within the user's own
        library.

        Raises:
            NotFoundError: If the video cannot be found in the user's library.
        """
        if not video_id and video_title:
            video_id = self._library.find_video_id_by_title(user_id, video_title)
        if not video_id or self._videos.get(video_id) is None:
            raise NotFoundError("Video not found")
        self._library.set_favourite(user_id, video_id, fav)

    def _ensure_video(self, user_id: str, video_id: str, title: str | None) -> Video:
        existing = self._videos.get(video_id)
        if existing is not None:
            return existing
        resolved = (title or "").strip()
        if not resolved:
            found = self._metadata.fetch(video_id)
            resolved = found.title if found else DEFAULT_VIDEO_TITLE
        self._videos.add_if_missing(
            video_id=video_id, url=watch_url(video_id), title=resolved, owner_id=user_id
        )
        created = self._videos.get(video_id)
        return created or Video(video_id, watch_url(video_id), resolved, None)


def _seconds_from_clock(timestamp: str | None) -> int:
    if not timestamp:
        raise ValidationError("A note id or timestamp is required")
    try:
        return parse_clock(timestamp)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
