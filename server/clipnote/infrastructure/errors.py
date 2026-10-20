"""Errors raised by infrastructure code."""

from __future__ import annotations


class ConfigurationError(RuntimeError):
    """Raised when required configuration is missing or invalid."""
