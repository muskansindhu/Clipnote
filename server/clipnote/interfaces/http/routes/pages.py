"""Server-rendered pages. All data is loaded by the page's own JavaScript."""

from __future__ import annotations

from flask import Blueprint, abort, render_template

from clipnote.domain import is_valid_video_id

blueprint = Blueprint("pages", __name__)


@blueprint.get("/")
def home() -> str:
    return render_template("home.html")


@blueprint.get("/login")
def login_page() -> str:
    return render_template("login.html")


@blueprint.get("/dashboard")
def dashboard() -> str:
    return render_template("dashboard.html")


@blueprint.get("/profile")
def profile() -> str:
    return render_template("profile.html")


@blueprint.get("/clipchat")
@blueprint.get("/clipchat/<video_id>")
def clipchat_page(video_id: str | None = None) -> str:
    return render_template("clipchat.html")


@blueprint.get("/<video_id>")
def note_page(video_id: str) -> str:
    if not is_valid_video_id(video_id):
        abort(404)
    return render_template("note.html")
