"""JSON log formatting and logging setup."""

from __future__ import annotations

import json
import logging

import pytest

from clipnote.infrastructure.config import load_settings
from clipnote.infrastructure.errors import ConfigurationError
from clipnote.infrastructure.logging_config import JsonFormatter

BASE_ENV = {"DATABASE_URL": "postgresql://x", "JWT_SECRET": "s"}


def _record(message: str = "hello %s", **extra: object) -> logging.LogRecord:
    record = logging.LogRecord(
        "clipnote.test", logging.WARNING, __file__, 1, message, ("you",), None
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_json_formatter_writes_one_parseable_line_with_the_core_fields() -> None:
    line = JsonFormatter().format(_record())

    entry = json.loads(line)
    assert "\n" not in line
    assert entry["level"] == "WARNING"
    assert entry["logger"] == "clipnote.test"
    assert entry["message"] == "hello you"
    assert entry["time"].endswith("+00:00")


def test_json_formatter_includes_extra_fields() -> None:
    entry = json.loads(JsonFormatter().format(_record(status=404, request_id="abc")))

    assert entry["status"] == 404
    assert entry["request_id"] == "abc"


def test_json_formatter_includes_the_traceback() -> None:
    try:
        raise ValueError("boom")
    except ValueError:
        import sys

        record = _record()
        record.exc_info = sys.exc_info()

    entry = json.loads(JsonFormatter().format(record))

    assert "ValueError: boom" in entry["exception"]


def test_log_format_defaults_to_json_in_production_and_text_otherwise() -> None:
    assert load_settings({**BASE_ENV, "FLASK_ENV": "production"}).log_format == "json"
    assert load_settings(BASE_ENV).log_format == "text"
    assert load_settings({**BASE_ENV, "LOG_FORMAT": "JSON"}).log_format == "json"


def test_unknown_log_format_is_rejected() -> None:
    with pytest.raises(ConfigurationError, match="LOG_FORMAT"):
        load_settings({**BASE_ENV, "LOG_FORMAT": "xml"})
