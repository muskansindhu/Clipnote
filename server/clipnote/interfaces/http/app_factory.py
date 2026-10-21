"""Flask application factory."""

from __future__ import annotations

import logging

from authlib.integrations.flask_client import OAuth
from flask import Flask
from flask_cors import CORS

from clipnote.constants import SERVER_DIR, SPA_DIST_DIR
from clipnote.infrastructure.config import Settings, load_settings
from clipnote.interfaces.http.container import Container, build_container
from clipnote.interfaces.http.errors import register_error_handlers
from clipnote.interfaces.http.routes import BLUEPRINTS

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, container: Container | None = None) -> Flask:
    """Build the Flask app.

    Args:
        settings: Configuration; loaded from the environment when omitted.
        container: Pre-wired services, used by tests to inject fakes.

    Returns:
        The configured application.
    """
    settings = settings or load_settings()
    app = Flask(__name__, static_folder=str(SERVER_DIR / "static"))
    app.secret_key = settings.jwt_secret
    app.config["CLIPNOTE_FORCE_HTTPS_CALLBACKS"] = settings.is_production
    app.config["CLIPNOTE_SPA_DIR"] = SPA_DIST_DIR
    CORS(app)

    app.extensions["clipnote"] = container or build_container(settings)
    _register_google(app, settings)
    register_error_handlers(app)
    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

    if container is None:
        _recover_pending_notes(app.extensions["clipnote"])
    return app


def _register_google(app: Flask, settings: Settings) -> None:
    if not (settings.google_client_id and settings.google_client_secret):
        logger.info("Google sign-in is disabled: GOOGLE_CLIENT_ID/SECRET are not set")
        return
    oauth = OAuth(app)
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url=settings.google_discovery_url,
        client_kwargs={"scope": "openid email profile"},
    )


def _recover_pending_notes(services: Container) -> None:
    """Finish notes left pending by a previous run. Never blocks or fails startup."""
    try:
        queued = services.enrichment.recover_pending()
    except Exception:
        logger.exception("Could not re-queue pending notes at startup")
        return
    if queued:
        logger.info("Re-queued %d pending note(s)", queued)
