"""Request authentication: bearer JWTs and personal API tokens."""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any, ParamSpec, TypeVar

from flask import current_app, g, request

from clipnote.domain import AuthenticationError
from clipnote.interfaces.http.container import Container

P = ParamSpec("P")
R = TypeVar("R")
API_TOKEN_PREFIX = "cn_"  # noqa: S105  # public marker, not a secret


def container() -> Container:
    """Return the services wired for the current app."""
    services: Container = current_app.extensions["clipnote"]
    return services


def _bearer_token() -> str:
    header = request.headers.get("Authorization", "")
    scheme, _, value = header.partition(" ")
    if scheme != "Bearer" or not value.strip():
        raise AuthenticationError("Token missing")
    return value.strip()


def login_required(view: Callable[P, R]) -> Callable[P, R]:
    """Require a valid login JWT and expose the caller as ``g.user_id``."""

    @wraps(view)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        g.user_id = container().codec.decode(_bearer_token()).user_id
        return view(*args, **kwargs)

    return wrapper


def capture_auth_required(view: Callable[P, R]) -> Callable[P, R]:
    """Accept either a login JWT or a capture-scoped personal API token."""

    @wraps(view)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        token = _bearer_token()
        services = container()
        if token.startswith(API_TOKEN_PREFIX):
            g.user_id = services.api_tokens.authenticate(token).user_id
        else:
            g.user_id = services.codec.decode(token).user_id
        return view(*args, **kwargs)

    return wrapper


def current_user_id() -> str:
    """Return the id of the authenticated caller."""
    user_id: Any = g.user_id
    return str(user_id)
