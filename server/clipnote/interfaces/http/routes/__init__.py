"""Flask blueprints, one per feature area."""

from flask import Blueprint

from clipnote.interfaces.http.routes import (
    accounts,
    api_tokens,
    capture,
    clipchat,
    export,
    health,
    labels,
    notes,
    pages,
)

# Order matters: literal-prefixed routes are registered before the catch-all
# "/<video_id>" page and note routes so they can never be shadowed.
BLUEPRINTS: tuple[Blueprint, ...] = (
    health.blueprint,
    accounts.blueprint,
    api_tokens.blueprint,
    export.blueprint,
    capture.blueprint,
    clipchat.blueprint,
    notes.blueprint,
    labels.blueprint,
    pages.blueprint,
)

__all__ = ["BLUEPRINTS"]
