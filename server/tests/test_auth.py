import pytest
from unittest.mock import patch, MagicMock

@pytest.fixture
def client():
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_login_missing_credentials(client):
    response = client.post("/login", json={"username": ""})
    assert response.status_code == 400
    assert response.json["message"] == "Username and password required"

def test_signup_missing_credentials(client):
    response = client.post("/signup", json={})
    assert response.status_code == 400

@patch("app.psycopg.connect")
def test_login_invalid_credentials(mock_connect, client):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    
    # Simulate user not found or invalid password
    mock_cur.fetchone.return_value = None
    
    response = client.post("/login", json={"username": "fake", "password": "secure"})
    assert response.status_code == 401
    assert response.json["message"] == "Invalid credentials"

def test_guest_login(client):
    response = client.post("/guest-login")
    assert response.status_code == 200
    assert "access_token" in response.json
