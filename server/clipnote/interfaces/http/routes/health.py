"""Liveness and readiness checks for hosts, load balancers and Docker."""

from __future__ import annotations

from flask import Blueprint, Response, jsonify

from clipnote.interfaces.http.auth import container

blueprint = Blueprint("health", __name__)


@blueprint.get("/health")
def liveness() -> tuple[Response, int]:
    """Report that the process is running. Does not touch any dependency."""
    return jsonify({"status": "ok"}), 200


@blueprint.get("/ready")
def readiness() -> tuple[Response, int]:
    """Report whether the app can serve requests, which needs the database."""
    if container().health.is_database_reachable():
        return jsonify({"status": "ready"}), 200
    return jsonify({"status": "unavailable"}), 503
