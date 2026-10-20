"""Turns domain objects into the JSON the web app and extension already expect."""

from __future__ import annotations

from typing import Any

from clipnote.application import ClipchatContext, VideoDetail, VideoNotes
from clipnote.domain import ApiToken, Label, LibraryStats, Note, VideoListing


def note_json(note: Note) -> dict[str, Any]:
    """A note, with the legacy ``video_timestamp`` string plus the numeric seconds."""
    return {
        "id": note.id,
        "created_at": note.created_at,
        "video_timestamp": note.display_time,
        "timestamp_seconds": note.timestamp_seconds,
        "note": note.text,
        "note_source": note.source.value,
        "note_type": note.note_type.value,
        "status": note.status.value,
    }


def video_notes_json(result: VideoNotes) -> list[dict[str, Any]]:
    """One entry per note, each repeating the video fields, as the note page expects."""
    video = result.video
    return [
        {
            **note_json(note),
            "video_id": video.id,
            "video_url": video.url,
            "video_title": video.title,
            "video_summary": video.summary,
            "fav": result.fav,
        }
        for note in result.notes
    ]


def listing_json(video: VideoListing) -> dict[str, Any]:
    """A video in the dashboard list."""
    return {
        "id": video.id,
        "video_url": video.url,
        "video_title": video.title,
        "fav": video.fav,
        "note_count": video.note_count,
        "last_note_at": video.last_note_at,
    }


def stats_json(stats: LibraryStats) -> dict[str, Any]:
    """Headline library numbers."""
    return {
        "videos": stats.videos,
        "notes": stats.notes,
        "notes_this_week": stats.notes_this_week,
        "favourites": stats.favourites,
        "pending": stats.pending,
    }


def video_detail_json(detail: VideoDetail, label: str | None) -> dict[str, Any]:
    """A video with the user's notes, for the video page."""
    video = detail.video
    return {
        "video": {
            "id": video.id,
            "url": video.url,
            "title": video.title,
            "summary": video.summary,
        },
        "notes": [note_json(note) for note in detail.notes],
        "fav": detail.fav,
        "label": label,
    }


def label_json(label: Label) -> dict[str, Any]:
    """A label."""
    return {"id": label.id, "label_name": label.name}


def token_json(token: ApiToken) -> dict[str, Any]:
    """Token metadata. The secret is never part of this."""
    return {
        "id": token.id,
        "label": token.label,
        "prefix": token.prefix,
        "scope": token.scope,
        "created_at": token.created_at,
        "last_used_at": token.last_used_at,
        "revoked_at": token.revoked_at,
    }


def clipchat_json(context: ClipchatContext) -> dict[str, Any]:
    """The Clipchat page context."""
    return {
        "video_id": context.video_id,
        "video_url": context.url,
        "video_title": context.title,
        "fav": context.fav,
        "video_summary": context.summary,
        "notes": [
            {
                "id": note.id,
                "video_timestamp": note.display_time,
                "timestamp_seconds": note.timestamp_seconds,
                "note": note.text,
                "note_source": note.source.value,
            }
            for note in context.notes
        ],
        "asset_status": context.asset_status,
    }
