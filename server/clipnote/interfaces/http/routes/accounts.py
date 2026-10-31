"""Sign-up, sign-in, Google OAuth and password changes."""

from __future__ import annotations

from typing import Any

from flask import (
    Blueprint,
    Response,
    current_app,
    jsonify,
    make_response,
    redirect,
    request,
    url_for,
)
from werkzeug.wrappers import Response as WerkzeugResponse

from clipnote.constants import (
    TEMP_TOKEN_COOKIE_SECONDS,
)
from clipnote.domain import AuthenticationError
from clipnote.interfaces.http.auth import container, current_user_id, login_required
from clipnote.interfaces.http.schemas import ChangePasswordBody, LoginBody, SignupBody, parse_body

blueprint = Blueprint("accounts", __name__)


@blueprint.post("/login")
def login() -> tuple[Response, int]:
    body = parse_body(LoginBody)
    return jsonify(access_token=container().auth.login(body.email, body.password)), 200


@blueprint.post("/signup")
def signup() -> tuple[Response, int]:
    body = parse_body(SignupBody)
    token = container().auth.signup(body.username, body.email, body.password)
    return jsonify(access_token=token), 201


@blueprint.post("/change-password")
@login_required
def change_password() -> tuple[Response, int]:
    body = parse_body(ChangePasswordBody)
    container().auth.change_password(current_user_id(), body.current_password, body.new_password)
    return jsonify({"message": "Password updated successfully."}), 200


def _google() -> Any:
    client = getattr(
        current_app.extensions.get("authlib.integrations.flask_client"), "google", None
    )
    if client is None:
        raise AuthenticationError("Google sign-in is not configured")
    return client


@blueprint.get("/login/google")
def login_google() -> WerkzeugResponse:
    options: dict[str, Any] = {"_external": True}
    if current_app.config.get("CLIPNOTE_FORCE_HTTPS_CALLBACKS"):
        options["_scheme"] = "https"
    redirect_uri = url_for("accounts.google_callback", **options)
    response: WerkzeugResponse = _google().authorize_redirect(redirect_uri)
    return response


@blueprint.get("/auth/google/callback")
def google_callback() -> tuple[Response, int] | WerkzeugResponse:
    google = _google()
    token = google.authorize_access_token()
    info = token.get("userinfo") or google.parse_id_token(token)
    if not info:
        raise AuthenticationError("Google authentication failed")

    access_token = container().auth.login_with_google(
        email=str(info.get("email") or ""),
        google_sub=str(info.get("sub") or ""),
        picture=info.get("picture"),
    )
    if request.args.get("api") == "1":
        return jsonify(access_token=access_token), 200
    response = make_response(redirect("/dashboard"))
    response.set_cookie(
        "temp_access_token", access_token, max_age=TEMP_TOKEN_COOKIE_SECONDS, path="/"
    )
    return response
