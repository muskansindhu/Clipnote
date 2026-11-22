"""Creating, reading, editing and deleting notes, and the user's video library."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from clipnote.application.ports import (
    AiBudget,
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
    LibraryStats,
    NewNote,
    Note,
    NoteSource,
    NoteType,
    NotFoundError,
    ValidationError,
    Video,
    VideoListing,
    is_valid_video_id,
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


@dataclass(frozen=True, slots=True)
class VideoDetail:
    """Everything the video page needs, whether or not the user has notes yet."""

    video: Video
    notes: list[Note]


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
        budget: AiBudget,
    ) -> None:
        self._budget = budget
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
        and completed in the background. An empty note uses one of the user's daily AI calls;
        when none are left the note is kept with the "failed" status so the user can write it.

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
        out_of_ai = clean_text is None and not self._budget.try_consume(user_id)
        if out_of_ai:
            # Keep the moment; the user can write the text themselves.
            needs_enrichment = False
        note = self._notes.add(
            NewNote(
                user_id=user_id,
                video_id=video_id,
                text=clean_text,
                timestamp_seconds=seconds,
                source=NoteSource.USER if clean_text else NoteSource.AI,
                note_type=note_type,
                status=(
                    EnrichmentStatus.FAILED
                    if out_of_ai
                    else EnrichmentStatus.PENDING
                    if needs_enrichment
                    else EnrichmentStatus.READY
                ),
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
        )

    def video_detail(self, user_id: str, video_id: str) -> VideoDetail:
        """Return a video with the user's notes, even for a video not yet saved.

        An unknown (but well-formed) id yields a placeholder from public metadata, so the
        user can start taking notes on any YouTube video. Nothing is stored until a note is.

        Raises:
            NotFoundError: If ``video_id`` is not a valid YouTube video id.
        """
        if not is_valid_video_id(video_id):
            raise NotFoundError("Video not found")
        video = self._videos.get(video_id)
        if video is None:
            found = self._metadata.fetch(video_id)
            video = Video(
                video_id, watch_url(video_id), found.title if found else DEFAULT_VIDEO_TITLE, None
            )
        return VideoDetail(
            video=video,
            notes=self._notes.list_for_video(user_id, video_id),
        )

    def library_stats(self, user_id: str) -> LibraryStats:
        """Headline numbers for the user's library."""
        return self._library.stats(user_id)

    def remove_video(self, user_id: str, video_id: str) -> None:
        """Remove a video from the user's library by deleting their notes on it.

        The shared video record is kept, since other users may have notes on it.

        Raises:
            NotFoundError: If the user has no notes on the video.
        """
        if not self._notes.delete_for_video(user_id, video_id):
            raise NotFoundError("Video not found in your library")

    def update_text(
        self,
        user_id: str,
        *,
        video_id: str,
        text: str,
        note_id: int,
    ) -> None:
        """Edit one of the user's notes.

        Raises:
            NotFoundError: If the user has no note with this id.
        """
        if not self._notes.update_text(user_id, note_id, text.strip()):
            raise NotFoundError("Note not found")

    def delete(
        self,
        user_id: str,
        *,
        video_id: str,
        note_id: int,
    ) -> None:
        """Delete one of the user's notes.

        Raises:
            NotFoundError: If the user has no note with this id.
        """
        if not self._notes.delete(user_id, note_id):
            raise NotFoundError("Note not found")

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
