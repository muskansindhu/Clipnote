"""Rate limits on the HTTP routes."""

from __future__ import annotations

from flask.testing import FlaskClient
from support.http import bearer

from clipnote.constants import RATE_LIMIT_CAPTURE, RATE_LIMIT_LOGIN

LOGIN = {"email": "nobody@example.com", "password": "wrong-password"}
CAPTURE = {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30", "text": "hi"}


def test_login_is_blocked_after_too_many_attempts(client: FlaskClient) -> None:
    limit, _ = RATE_LIMIT_LOGIN
    statuses = [client.post("/login", json=LOGIN).status_code for _ in range(limit + 1)]

    assert statuses[:limit] == [401] * limit
    assert statuses[limit] == 429


def test_blocked_response_tells_the_client_when_to_retry(client: FlaskClient) -> None:
    limit, window = RATE_LIMIT_LOGIN
    for _ in range(limit):
        client.post("/login", json=LOGIN)

    response = client.post("/login", json=LOGIN)

    assert response.status_code == 429
    assert 1 <= int(response.headers["Retry-After"]) <= window
    assert response.get_json()["message"]


def test_signed_in_limits_are_counted_per_user(client: FlaskClient) -> None:
    limit, _ = RATE_LIMIT_CAPTURE
    for _ in range(limit):
        client.post("/api/capture", json=CAPTURE, headers=bearer("alice"))

    assert client.post("/api/capture", json=CAPTURE, headers=bearer("alice")).status_code == 429
    assert client.post("/api/capture", json=CAPTURE, headers=bearer("bob")).status_code == 201


def test_unrelated_routes_are_not_limited(client: FlaskClient) -> None:
    limit, _ = RATE_LIMIT_LOGIN
    for _ in range(limit + 1):
        client.post("/login", json=LOGIN)

    assert client.get("/").status_code == 200
