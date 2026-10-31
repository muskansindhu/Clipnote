"""Clipchat: ask questions about a video."""

from __future__ import annotations

import json
from collections.abc import Iterator

from flask import Blueprint, Response, jsonify, stream_with_context

from clipnote.domain import ExternalServiceError
from clipnote.interfaces.http.auth import container, current_user_id, login_required
from clipnote.interfaces.http.errors import error_response
from clipnote.interfaces.http.schemas import QuestionBody, parse_body
from clipnote.interfaces.http.serializers import clipchat_json

blueprint = Blueprint("clipchat", __name__, url_prefix="/clipchat")
STREAM_CHUNK_CHARS = 28
ANSWER_FAILED = "Clipchat could not answer right now"


@blueprint.get("/<video_id>/context")
@login_required
def context(video_id: str) -> tuple[Response, int]:
    return jsonify(clipchat_json(container().clipchat.context(current_user_id(), video_id))), 200


@blueprint.post("/<video_id>/prepare")
@login_required
def prepare(video_id: str) -> tuple[Response, int]:
    return jsonify(clipchat_json(container().clipchat.prepare(current_user_id(), video_id))), 200


@blueprint.post("/<video_id>/ask")
@login_required
def ask(video_id: str) -> tuple[Response, int]:
    question = parse_body(QuestionBody).question
    try:
        answer = container().clipchat.ask(current_user_id(), video_id, question)
    except ExternalServiceError:
        return error_response(ANSWER_FAILED, 502)
    return jsonify({"answer": answer}), 200


def _server_sent_events(answer: str) -> Iterator[str]:
    for start in range(0, len(answer), STREAM_CHUNK_CHARS):
        chunk = json.dumps({"delta": answer[start : start + STREAM_CHUNK_CHARS]})
        yield f"event: chunk\ndata: {chunk}\n\n"
    yield f"event: done\ndata: {json.dumps({'answer': answer})}\n\n"


@blueprint.post("/<video_id>/stream")
@login_required
def stream(video_id: str) -> Response | tuple[Response, int]:
    question = parse_body(QuestionBody).question
    try:
        answer = container().clipchat.ask(current_user_id(), video_id, question)
    except ExternalServiceError:
        return error_response(ANSWER_FAILED, 502)
    return Response(
        stream_with_context(_server_sent_events(answer)),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
