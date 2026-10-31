"""Domain-level errors. The HTTP layer maps each one to a status code."""

from __future__ import annotations


class DomainError(Exception):
    """Base class for every error raised on purpose by the business rules."""


class ValidationError(DomainError):
    """Raised when input violates a business rule."""


class AuthenticationError(DomainError):
    """Raised when credentials or tokens are missing, wrong, expired or revoked."""


class PermissionDeniedError(DomainError):
    """Raised when an authenticated caller may not perform an action."""


class NotFoundError(DomainError):
    """Raised when a requested entity does not exist for the caller."""


class ConflictError(DomainError):
    """Raised when an action clashes with existing state (e.g. duplicate email)."""


class ExternalServiceError(DomainError):
    """Raised when a dependency such as the LLM or transcript source fails."""
