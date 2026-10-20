"""Business entities and rules. Depends on nothing outside the standard library."""

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
    "extract_start_seconds",
    "extract_video_id",
    "format_clock",
    "is_valid_video_id",
    "parse_clock",
    "snippet_around",
    "timestamp_url",
    "transcript_text",
    "watch_url",
]
