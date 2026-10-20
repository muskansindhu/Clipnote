"""Business entities and rules. Depends on nothing outside the standard library."""

from clipnote.domain.accounts import (
    MIN_PASSWORD_LENGTH,
    derive_username_from_email,
    normalise_email,
    normalise_username,
)
from clipnote.domain.entities import (
    ApiToken,
    EnrichmentStatus,
    Label,
    NewNote,
    Note,
    NoteSource,
    NoteType,
    User,
    Video,
    VideoListing,
)
from clipnote.domain.errors import (
    AuthenticationError,
    ConflictError,
    DomainError,
    ExternalServiceError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from clipnote.domain.timecode import format_clock, parse_clock
from clipnote.domain.transcript import TranscriptEntry, snippet_around, transcript_text
from clipnote.domain.youtube import (
    extract_start_seconds,
    extract_video_id,
    is_valid_video_id,
    timestamp_url,
    watch_url,
)

__all__ = [
    "MIN_PASSWORD_LENGTH",
    "ApiToken",
    "AuthenticationError",
    "ConflictError",
    "DomainError",
    "EnrichmentStatus",
    "ExternalServiceError",
    "Label",
    "NewNote",
    "Note",
    "NoteSource",
    "NoteType",
    "NotFoundError",
    "PermissionDeniedError",
    "TranscriptEntry",
    "User",
    "ValidationError",
    "Video",
    "VideoListing",
    "derive_username_from_email",
    "extract_start_seconds",
    "extract_video_id",
    "format_clock",
    "is_valid_video_id",
    "normalise_email",
    "normalise_username",
    "parse_clock",
    "snippet_around",
    "timestamp_url",
    "transcript_text",
    "watch_url",
]
