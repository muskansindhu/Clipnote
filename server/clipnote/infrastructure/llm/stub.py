"""Deterministic offline language model for local development and demos.

Selected with ``LLM_PROVIDER=stub``. It never calls the network and never produces
real insight; it exists so the app can be exercised without an API key.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

_PREVIEW_WORDS = 14


def _preview(text: str) -> str:
    body = text.split(":\n", 1)[-1]
    words = body.split()
    return " ".join(words[:_PREVIEW_WORDS]) + ("…" if len(words) > _PREVIEW_WORDS else "")


class StubLanguageModel:
    """Echoes the start of its input, clearly labelled as a stub."""

    def complete_text(self, *, system: str, user: str) -> str:
        return f"[stub] {_preview(user)}"

    def complete_structured(
        self, *, system: str, user: str, schema_name: str, schema: Mapping[str, Any]
    ) -> str:
        return json.dumps({"answer": f"**[stub]** I would answer “{user.strip()}” here."})
