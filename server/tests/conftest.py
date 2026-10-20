"""Shared fixtures."""

from __future__ import annotations

import pytest
from support.world import World, build_world


@pytest.fixture
def world() -> World:
    """A fresh application wired to in-memory fakes."""
    return build_world()
