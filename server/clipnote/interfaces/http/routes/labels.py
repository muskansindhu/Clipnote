"""Labels and their assignment to videos."""

from __future__ import annotations

from flask import Blueprint, Response, jsonify

from clipnote.interfaces.http.auth import container, current_user_id, login_required
from clipnote.interfaces.http.schemas import (
    LabelBody,
    LabelDeleteBody,
    LabelRenameBody,
    VideoLabelBody,
    VideoLabelRemoveBody,
    parse_body,
)
from clipnote.interfaces.http.serializers import label_json, listing_json

blueprint = Blueprint("labels", __name__)


@blueprint.get("/labels")
@login_required
def list_labels() -> Response:
    return jsonify(
        [label_json(label) for label in container().labels.list_for_user(current_user_id())]
    )


@blueprint.post("/label")
@login_required
def add_label() -> tuple[Response, int]:
    container().labels.add(current_user_id(), parse_body(LabelBody).label_name)
    return jsonify({"message": "Label added successfully"}), 201


@blueprint.patch("/label")
@login_required
def rename_label() -> tuple[Response, int]:
    body = parse_body(LabelRenameBody)
    container().labels.rename(current_user_id(), body.label_id, body.new_name)
    return jsonify({"message": "Label updated successfully"}), 200


@blueprint.delete("/label")
@login_required
def delete_label() -> tuple[Response, int]:
    container().labels.delete(current_user_id(), parse_body(LabelDeleteBody).label_id)
    return jsonify({"message": "Label deleted successfully"}), 200


@blueprint.get("/<label_name>/note")
@login_required
def videos_for_label(label_name: str) -> tuple[Response, int]:
    videos = container().labels.videos_for_label(current_user_id(), label_name)
    return jsonify([{**listing_json(v), "video_id": v.id} for v in videos]), 200


@blueprint.get("/<video_id>/label")
@login_required
def video_label(video_id: str) -> tuple[Response, int]:
    return jsonify({"label": container().labels.name_for_video(current_user_id(), video_id)}), 200


@blueprint.post("/video-label")
@login_required
def add_video_label() -> tuple[Response, int]:
    body = parse_body(VideoLabelBody)
    container().labels.assign(current_user_id(), label_name=body.label_name, video_id=body.video_id)
    return jsonify({"message": "Video Label added successfully"}), 201


@blueprint.delete("/video-label")
@login_required
def remove_video_label() -> tuple[Response, int]:
    container().labels.unassign(current_user_id(), parse_body(VideoLabelRemoveBody).video_id)
    return jsonify({"message": "Video label removed successfully"}), 200
