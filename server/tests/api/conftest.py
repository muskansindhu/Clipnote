"""Fixtures that run the real Flask app on top of in-memory fakes."""

from __future__ import annotations

import pytest
from flask import Flask
from flask.testing import FlaskClient
from support.world import World, build_world

from clipnote.application import VideoService
from clipnote.infrastructure.config import load_settings
from clipnote.interfaces.http import Container, create_app


@pytest.fixture
def api_world() -> World:
    return build_world()


@pytest.fixture
def app(api_world: World) -> Flask:
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
        videos=VideoService(w.transcripts, w.llm),
        enrichment=w.enrichment,
    )
    settings = load_settings({"DATABASE_URL": "postgresql://unused", "JWT_SECRET": "test-secret"})
    flask_app = create_app(settings, container)
    flask_app.config["TESTING"] = False  # exercise the real error handlers
    return flask_app


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()
