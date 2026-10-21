"""The single-page web app. Every page route serves the same built ``index.html``."""

from __future__ import annotations

from flask import Blueprint, Response, current_app, request, send_from_directory
from werkzeug.exceptions import NotFound

from clipnote.constants import SPA_NOT_BUILT_MESSAGE
from clipnote.domain import is_valid_video_id
from clipnote.interfaces.http.errors import error_response

blueprint = Blueprint("pages", __name__)
INDEX_FILE = "index.html"


def _spa(status: int = 200) -> Response | tuple[Response, int]:
    directory = current_app.config["CLIPNOTE_SPA_DIR"]
    if not (directory / INDEX_FILE).is_file():
        return Response(SPA_NOT_BUILT_MESSAGE, status=503, mimetype="text/plain")
    response = send_from_directory(directory, INDEX_FILE)
    response.headers["Cache-Control"] = "no-cache"
    response.status_code = status
    return response


@blueprint.get("/")
@blueprint.get("/login")
@blueprint.get("/dashboard")
@blueprint.get("/library")
@blueprint.get("/profile")
@blueprint.get("/settings")
@blueprint.get("/clipchat")
def app_page() -> Response | tuple[Response, int]:
    return _spa()


@blueprint.get("/clipchat/<video_id>")
@blueprint.get("/<video_id>")
def video_page(video_id: str) -> Response | tuple[Response, int]:
    if not is_valid_video_id(video_id):
        raise NotFound()
    return _spa()


@blueprint.app_errorhandler(404)
def not_found(error: NotFound) -> Response | tuple[Response, int]:
    """Browsers get the app's own 404 page; API clients get JSON."""
    wants_html = "text/html" in request.headers.get("Accept", "")
    if request.method == "GET" and wants_html and not request.path.startswith("/api/"):
        return _spa(404)
    return error_response(error.description or "Not found", 404)
