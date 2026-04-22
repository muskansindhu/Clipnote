import pytest
from unittest.mock import MagicMock, patch

from werkzeug.security import generate_password_hash


@pytest.fixture
def client():
    from app import app

    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_login_missing_credentials(client):
    response = client.post("/login", json={"email": ""})
    assert response.status_code == 400
    assert response.json["message"] == "Email and password required"


def test_signup_missing_credentials(client):
    response = client.post("/signup", json={})
    assert response.status_code == 400
    assert response.json["message"] == "Username, email, and password required"


@patch("app.psycopg.connect")
def test_login_invalid_credentials(mock_connect, client):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = None

    response = client.post(
        "/login", json={"email": "fake@example.com", "password": "secure"}
    )

    assert response.status_code == 401
    assert response.json["message"] == "Invalid credentials"


@patch("app.psycopg.connect")
def test_login_normalises_email(mock_connect, client):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = (
        "user_123",
        "SampleUser",
        "sample.user@example.com",
        generate_password_hash("secure123"),
        None,
    )

    response = client.post(
        "/login",
        json={"email": "  Sample.User@Example.com  ", "password": "secure123"},
    )

    assert response.status_code == 200
    executed_query = mock_cur.execute.call_args_list[0].args
    assert executed_query[1] == ("sample.user@example.com",)


@patch("app.psycopg.connect")
def test_login_google_only_account_requires_google_sign_in(mock_connect, client):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = (
        "user_123",
        "User",
        "user@example.com",
        None,
        "google-sub-123",
    )

    response = client.post(
        "/login",
        json={"email": "user@example.com", "password": "secure"},
    )

    assert response.status_code == 401
    assert "Google sign-in" in response.json["message"]


@patch("app.psycopg.connect")
def test_signup_creates_account_with_username_and_email(mock_connect, client):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.side_effect = [
        None,
        None,
        ("user_123",),
    ]

    response = client.post(
        "/signup",
        json={
            "username": "User",
            "email": "User@Example.com",
            "password": "secure123",
        },
    )

    assert response.status_code == 201
    assert "access_token" in response.json

    select_args = mock_cur.execute.call_args_list[0].args
    assert select_args[1] == ("user@example.com",)


@patch("app.psycopg.connect")
def test_signup_adds_password_to_existing_google_account(mock_connect, client):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.side_effect = [
        ("user_123", "existing_google", "user@example.com", None),
        None,
    ]

    response = client.post(
        "/signup",
        json={
            "username": "User",
            "email": "user@example.com",
            "password": "secure123",
        },
    )

    assert response.status_code == 201
    assert "access_token" in response.json

    executed_queries = [call.args[0] for call in mock_cur.execute.call_args_list]
    assert any("UPDATE users" in query for query in executed_queries)


@patch("app.psycopg.connect")
def test_signup_rejects_duplicate_username(mock_connect, client):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.side_effect = [
        None,
        (1,),
    ]

    response = client.post(
        "/signup",
        json={
            "username": "TakenName",
            "email": "new@example.com",
            "password": "secure123",
        },
    )

    assert response.status_code == 409
    assert response.json["message"] == "Username already exists"


@patch("app.oauth.google.parse_id_token")
@patch("app.oauth.google.authorize_access_token")
@patch("app.psycopg.connect")
def test_google_login_links_existing_local_account(
    mock_connect,
    mock_authorize_access_token,
    mock_parse_id_token,
    client,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur

    mock_authorize_access_token.return_value = {
        "userinfo": {
            "email": "user@example.com",
            "sub": "google-sub-123",
        }
    }
    mock_parse_id_token.return_value = None
    mock_cur.fetchone.side_effect = [None, ("user_123", "User", "user@example.com")]

    response = client.get("/auth/google/callback?api=1")

    assert response.status_code == 200
    assert "access_token" in response.json

    executed_queries = [call.args[0] for call in mock_cur.execute.call_args_list]
    assert any("SET google_sub = %s" in query for query in executed_queries)


@patch("app.oauth.google.parse_id_token")
@patch("app.oauth.google.authorize_access_token")
@patch("app.psycopg.connect")
def test_google_login_creates_new_account_with_derived_username(
    mock_connect,
    mock_authorize_access_token,
    mock_parse_id_token,
    client,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur

    mock_authorize_access_token.return_value = {
        "userinfo": {
            "email": "new.user@example.com",
            "sub": "google-sub-999",
        }
    }
    mock_parse_id_token.return_value = None
    mock_cur.fetchone.side_effect = [None, None, None, ("user_999", "new_user", "new.user@example.com")]

    response = client.get("/auth/google/callback?api=1")

    assert response.status_code == 200
    assert "access_token" in response.json


def test_guest_login(client):
    response = client.post("/guest-login")
    assert response.status_code == 200
    assert "access_token" in response.json
