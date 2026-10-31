"""Helpers for HTTP tests."""

from __future__ import annotations


def bearer(user_id: str) -> dict[str, str]:
    """Auth header accepted by the fake token codec."""
    return {"Authorization": f"Bearer token-for:{user_id}"}
