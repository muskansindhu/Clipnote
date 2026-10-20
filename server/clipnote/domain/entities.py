"""Core business entities. Plain dataclasses with no framework dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from clipnote.domain.timecode import format_clock


class NoteSource(StrEnum):
    """Who wrote the note text."""

    USER = "user"
    AI = "ai"


class NoteType(StrEnum):
    """What a note is for. Shown as a badge and usable as a review filter."""

    NOTE = "note"
    IDEA = "idea"
    QUESTION = "question"
    KEY_POINT = "key_point"
    TODO = "todo"


class EnrichmentStatus(StrEnum):
    """Progress of the asynchronous transcript and AI work for a note."""

    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class User:
    """A registered account."""

    id: str
    username: str
    email: str
    password_hash: str | None
    google_sub: str | None

    @property
    def has_password(self) -> bool:
        """Whether the account can sign in with a password."""
        return bool(self.password_hash)


@dataclass(frozen=True, slots=True)
class Video:
    """A YouTube video known to Clipnote, shared across users."""

    id: str
    url: str
    title: str
    summary: str | None


@dataclass(frozen=True, slots=True)
class VideoListing:
    """A video as it appears in one user's library."""

    id: str
    url: str
    title: str
    fav: bool
    note_count: int = 0
    last_note_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class LibraryStats:
    """Headline numbers for one user's library."""

    videos: int
    notes: int
    notes_this_week: int
    favourites: int
    pending: int


@dataclass(frozen=True, slots=True)
class NewNote:
    """A note that has not been stored yet."""

    user_id: str
    video_id: str
    text: str | None
    timestamp_seconds: int | None
    source: NoteSource
    note_type: NoteType
    status: EnrichmentStatus


@dataclass(frozen=True, slots=True)
class Note:
    """A stored note. ``timestamp_seconds`` is ``None`` for video-level notes."""

    id: int
    user_id: str
    video_id: str
    text: str | None
    timestamp_seconds: int | None
    source: NoteSource
    note_type: NoteType
    status: EnrichmentStatus
    created_at: datetime
    updated_at: datetime

    @property
    def display_time(self) -> str | None:
        """The timestamp as ``m:ss`` or ``h:mm:ss``, or ``None`` if there is none."""
        if self.timestamp_seconds is None:
            return None
        return format_clock(self.timestamp_seconds)


@dataclass(frozen=True, slots=True)
class Label:
    """A user-defined tag for grouping videos."""

    id: int
    user_id: str
    name: str


@dataclass(frozen=True, slots=True)
class ApiToken:
    """Metadata of a personal API token. The secret itself is never stored."""

    id: int
    user_id: str
    label: str
    scope: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None

    @property
    def is_active(self) -> bool:
        """Whether the token can still authenticate requests."""
        return self.revoked_at is None
