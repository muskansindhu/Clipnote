"""Fixtures that run the real Flask app on top of in-memory fakes."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import pytest
from flask import Flask
from flask.testing import FlaskClient
from support.fakes import FakeHealthProbe
from support.world import World, build_world

from clipnote.infrastructure.config import load_settings
from clipnote.infrastructure.ratelimit import InMemoryRateLimiter
from clipnote.interfaces.http import Container, create_app


@pytest.fixture
def api_world() -> World:
    return build_world()


@pytest.fixture
def health_probe() -> FakeHealthProbe:
    return FakeHealthProbe()


@pytest.fixture
def make_app(
    api_world: World, tmp_path: Path, health_probe: FakeHealthProbe
) -> Callable[..., Flask]:
    """Build the app with extra environment settings, e.g. ``make_app(FLASK_ENV="production")``."""
    w = api_world
    container = Container(
        codec=w.codec,
        auth=w.auth,
        notes=w.note_service,
        capture=w.capture,
        labels=w.label_service,
        api_tokens=w.token_service,
        export=w.export,
        clipchat=w.clipchat,
        enrichment=w.enrichment,
        rate_limiter=InMemoryRateLimiter(),
        health=health_probe,
    )

    def build(**env: str) -> Flask:
        base = {"DATABASE_URL": "postgresql://unused", "JWT_SECRET": "test-secret", **env}
        flask_app = create_app(load_settings(base), container)
        flask_app.config["TESTING"] = False  # exercise the real error handlers
        (tmp_path / "index.html").write_text(
            "<!doctype html><title>Clipnote</title><div id=root></div>"
        )
        flask_app.config["CLIPNOTE_SPA_DIR"] = tmp_path
        return flask_app

    return build


@pytest.fixture
def app(make_app: Callable[..., Flask]) -> Flask:
    return make_app()


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()
