"""Browser security headers on responses."""

from __future__ import annotations

from collections.abc import Callable

from flask import Flask
from flask.testing import FlaskClient


def test_every_response_carries_the_basic_headers(client: FlaskClient) -> None:
    for response in (client.get("/"), client.get("/dashboard"), client.post("/login", json={})):
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "camera=()" in response.headers["Permissions-Policy"]


def test_csp_blocks_inline_scripts_and_framing_but_allows_the_youtube_player(
    client: FlaskClient,
) -> None:
    csp = client.get("/").headers["Content-Security-Policy"]
    directives = {part.split(" ", 1)[0]: part for part in csp.split("; ")}

    assert "'unsafe-inline'" not in directives["script-src"]
    assert "https://www.youtube.com" in directives["script-src"]
    assert "https://www.youtube.com" in directives["frame-src"]
    assert directives["frame-ancestors"] == "frame-ancestors 'none'"
    assert directives["object-src"] == "object-src 'none'"
    assert directives["default-src"] == "default-src 'self'"


def test_csp_can_be_switched_to_report_only(make_app: Callable[..., Flask]) -> None:
    response = make_app(CSP_REPORT_ONLY="1").test_client().get("/")

    assert "Content-Security-Policy" not in response.headers
    assert "default-src" in response.headers["Content-Security-Policy-Report-Only"]


def test_hsts_is_sent_only_in_production(
    client: FlaskClient, make_app: Callable[..., Flask]
) -> None:
    production = make_app(FLASK_ENV="production").test_client().get("/")

    assert "Strict-Transport-Security" not in client.get("/").headers
    assert production.headers["Strict-Transport-Security"].startswith("max-age=")
