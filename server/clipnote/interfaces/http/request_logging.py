"""Request ids and one log line per request."""

from __future__ import annotations

import logging
import re
import time
import uuid

from flask import Flask, Response, g, has_request_context, request

from clipnote.constants import REQUEST_ID_HEADER, REQUEST_ID_PATTERN, REQUEST_LOG_SKIP_PREFIXES

logger = logging.getLogger("clipnote.request")
_VALID_ID = re.compile(REQUEST_ID_PATTERN)


class RequestIdFilter(logging.Filter):
    """Stamps every log record written during a request with that request's id."""

    def filter(self, record: logging.LogRecord) -> bool:
        """Add ``request_id`` when inside a request; never drops the record."""
        if has_request_context() and "request_id" not in vars(record):
            record.request_id = g.get("request_id")
        return True


def register_request_logging(app: Flask) -> None:
    """Give each request an id (echoed in ``X-Request-ID``) and log how it ended.

    An id sent by a proxy or client is reused when it looks safe, so one id can follow a request
    across services; otherwise a new one is made. Query strings and bodies are never logged.
    """

    @app.before_request
    def start_request() -> None:
        sent = request.headers.get(REQUEST_ID_HEADER, "")
        g.request_id = sent if _VALID_ID.match(sent) else uuid.uuid4().hex
        g.started_at = time.perf_counter()

    @app.after_request
    def finish_request(response: Response) -> Response:
        response.headers[REQUEST_ID_HEADER] = g.get("request_id", "")
        if not request.path.startswith(REQUEST_LOG_SKIP_PREFIXES):
            started = g.get("started_at")
            logger.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1)
                    if started is not None
                    else None,
                    "user_id": g.get("user_id"),
                },
            )
        return response
