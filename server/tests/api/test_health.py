"""Liveness and readiness endpoints."""

from __future__ import annotations

from flask.testing import FlaskClient
from support.fakes import FakeHealthProbe


def test_health_is_ok_without_credentials(client: FlaskClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_ready_when_the_database_answers(client: FlaskClient) -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ready"}


def test_not_ready_when_the_database_is_down(
    client: FlaskClient, health_probe: FakeHealthProbe
) -> None:
    health_probe.reachable = False

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.get_json() == {"status": "unavailable"}


def test_health_stays_ok_when_the_database_is_down(
    client: FlaskClient, health_probe: FakeHealthProbe
) -> None:
    health_probe.reachable = False

    assert client.get("/health").status_code == 200
