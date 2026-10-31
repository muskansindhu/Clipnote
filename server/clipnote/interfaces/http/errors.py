"""Maps domain errors to JSON error responses."""

from __future__ import annotations

import logging

from flask import Flask, Response, jsonify
from werkzeug.exceptions import HTTPException

from clipnote.domain import (
    AuthenticationError,
    ConflictError,
    DomainError,
    ExternalServiceError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)

logger = logging.getLogger(__name__)

_STATUS_BY_ERROR: tuple[tuple[type[DomainError], int], ...] = (
    (ValidationError, 400),
    (AuthenticationError, 401),
    (PermissionDeniedError, 403),
    (NotFoundError, 404),
    (ConflictError, 409),
    (ExternalServiceError, 502),
)


def error_response(message: str, status: int) -> tuple[Response, int]:
    """Build a JSON error. ``error`` mirrors ``message`` for older front-end code."""
    return jsonify({"message": message, "error": message}), status


def register_error_handlers(app: Flask) -> None:
    """Install JSON handlers for domain errors, HTTP errors and unexpected failures."""

    @app.errorhandler(DomainError)
    def handle_domain_error(exc: DomainError) -> tuple[Response, int]:
        for error_type, status in _STATUS_BY_ERROR:
            if isinstance(exc, error_type):
                return error_response(str(exc), status)
        return error_response(str(exc), 400)

    @app.errorhandler(HTTPException)
    def handle_http_error(exc: HTTPException) -> tuple[Response, int]:
        return error_response(exc.description or exc.name, exc.code or 500)

    @app.errorhandler(Exception)
    def handle_unexpected(exc: Exception) -> tuple[Response, int]:
        logger.exception("Unhandled error", exc_info=exc)
        return error_response("Internal server error", 500)
