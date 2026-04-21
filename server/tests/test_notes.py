import pytest
from unittest.mock import patch, MagicMock
import jwt
from datetime import datetime, timezone, timedelta
from config import JWT_SECRET

@pytest.fixture
def client():
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_headers():
    payload = {
        "sub": "user_123",
        "username": "testuser",
        "exp": datetime.now(timezone.utc) + timedelta(days=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}

@patch("app.psycopg.connect")
def test_dashboard_access_requires_auth(mock_connect, client):
    # Unauthenticated
    response = client.get("/user-status")
    assert response.status_code == 401

@patch("app.psycopg.connect")
def test_get_user_status_authenticated(mock_connect, client, auth_headers):
    # Authenticated
    response = client.get("/user-status", headers=auth_headers)
    assert response.status_code == 200
    assert response.json["is_guest"] == False

@patch("app.psycopg.connect")
@patch("app.get_video_transcription_apify")
@patch("app.put_object_to_s3")
@patch("app.generate_video_summary")
def test_add_note_new_video(mock_gen_summary, mock_s3, mock_apify, mock_connect, client, auth_headers):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    
    # 1st execute for 'SELECT 1 FROM video WHERE id = %s' returns None implying new video
    mock_cur.fetchone.return_value = None
    
    mock_apify.return_value = [{"start": 0, "text": "Hello test"}]
    mock_s3.return_value = True
    mock_gen_summary.return_value = "Mocked Summary"
    
    response = client.post("/add-notes", 
        json={
            "videoUrl": "https://youtube.com/watch?v=abcd123",
            "videoTitle": "Test Video",
            "notes": "Test note",
            "currentTimeStamp": "01:23"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    assert response.json["message"] == "Note added successfully"
    mock_apify.assert_called_once_with("abcd123")
    mock_gen_summary.assert_called_once_with("Hello test")

@patch("app.psycopg.connect")
def test_get_all_notes(mock_connect, client, auth_headers):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    
    mock_cur.fetchall.return_value = [
        ("abcd123", "https://youtube.com/watch?v=abcd123", "Test Video", False)
    ]
    
    response = client.get("/all-video?page=1", headers=auth_headers)
    assert response.status_code == 200
    assert "videos" in response.json
    assert len(response.json["videos"]) == 1
    assert response.json["videos"][0]["video_title"] == "Test Video"
