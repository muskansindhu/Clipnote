"""Process-wide logging setup: readable text locally, one JSON object per line in production."""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime

# Attributes every LogRecord has; anything else was added through ``extra=`` and is worth logging.
_STANDARD_ATTRIBUTES = frozenset(vars(logging.makeLogRecord({}))) | {"message", "asctime"}
_HANDLER_MARK = "_clipnote_handler"


class JsonFormatter(logging.Formatter):
    """Formats each record as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        """Return the record as JSON, including ``extra`` fields and any traceback."""
        entry: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in vars(record).items():
            if key not in _STANDARD_ATTRIBUTES and not key.startswith("_"):
                entry[key] = value
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def configure_logging(log_format: str, level: str, *filters: logging.Filter) -> None:
    """Send all logs to stdout in ``log_format`` ("json" or "text") at ``level``.

    Safe to call more than once: it replaces only the handler it installed earlier.

    Args:
        log_format: ``"json"`` or ``"text"``.
        level: A standard level name such as ``"INFO"``.
        filters: Attached to the handler, e.g. to add a request id to every record.
    """
    root = logging.getLogger()
    for handler in [h for h in root.handlers if getattr(h, _HANDLER_MARK, False)]:
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    setattr(handler, _HANDLER_MARK, True)
    handler.setFormatter(
        JsonFormatter()
        if log_format == "json"
        else logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    for log_filter in filters:
        handler.addFilter(log_filter)
    root.addHandler(handler)
    root.setLevel(logging.getLevelNamesMapping().get(level, logging.INFO))
