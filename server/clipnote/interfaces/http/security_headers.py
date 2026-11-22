"""Security headers added to every response."""

from __future__ import annotations

from flask import Flask, Response

from clipnote.constants import CSP_DIRECTIVES, HSTS_MAX_AGE_SECONDS, PERMISSIONS_POLICY
from clipnote.infrastructure.config import Settings

CONTENT_SECURITY_POLICY = "; ".join(
    f"{name} {' '.join(sources)}" for name, sources in CSP_DIRECTIVES
)


def register_security_headers(app: Flask, settings: Settings) -> None:
    """Attach the Content-Security-Policy and related headers to every response.

    With ``settings.csp_report_only`` the policy is sent as ``Content-Security-Policy-Report-Only``:
    the browser logs violations but blocks nothing. Use it to trial a stricter policy.
    """
    csp_header = (
        "Content-Security-Policy-Report-Only"
        if settings.csp_report_only
        else "Content-Security-Policy"
    )

    @app.after_request
    def add_headers(response: Response) -> Response:
        response.headers.setdefault(csp_header, CONTENT_SECURITY_POLICY)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", PERMISSIONS_POLICY)
        if settings.is_production:
            # Browsers ignore this over plain HTTP, so sending it unconditionally is safe.
            response.headers.setdefault(
                "Strict-Transport-Security", f"max-age={HSTS_MAX_AGE_SECONDS}"
            )
        return response
