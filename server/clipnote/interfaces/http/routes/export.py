"""Markdown export."""

from __future__ import annotations

from datetime import date

from flask import Blueprint, Response, request

from clipnote.domain import ValidationError
from clipnote.interfaces.http.auth import container, current_user_id, login_required

blueprint = Blueprint("export", __name__, url_prefix="/api/export")


def _markdown_download(file_name: str, markdown: str) -> Response:
    return Response(
        markdown,
        mimetype="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@blueprint.get("")
@login_required
def export_all() -> Response:
    raw_since = request.args.get("since", "").strip()
    try:
        since = date.fromisoformat(raw_since) if raw_since else None
    except ValueError as exc:
        raise ValidationError("since must be a date like 2026-10-01") from exc
    return _markdown_download(*container().export.export_all(current_user_id(), since=since))


@blueprint.get("/<video_id>")
@login_required
def export_video(video_id: str) -> Response:
    return _markdown_download(*container().export.export_video(current_user_id(), video_id))
