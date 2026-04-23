import pytest
from unittest.mock import patch, MagicMock
import jwt
from datetime import datetime, timezone, timedelta
from config import JWT_SECRET
from auth_utils import issue_guest_access_token

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


@pytest.fixture
def guest_auth_headers():
    token = issue_guest_access_token(
        guest_id="guest_trial_123",
        jwt_secret=JWT_SECRET,
    )
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
    assert response.json["is_trial"] == False

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


def test_add_note_rejects_guest_trial(client, guest_auth_headers):
    response = client.post(
        "/add-notes",
        json={
            "videoUrl": "https://youtube.com/watch?v=abcd123",
            "videoTitle": "Test Video",
            "notes": "Test note",
            "currentTimeStamp": "01:23",
        },
        headers=guest_auth_headers,
    )

    assert response.status_code == 403
    assert "Create an account" in response.json["message"]

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


@patch("app.answer_clipchat_question")
@patch("clipchat.get_object_from_s3")
@patch("app.psycopg.connect")
def test_clipchat_ask_returns_simple_answer(
    mock_connect,
    mock_get_object,
    mock_answer_clipchat_question,
    client,
    auth_headers,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur

    mock_cur.fetchone.return_value = (
        "abcd123",
        "https://youtube.com/watch?v=abcd123",
        "Test Video",
        False,
        "Video summary",
    )
    mock_cur.fetchall.return_value = [
        (1, "01:23", "RAG is introduced here", "user"),
    ]

    mock_get_object.return_value = [
        {"start": 83, "text": "We are now talking about RAG"},
    ]
    mock_answer_clipchat_question.return_value = {
        "answer": "**The speaker covers RAG around [83].**",
    }

    response = client.post(
        "/clipchat/abcd123/ask",
        json={"question": "Where does the speaker talk about RAG?"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json == {
        "answer": "**The speaker covers RAG around [83].**",
    }


@patch("clipchat.fetch_youtube_video_metadata")
@patch("clipchat.get_object_from_s3")
@patch("app.psycopg.connect")
def test_clipchat_context_returns_metadata_and_pending_assets_when_s3_is_missing(
    mock_connect,
    mock_get_object,
    mock_fetch_metadata,
    client,
    guest_auth_headers,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = None

    mock_get_object.return_value = None
    mock_fetch_metadata.return_value = {
        "video_url": "https://www.youtube.com/watch?v=abcd123",
        "video_title": "Test Video",
    }

    response = client.get(
        "/clipchat/abcd123/context",
        headers=guest_auth_headers,
    )

    assert response.status_code == 200
    assert response.json["video_title"] == "Test Video"
    assert response.json["asset_status"] == {
        "transcript": "pending",
        "summary": "pending",
    }


@patch("clipchat.fetch_youtube_video_metadata")
@patch("clipchat.generate_video_summary")
@patch("clipchat.put_object_to_s3")
@patch("clipchat.get_video_transcription_apify")
@patch("clipchat.get_object_from_s3")
@patch("app.psycopg.connect")
def test_clipchat_prepare_fetches_transcript_and_summary_when_s3_is_missing(
    mock_connect,
    mock_get_object,
    mock_get_transcription,
    mock_put_object,
    mock_generate_video_summary,
    mock_fetch_metadata,
    client,
    guest_auth_headers,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = None

    mock_get_object.return_value = None
    mock_get_transcription.return_value = [
        {"start": 0, "text": "Hello world"},
        {"start": 5, "text": "This is Clipchat"},
    ]
    mock_put_object.return_value = True
    mock_generate_video_summary.return_value = "Fresh summary"
    mock_fetch_metadata.return_value = {
        "video_url": "https://www.youtube.com/watch?v=abcd123",
        "video_title": "Test Video",
    }

    response = client.post(
        "/clipchat/abcd123/prepare",
        headers=guest_auth_headers,
    )

    assert response.status_code == 200
    assert response.json["video_summary"] == "Fresh summary"
    assert response.json["asset_status"] == {
        "transcript": "ready",
        "summary": "ready",
        "transcript_source": "fetched",
        "summary_source": "generated",
    }
    mock_get_transcription.assert_called_once_with("abcd123")
    mock_generate_video_summary.assert_called_once_with(
        "Hello world This is Clipchat"
    )


@patch("app.answer_clipchat_question")
@patch("clipchat.get_object_from_s3")
@patch("app.psycopg.connect")
def test_clipchat_guest_ask_refreshes_trial_usage(
    mock_connect,
    mock_get_object,
    mock_answer_clipchat_question,
    client,
    guest_auth_headers,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = None

    mock_get_object.return_value = [
        {"start": 83, "text": "We are now talking about RAG"},
    ]
    mock_answer_clipchat_question.return_value = {
        "answer": "**The speaker covers RAG around [83].**",
    }

    response = client.post(
        "/clipchat/abcd123/ask",
        json={"question": "Where does the speaker talk about RAG?"},
        headers=guest_auth_headers,
    )

    assert response.status_code == 200
    refreshed_token = response.headers["X-Clipnote-Access-Token"]
    refreshed_payload = jwt.decode(
        refreshed_token,
        JWT_SECRET,
        algorithms=["HS256"],
    )

    assert refreshed_payload["clipchat_usage"] == {"abcd123": 1}


@patch("app.psycopg.connect")
def test_clipchat_guest_ask_blocks_after_five_questions(
    mock_connect,
    client,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = None

    guest_token = issue_guest_access_token(
        guest_id="guest_trial_123",
        jwt_secret=JWT_SECRET,
        clipchat_usage={"abcd123": 5},
    )

    response = client.post(
        "/clipchat/abcd123/ask",
        json={"question": "One more question"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    assert response.status_code == 403
    assert response.json["code"] == "clipchat_trial_limit"


@patch("app.answer_clipchat_question")
@patch("clipchat.get_object_from_s3")
@patch("app.psycopg.connect")
def test_clipchat_guest_ask_third_video_refreshes_trial_usage(
    mock_connect,
    mock_get_object,
    mock_answer_clipchat_question,
    client,
):
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cur.fetchone.return_value = None
    mock_get_object.return_value = [{"text": "hello", "offset": "00:00"}]
    mock_answer_clipchat_question.return_value = "Trial answer"

    guest_token = issue_guest_access_token(
        guest_id="guest_trial_123",
        jwt_secret=JWT_SECRET,
        clipchat_usage={"videoaaaaaa1": 1, "videoaaaaaa2": 2},
    )

    response = client.post(
        "/clipchat/abcd1234567/ask",
        json={"question": "What is this about?"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    assert response.status_code == 403
    assert response.json["code"] == "clipchat_trial_limit"
