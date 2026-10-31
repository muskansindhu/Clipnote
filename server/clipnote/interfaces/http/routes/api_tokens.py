"""Manage personal API tokens (login required; API tokens cannot manage themselves)."""

from __future__ import annotations

from flask import Blueprint, Response, jsonify

from clipnote.interfaces.http.auth import container, current_user_id, login_required
from clipnote.interfaces.http.schemas import TokenCreateBody, parse_body
from clipnote.interfaces.http.serializers import token_json

blueprint = Blueprint("api_tokens", __name__, url_prefix="/api/tokens")


@blueprint.get("")
@login_required
def list_tokens() -> Response:
    return jsonify([token_json(t) for t in container().api_tokens.list_for_user(current_user_id())])


@blueprint.post("")
@login_required
def create_token() -> tuple[Response, int]:
    created = container().api_tokens.create(current_user_id(), parse_body(TokenCreateBody).label)
    return jsonify({"token": created.secret, "record": token_json(created.record)}), 201


@blueprint.delete("/<int:token_id>")
@login_required
def revoke_token(token_id: int) -> tuple[Response, int]:
    container().api_tokens.revoke(current_user_id(), token_id)
    return jsonify({"message": "Token revoked"}), 200
