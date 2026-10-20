"""Interfaces the use cases depend on. Infrastructure provides the implementations."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from clipnote.domain import (
    ApiToken,
    EnrichmentStatus,
    Label,
    NewNote,
    Note,
    NoteSource,
    TranscriptEntry,
    User,
    Video,
    VideoListing,
)


@dataclass(frozen=True, slots=True)
class VideoMetadata:
    """Public metadata fetched for a video."""

    title: str
    author: str | None = None


@dataclass(frozen=True, slots=True)
class AccessClaims:
    """The identity carried by a verified access token."""

    user_id: str
    username: str | None
    email: str | None


class UserRepository(Protocol):
    """Storage of user accounts."""

    def get_by_id(self, user_id: str) -> User | None: ...

    def get_by_email(self, email: str) -> User | None: ...

    def get_by_google_sub(self, google_sub: str) -> User | None: ...

    def username_exists(self, username: str, *, exclude_user_id: str | None = None) -> bool: ...

    def add(
        self, *, username: str, email: str, password_hash: str | None, google_sub: str | None
    ) -> User: ...

    def set_credentials(
        self, user_id: str, *, username: str, email: str, password_hash: str
    ) -> None: ...

    def set_google_sub(self, user_id: str, google_sub: str) -> None: ...

    def set_password_hash(self, user_id: str, password_hash: str) -> None: ...


class VideoRepository(Protocol):
    """Storage of videos, shared by every user."""

    def get(self, video_id: str) -> Video | None: ...

    def get_many(self, video_ids: Sequence[str]) -> dict[str, Video]: ...

    def add_if_missing(self, *, video_id: str, url: str, title: str, owner_id: str) -> None: ...

    def set_title(self, video_id: str, title: str) -> None: ...

    def set_summary_if_empty(self, video_id: str, summary: str) -> None: ...


class NoteRepository(Protocol):
    """Storage of notes. Every query is scoped to one user unless stated."""

    def add(self, note: NewNote) -> Note: ...

    def get_by_id(self, note_id: int) -> Note | None:
        """Fetch a note regardless of owner. For background workers only."""
        ...

    def list_for_video(self, user_id: str, video_id: str) -> list[Note]: ...

    def list_for_user(self, user_id: str, *, since: datetime | None = None) -> list[Note]: ...

    def update_text(self, user_id: str, note_id: int, text: str) -> bool: ...

    def update_text_at(self, user_id: str, video_id: str, seconds: int, text: str) -> int: ...

    def delete(self, user_id: str, note_id: int) -> bool: ...

    def delete_at(self, user_id: str, video_id: str, seconds: int) -> int: ...

    def find_recent_duplicate(
        self,
        *,
        user_id: str,
        video_id: str,
        seconds: int | None,
        text: str | None,
        within_seconds: int,
    ) -> Note | None: ...

    def complete_enrichment(
        self,
        note_id: int,
        *,
        status: EnrichmentStatus,
        text: str | None = None,
        source: NoteSource | None = None,
    ) -> None: ...

    def list_pending(self, limit: int) -> list[Note]: ...


class LibraryRepository(Protocol):
    """A user's view of videos: listing, search, filtering and favourites."""

    def list_videos(
        self,
        *,
        user_id: str,
        search: str,
        label_names: Sequence[str],
        sort: str,
        start: datetime | None,
        end: datetime | None,
        limit: int,
        offset: int,
    ) -> list[VideoListing]: ...

    def list_by_label(self, user_id: str, label_name: str) -> list[VideoListing] | None: ...

    def set_favourite(self, user_id: str, video_id: str, fav: bool) -> None: ...

    def is_favourite(self, user_id: str, video_id: str) -> bool: ...

    def find_video_id_by_title(self, user_id: str, title: str) -> str | None: ...


class LabelRepository(Protocol):
    """Storage of labels and their assignment to videos. Always scoped to one user."""

    def list_for_user(self, user_id: str) -> list[Label]: ...

    def get_by_name(self, user_id: str, name: str) -> Label | None: ...

    def add(self, user_id: str, name: str) -> Label: ...

    def rename(self, user_id: str, label_id: int, name: str) -> bool: ...

    def delete(self, user_id: str, label_id: int) -> bool: ...

    def assign(self, user_id: str, label_id: int, video_id: str) -> None: ...

    def unassign_all(self, user_id: str, video_id: str) -> None: ...

    def name_for_video(self, user_id: str, video_id: str) -> str | None: ...


class ApiTokenRepository(Protocol):
    """Storage of personal API token metadata (hashes only)."""

    def add(
        self, *, user_id: str, label: str, scope: str, token_hash: str, prefix: str
    ) -> ApiToken: ...

    def get_by_hash(self, token_hash: str) -> ApiToken | None: ...

    def list_for_user(self, user_id: str) -> list[ApiToken]: ...

    def revoke(self, user_id: str, token_id: int) -> bool: ...

    def touch(self, token_id: int) -> None: ...


class TranscriptStore(Protocol):
    """Cache of fetched transcripts, keyed by video id."""

    def get(self, video_id: str) -> list[TranscriptEntry] | None: ...

    def put(self, video_id: str, entries: Sequence[TranscriptEntry]) -> bool: ...


class TranscriptProvider(Protocol):
    """A source of timestamped transcripts."""

    name: str

    def fetch(self, video_id: str) -> list[TranscriptEntry]:
        """Return the transcript, or an empty list if this source has none."""
        ...


class LanguageModel(Protocol):
    """The text-generation model used for notes, summaries and Clipchat."""

    def complete_text(self, *, system: str, user: str) -> str: ...

    def complete_structured(
        self, *, system: str, user: str, schema_name: str, schema: Mapping[str, Any]
    ) -> str:
        """Return the raw JSON text of a response constrained by ``schema``."""
        ...


class VideoMetadataProvider(Protocol):
    """Looks up public video metadata such as the title."""

    def fetch(self, video_id: str) -> VideoMetadata | None: ...


class PasswordHasher(Protocol):
    """One-way password hashing."""

    def hash(self, password: str) -> str: ...

    def verify(self, password_hash: str, password: str) -> bool: ...


class AccessTokenCodec(Protocol):
    """Issues and verifies signed access tokens."""

    def issue(self, user: User, *, picture: str | None = None) -> str: ...

    def decode(self, token: str) -> AccessClaims:
        """Verify ``token``.

        Raises:
            AuthenticationError: If the token is invalid or expired.
        """
        ...


class TaskRunner(Protocol):
    """Runs work in the background."""

    def submit(self, task: Callable[..., None], *args: Any) -> None: ...
