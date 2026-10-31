"""Notes, the video library and summaries."""

from __future__ import annotations

from datetime import UTC, datetime

from flask import Blueprint, Response, jsonify, request

from clipnote.domain import NoteType, ValidationError, extract_video_id, parse_clock
from clipnote.interfaces.http.auth import container, current_user_id, login_required
from clipnote.interfaces.http.schemas import (
    AddNoteBody,
    DeleteNoteBody,
    FavouriteBody,
    SummarizeBody,
    UpdateNoteBody,
    parse_body,
)
from clipnote.interfaces.http.serializers import listing_json, video_notes_json

blueprint = Blueprint("notes", __name__)


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw).replace(tzinfo=UTC)
    except ValueError:
        return None


@blueprint.get("/all-video")
@login_required
def all_videos() -> Response:
    labels = [name.strip() for name in request.args.get("labels", "").split(",") if name.strip()]
    page = container().notes.list_videos(
        current_user_id(),
        page=request.args.get("page", 1, type=int) or 1,
        search=request.args.get("search", ""),
        label_names=labels,
        sort=request.args.get("sort", "recent"),
        start=_parse_date(request.args.get("start")),
        end=_parse_date(request.args.get("end")),
    )
    return jsonify({"videos": [listing_json(v) for v in page.videos], "has_next": page.has_next})


@blueprint.get("/note/<video_id>")
@login_required
def video_notes(video_id: str) -> tuple[Response, int]:
    result = container().notes.video_notes(current_user_id(), video_id)
    return jsonify(video_notes_json(result)), 200


@blueprint.post("/add-notes")
@login_required
def add_note() -> tuple[Response, int]:
    body = parse_body(AddNoteBody)
    video_id = extract_video_id(body.video_url)
    if video_id is None:
        raise ValidationError("videoUrl must be a YouTube video link")
    try:
        seconds = parse_clock(body.timestamp) if body.timestamp.strip() else None
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    created = container().notes.create_note(
        current_user_id(),
        video_id=video_id,
        title=body.video_title,
        text=body.notes,
        seconds=seconds,
        note_type=NoteType(body.note_type) if body.note_type else NoteType.NOTE,
    )
    return jsonify(
        {
            "message": "Note added successfully",
            "note_id": created.note.id,
            "status": created.note.status.value,
        }
    ), 201


@blueprint.patch("/<video_id>")
@login_required
def update_note(video_id: str) -> tuple[Response, int]:
    body = parse_body(UpdateNoteBody)
    container().notes.update_text(
        current_user_id(),
        video_id=video_id,
        text=body.notes,
        note_id=body.note_id,
        timestamp=body.timestamp,
    )
    return jsonify({"status": "success"}), 200


@blueprint.delete("/<video_id>")
@login_required
def delete_note(video_id: str) -> tuple[Response, int]:
    body = parse_body(DeleteNoteBody)
    container().notes.delete(
        current_user_id(), video_id=video_id, note_id=body.note_id, timestamp=body.timestamp
    )
    return jsonify({"status": "success"}), 200


@blueprint.post("/summarize")
@login_required
def summarize() -> tuple[Response, int]:
    body = parse_body(SummarizeBody)
    video_id = extract_video_id(body.video_url)
    if video_id is None:
        raise ValidationError("video_url must be a YouTube video link")
    return jsonify({"message": container().videos.bullet_summary(video_id)}), 200


def _set_favourite(fav: bool) -> tuple[Response, int]:
    body = parse_body(FavouriteBody)
    container().notes.set_favourite(
        current_user_id(), fav=fav, video_id=body.video_id, video_title=body.video_title
    )
    message = "Note marked as favourite." if fav else "Note removed from favourites."
    return jsonify({"message": message}), 200


@blueprint.post("/fav-note")
@login_required
def favourite() -> tuple[Response, int]:
    return _set_favourite(True)


@blueprint.post("/unfav-note")
@login_required
def unfavourite() -> tuple[Response, int]:
    return _set_favourite(False)
