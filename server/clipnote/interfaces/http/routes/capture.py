"""Save a note from a shared YouTube link (used by the iOS Shortcut)."""

from __future__ import annotations

from flask import Blueprint, Response, jsonify, request

from clipnote.interfaces.http.auth import capture_auth_required, container, current_user_id
from clipnote.interfaces.http.schemas import CaptureBody, parse_body

blueprint = Blueprint("capture", __name__)


@blueprint.post("/api/capture")
@capture_auth_required
def capture() -> tuple[Response, int]:
    body = parse_body(CaptureBody)
    result = container().capture.capture(
        current_user_id(), url=body.url, text=body.text, note_type=body.note_type
    )
    note = result.note
    when = f"at {note.display_time}" if note.display_time else "to the video (no time in link)"
    return jsonify(
        {
            "message": f"Saved {when}",
            "note_id": note.id,
            "video_id": result.video.id,
            "video_title": result.video.title,
            "seconds": note.timestamp_seconds,
            "display_time": note.display_time,
            "status": note.status.value,
            "duplicate": result.duplicate,
            "note_url": f"{request.host_url}{result.video.id}",
        }
    ), 201
