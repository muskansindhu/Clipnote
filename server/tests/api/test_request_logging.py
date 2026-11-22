"""Request ids and the per-request log line."""

from __future__ import annotations

import logging

import pytest
from flask.testing import FlaskClient


def test_every_response_has_a_request_id(client: FlaskClient) -> None:
    first = client.get("/").headers["X-Request-ID"]
    second = client.get("/").headers["X-Request-ID"]

    assert first and second and first != second


def test_a_safe_incoming_request_id_is_reused(client: FlaskClient) -> None:
    response = client.get("/", headers={"X-Request-ID": "trace-123.abc"})

    assert response.headers["X-Request-ID"] == "trace-123.abc"


def test_an_unsafe_incoming_request_id_is_replaced(client: FlaskClient) -> None:
    for unsafe in ("has spaces & symbols", "x" * 200):
        response = client.get("/", headers={"X-Request-ID": unsafe})

        assert response.headers["X-Request-ID"] != unsafe
        assert len(response.headers["X-Request-ID"]) == 32


def test_each_request_is_logged_without_the_query_string(
    client: FlaskClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="clipnote.request"):
        client.get("/dashboard?token=secret-value")

    record = next(r for r in caplog.records if r.name == "clipnote.request")
    assert record.method == "GET"  # type: ignore[attr-defined]
    assert record.path == "/dashboard"  # type: ignore[attr-defined]
    assert record.status == 200  # type: ignore[attr-defined]
    assert "secret-value" not in caplog.text


def test_static_files_are_not_logged(client: FlaskClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="clipnote.request"):
        client.get("/static/app/anything.js")

    assert not [r for r in caplog.records if r.name == "clipnote.request"]
