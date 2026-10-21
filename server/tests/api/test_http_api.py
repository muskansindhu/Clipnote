"""End-to-end HTTP behaviour on in-memory fakes."""

from __future__ import annotations

import json
from pathlib import Path

from flask import Flask
from flask.testing import FlaskClient
from support.http import bearer
from support.world import World

from clipnote.domain import ExternalServiceError

VID = "dQw4w9WgXcQ"
ALICE = bearer("alice")
BOB = bearer("bob")


def _add_note(client: FlaskClient, headers: dict[str, str] = ALICE, **overrides: str):  # type: ignore[no-untyped-def]
    payload = {
        "videoUrl": f"https://www.youtube.com/watch?v={VID}",
        "videoTitle": "A Talk",
        "currentTimeStamp": "1:23",
        "notes": "first note",
    }
    payload.update(overrides)
    # The extension posts JSON with a text/plain content type.
    return client.post(
        "/add-notes", data=json.dumps(payload), headers={**headers, "Content-Type": "text/plain"}
    )


# --- authentication -------------------------------------------------------------------


def test_protected_routes_require_a_token(client: FlaskClient) -> None:
    response = client.get("/all-video")

    assert response.status_code == 401
    assert response.json["message"] == "Token missing"


def test_protected_routes_reject_bad_tokens(client: FlaskClient) -> None:
    response = client.get("/all-video", headers={"Authorization": "Bearer nonsense"})

    assert response.status_code == 401
    assert response.json["message"] == "Invalid token"


def test_signup_then_login(client: FlaskClient) -> None:
    signup = client.post(
        "/signup", json={"username": "muskan", "email": "m@example.com", "password": "secret1"}
    )
    login = client.post("/login", json={"email": "M@example.com", "password": "secret1"})

    assert signup.status_code == 201 and "access_token" in signup.json
    assert login.status_code == 200 and "access_token" in login.json


def test_login_and_signup_validation_errors(client: FlaskClient) -> None:
    assert client.post("/login", json={}).status_code == 400
    assert client.post("/signup", json={}).status_code == 400
    wrong = client.post("/login", json={"email": "x@y.co", "password": "nope"})
    assert wrong.status_code == 401 and wrong.json["message"] == "Invalid credentials"
    bad_type = client.post("/login", json={"email": 5, "password": "x"})
    assert bad_type.status_code == 400 and "email" in bad_type.json["message"]


def test_signup_conflict_is_409(client: FlaskClient) -> None:
    body = {"username": "muskan", "email": "m@example.com", "password": "secret1"}
    client.post("/signup", json=body)

    assert client.post("/signup", json=body).status_code == 409


def test_change_password_flow(client: FlaskClient, api_world: World) -> None:
    client.post("/signup", json={"username": "u", "email": "u@example.com", "password": "secret1"})
    user_id = api_world.users.get_by_email("u@example.com").id  # type: ignore[union-attr]

    ok = client.post(
        "/change-password",
        json={"current_password": "secret1", "new_password": "brandnew"},
        headers=bearer(user_id),
    )
    wrong = client.post(
        "/change-password",
        json={"current_password": "bad", "new_password": "brandnew"},
        headers=bearer(user_id),
    )

    assert ok.status_code == 200
    assert wrong.status_code == 401


def test_google_login_is_a_clean_error_when_unconfigured(client: FlaskClient) -> None:
    assert client.get("/login/google").status_code == 401


# --- notes (legacy endpoints used by the web app and the Chrome extension) --------------


def test_extension_payload_creates_a_note_without_blocking(client: FlaskClient) -> None:
    response = _add_note(client)

    assert response.status_code == 201
    assert response.json["message"] == "Note added successfully"
    assert response.json["status"] == "pending"


def test_add_note_validates_the_video_url_and_timestamp(client: FlaskClient) -> None:
    assert _add_note(client, videoUrl="https://example.com").status_code == 400
    bad_time = _add_note(client, currentTimeStamp="--:--")
    assert bad_time.status_code == 400 and "Invalid clock string" in bad_time.json["message"]


def test_add_note_with_empty_timestamp_is_a_video_level_note(client: FlaskClient) -> None:
    assert _add_note(client, currentTimeStamp="").status_code == 201

    notes = client.get(f"/note/{VID}", headers=ALICE).json
    assert notes[0]["timestamp_seconds"] is None
    assert notes[0]["video_timestamp"] is None


def test_note_page_data_keeps_the_legacy_shape_and_adds_new_fields(client: FlaskClient) -> None:
    _add_note(client)

    (note,) = client.get(f"/note/{VID}", headers=ALICE).json

    assert note["video_id"] == VID
    assert note["video_title"] == "A Talk"
    assert note["video_timestamp"] == "1:23"
    assert note["note"] == "first note"
    assert note["note_source"] == "user"
    assert note["fav"] is False
    assert {"id", "created_at", "video_url", "video_summary"} <= note.keys()
    assert (note["timestamp_seconds"], note["note_type"], note["status"]) == (
        83,
        "note",
        "pending",
    )


def test_notes_are_private_to_their_owner(client: FlaskClient) -> None:
    _add_note(client, headers=ALICE)

    assert client.get(f"/note/{VID}", headers=BOB).json == []
    assert client.get("/all-video", headers=BOB).json == {"videos": [], "has_next": False}


def test_unknown_video_is_404(client: FlaskClient) -> None:
    response = client.get(f"/note/{VID}", headers=ALICE)

    assert response.status_code == 404
    assert response.json["message"] == "Video not found"


def test_update_and_delete_by_note_id_and_by_timestamp(client: FlaskClient) -> None:
    _add_note(client)
    (note,) = client.get(f"/note/{VID}", headers=ALICE).json

    by_id = client.patch(f"/{VID}", json={"notes": "edited", "note_id": note["id"]}, headers=ALICE)
    by_time = client.patch(f"/{VID}", json={"notes": "again", "timestamp": "1:23"}, headers=ALICE)
    assert by_id.status_code == by_time.status_code == 200
    assert client.get(f"/note/{VID}", headers=ALICE).json[0]["note"] == "again"

    assert client.delete(f"/{VID}", json={"timestamp": "1:23"}, headers=ALICE).status_code == 200
    assert client.get(f"/note/{VID}", headers=ALICE).json == []
    missing = client.delete(f"/{VID}", json={"note_id": note["id"]}, headers=ALICE)
    assert missing.status_code == 404


def test_update_without_identifier_is_400(client: FlaskClient) -> None:
    assert client.patch(f"/{VID}", json={"notes": "x"}, headers=ALICE).status_code == 400


def test_favourites_are_per_user_and_accept_a_title_or_an_id(client: FlaskClient) -> None:
    _add_note(client, headers=ALICE)
    _add_note(client, headers=BOB)

    by_title = client.post("/fav-note", json={"video_title": "A Talk"}, headers=ALICE)
    assert by_title.status_code == 200
    assert client.get(f"/note/{VID}", headers=ALICE).json[0]["fav"] is True
    assert client.get(f"/note/{VID}", headers=BOB).json[0]["fav"] is False

    client.post("/unfav-note", json={"video_id": VID}, headers=ALICE)
    assert client.get(f"/note/{VID}", headers=ALICE).json[0]["fav"] is False
    assert (
        client.post("/fav-note", json={"video_id": "zzzzzzzzzzz"}, headers=ALICE).status_code == 404
    )


def test_all_video_lists_pages_and_searches(client: FlaskClient) -> None:
    for index in range(12):
        _add_note(
            client,
            videoUrl=f"https://www.youtube.com/watch?v=video{index:06d}",
            videoTitle=f"Talk {index:02d}",
        )

    first = client.get("/all-video?page=1", headers=ALICE).json
    second = client.get("/all-video?page=2", headers=ALICE).json
    searched = client.get("/all-video?search=talk 03&sort=title", headers=ALICE).json

    assert len(first["videos"]) == 10 and first["has_next"] is True
    assert len(second["videos"]) == 2 and second["has_next"] is False
    assert [v["video_title"] for v in searched["videos"]] == ["Talk 03"]
    assert set(first["videos"][0]) == {
        "id",
        "video_url",
        "video_title",
        "fav",
        "note_count",
        "last_note_at",
    }
    assert first["videos"][0]["note_count"] == 1


def test_summarize_returns_the_model_summary(client: FlaskClient, api_world: World) -> None:
    api_world.llm.text = "five bullets"

    response = client.post(
        "/summarize", json={"video_url": f"https://youtu.be/{VID}"}, headers=ALICE
    )

    assert response.status_code == 200 and response.json == {"message": "five bullets"}
    assert client.post("/summarize", json={"video_url": "nope"}, headers=ALICE).status_code == 400


# --- labels ---------------------------------------------------------------------------


def test_label_lifecycle_and_isolation(client: FlaskClient) -> None:
    _add_note(client)
    assert client.post("/label", json={"label_name": "ml"}, headers=ALICE).status_code == 201
    assert client.post("/label", json={"label_name": "ml"}, headers=ALICE).status_code == 409
    (label,) = client.get("/labels", headers=ALICE).json
    assert label["label_name"] == "ml"
    assert client.get("/labels", headers=BOB).json == []

    assign = client.post("/video-label", json={"label_name": "ml", "video_id": VID}, headers=ALICE)
    assert assign.status_code == 201
    assert client.get(f"/{VID}/label", headers=ALICE).json == {"label": "ml"}
    assert client.get(f"/{VID}/label", headers=BOB).json == {"label": None}
    stolen = client.post("/video-label", json={"label_name": "ml", "video_id": VID}, headers=BOB)
    assert stolen.status_code == 404

    assert (
        client.patch(
            "/label", json={"label_id": label["id"], "new_name": "deep"}, headers=ALICE
        ).status_code
        == 200
    )
    assert client.delete("/video-label", json={"video_id": VID}, headers=ALICE).status_code == 200
    assert client.get(f"/{VID}/label", headers=ALICE).json == {"label": None}
    assert client.delete("/label", json={"label_id": label["id"]}, headers=BOB).status_code == 404
    assert client.delete("/label", json={"label_id": label["id"]}, headers=ALICE).status_code == 200


def test_videos_for_an_unknown_label_is_404(client: FlaskClient) -> None:
    assert client.get("/nope/note", headers=ALICE).status_code == 404


# --- capture (the iOS Shortcut) -------------------------------------------------------


def _api_token(client: FlaskClient, headers: dict[str, str] = ALICE) -> str:
    return client.post("/api/tokens", json={"label": "iPhone"}, headers=headers).json["token"]


def test_capture_with_an_api_token_saves_a_timestamped_note(client: FlaskClient) -> None:
    token = _api_token(client)

    response = client.post(
        "/api/capture",
        json={"url": f"https://youtu.be/{VID}?si=x&t=754", "text": "great point", "type": "idea"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    body = response.json
    assert body["message"] == "Saved at 12:34"
    assert (body["seconds"], body["display_time"], body["duplicate"]) == (754, "12:34", False)
    assert body["note_url"].endswith(f"/{VID}")
    (note,) = client.get(f"/note/{VID}", headers=ALICE).json
    assert (note["note"], note["note_type"], note["timestamp_seconds"]) == (
        "great point",
        "idea",
        754,
    )


def test_capture_without_a_time_says_so_and_stores_no_timestamp(client: FlaskClient) -> None:
    response = client.post(
        "/api/capture", json={"url": f"https://youtu.be/{VID}", "text": "later"}, headers=ALICE
    )

    assert response.json["message"] == "Saved to the video (no time in link)"
    assert response.json["seconds"] is None


def test_capture_with_no_text_queues_an_ai_note(client: FlaskClient, api_world: World) -> None:
    response = client.post(
        "/api/capture", json={"url": f"https://youtu.be/{VID}?t=10"}, headers=ALICE
    )

    assert response.json["status"] == "pending"
    api_world.runner.run_all()
    (note,) = client.get(f"/note/{VID}", headers=ALICE).json
    assert (note["status"], note["note_source"]) == ("ready", "ai")


def test_capture_is_idempotent_within_the_dedupe_window(client: FlaskClient) -> None:
    payload = {"url": f"https://youtu.be/{VID}?t=9", "text": "same"}

    first = client.post("/api/capture", json=payload, headers=ALICE)
    second = client.post("/api/capture", json=payload, headers=ALICE)

    assert first.json["duplicate"] is False and second.json["duplicate"] is True
    assert first.json["note_id"] == second.json["note_id"]


def test_capture_rejects_bad_input(client: FlaskClient) -> None:
    assert (
        client.post("/api/capture", json={"url": "https://example.com"}, headers=ALICE).status_code
        == 400
    )
    bad_type = client.post(
        "/api/capture", json={"url": f"https://youtu.be/{VID}", "type": "poem"}, headers=ALICE
    )
    assert bad_type.status_code == 400 and "Unknown note type" in bad_type.json["message"]
    assert client.post("/api/capture", json={"url": f"https://youtu.be/{VID}"}).status_code == 401


def test_capture_rejects_unknown_and_revoked_api_tokens(client: FlaskClient) -> None:
    unknown = client.post(
        "/api/capture",
        json={"url": f"https://youtu.be/{VID}"},
        headers={"Authorization": "Bearer cn_unknown"},
    )
    assert unknown.status_code == 401

    token = _api_token(client)
    (record,) = client.get("/api/tokens", headers=ALICE).json
    client.delete(f"/api/tokens/{record['id']}", headers=ALICE)
    revoked = client.post(
        "/api/capture",
        json={"url": f"https://youtu.be/{VID}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert revoked.status_code == 401 and "revoked" in revoked.json["message"]


# --- api tokens -----------------------------------------------------------------------


def test_token_secret_is_shown_once_and_never_listed(client: FlaskClient) -> None:
    created = client.post("/api/tokens", json={"label": "My iPhone"}, headers=ALICE)

    assert created.status_code == 201
    secret = created.json["token"]
    assert secret.startswith("cn_")
    listed = client.get("/api/tokens", headers=ALICE)
    assert secret not in listed.get_data(as_text=True)
    assert listed.json[0]["label"] == "My iPhone"
    assert listed.json[0]["prefix"] == secret[:8]
    assert "token_hash" not in listed.json[0]


def test_tokens_are_private_and_cannot_manage_tokens(client: FlaskClient) -> None:
    secret = _api_token(client)

    assert client.get("/api/tokens", headers=BOB).json == []
    (record,) = client.get("/api/tokens", headers=ALICE).json
    assert client.delete(f"/api/tokens/{record['id']}", headers=BOB).status_code == 404
    as_token = {"Authorization": f"Bearer {secret}"}
    assert client.get("/api/tokens", headers=as_token).status_code == 401
    assert client.get("/all-video", headers=as_token).status_code == 401


# --- export ---------------------------------------------------------------------------


def test_export_video_downloads_markdown_with_seek_links(client: FlaskClient) -> None:
    _add_note(client, notes="a point")

    response = client.get(f"/api/export/{VID}", headers=ALICE)

    assert response.status_code == 200
    assert response.mimetype == "text/markdown"
    assert 'filename="a-talk.md"' in response.headers["Content-Disposition"]
    assert f"- [1:23](https://youtu.be/{VID}?t=83) a point" in response.get_data(as_text=True)


def test_export_all_and_errors(client: FlaskClient) -> None:
    assert client.get("/api/export", headers=ALICE).status_code == 404
    _add_note(client)

    everything = client.get("/api/export?since=2000-01-01", headers=ALICE)
    assert everything.status_code == 200 and "# A Talk" in everything.get_data(as_text=True)
    assert client.get("/api/export?since=yesterday", headers=ALICE).status_code == 400
    assert client.get(f"/api/export/{VID}", headers=BOB).status_code == 404
    assert client.get("/api/export").status_code == 401


# --- clipchat -------------------------------------------------------------------------


def test_clipchat_context_and_prepare(client: FlaskClient) -> None:
    _add_note(client)

    context = client.get(f"/clipchat/{VID}/context", headers=ALICE).json
    prepared = client.post(f"/clipchat/{VID}/prepare", headers=ALICE).json

    assert context["video_title"] == "A Talk"
    assert context["asset_status"] == {"transcript": "pending", "summary": "pending"}
    assert [n["video_timestamp"] for n in context["notes"]] == ["1:23"]
    assert prepared["asset_status"] == {"transcript": "ready", "summary": "ready"}


def test_clipchat_ask_and_validation(client: FlaskClient, api_world: World) -> None:
    api_world.llm.structured = '{"answer":"**yes** [0:10]"}'

    ok = client.post(f"/clipchat/{VID}/ask", json={"question": "why?"}, headers=ALICE)
    empty = client.post(f"/clipchat/{VID}/ask", json={"question": " "}, headers=ALICE)
    bad_id = client.get("/clipchat/short/context", headers=ALICE)

    assert ok.json == {"answer": "**yes** [10]"}
    assert empty.status_code == 400
    assert bad_id.status_code == 404


def test_clipchat_stream_sends_server_sent_events(client: FlaskClient, api_world: World) -> None:
    api_world.llm.structured = '{"answer":"hello there"}'

    response = client.post(f"/clipchat/{VID}/stream", json={"question": "hi"}, headers=ALICE)

    text = response.get_data(as_text=True)
    assert response.mimetype == "text/event-stream"
    assert "event: chunk" in text and 'event: done\ndata: {"answer": "hello there"}' in text


def test_clipchat_model_failure_is_a_502_with_a_friendly_message(
    client: FlaskClient, api_world: World
) -> None:
    def fail(**_: object) -> str:
        raise ExternalServiceError("boom")

    api_world.llm.complete_structured = fail  # type: ignore[method-assign,assignment]

    for path in ("ask", "stream"):
        response = client.post(f"/clipchat/{VID}/{path}", json={"question": "hi"}, headers=ALICE)
        assert response.status_code == 502
        assert response.json["message"] == "Clipchat could not answer right now"


# --- pages and routing ----------------------------------------------------------------


def test_every_page_route_serves_the_single_page_app(client: FlaskClient) -> None:
    paths = (
        "/",
        "/login",
        "/dashboard",
        "/library",
        "/profile",
        "/settings",
        "/clipchat",
        f"/clipchat/{VID}",
        f"/{VID}",
    )
    for path in paths:
        response = client.get(path)
        assert response.status_code == 200, path
        assert b"<div id=root>" in response.data, path
        assert response.headers["Cache-Control"] == "no-cache", path


def test_page_routes_explain_when_the_web_app_is_not_built(
    client: FlaskClient, app: Flask, tmp_path: Path
) -> None:
    app.config["CLIPNOTE_SPA_DIR"] = tmp_path / "missing"

    response = client.get("/dashboard")

    assert response.status_code == 503
    assert "npm run build" in response.get_data(as_text=True)


def test_unknown_browser_paths_get_the_app_404_page_and_api_clients_get_json(
    client: FlaskClient,
) -> None:
    browser = client.get("/short", headers={"Accept": "text/html"})
    api_client = client.get("/short", headers={"Accept": "application/json"})
    api_path = client.get("/api/nope", headers={"Accept": "text/html"})

    assert browser.status_code == 404 and b"<div id=root>" in browser.data
    assert api_client.status_code == 404 and "message" in api_client.json
    assert api_path.status_code == 404 and api_path.mimetype == "application/json"


def test_removed_guest_trial_endpoints_are_gone(client: FlaskClient) -> None:
    for path in ("/trial-login", "/guest-login"):
        assert client.post(path).status_code in (404, 405), path


# --- web app endpoints ----------------------------------------------------------------


def test_create_note_from_the_web_app(client: FlaskClient) -> None:
    response = client.post(
        "/api/notes",
        json={"video_id": VID, "seconds": 95, "text": "from the player", "type": "question"},
        headers=ALICE,
    )

    assert response.status_code == 201
    assert response.json["duplicate"] is False
    note = response.json["note"]
    assert (note["timestamp_seconds"], note["video_timestamp"], note["note_type"]) == (
        95,
        "1:35",
        "question",
    )
    assert (
        client.get(f"/api/videos/{VID}", headers=ALICE).json["notes"][0]["note"]
        == "from the player"
    )


def test_create_note_validates_input(client: FlaskClient) -> None:
    assert client.post("/api/notes", json={"video_id": "bad"}, headers=ALICE).status_code == 400
    bad_type = client.post("/api/notes", json={"video_id": VID, "type": "poem"}, headers=ALICE)
    assert bad_type.status_code == 400
    assert client.post("/api/notes", json={"video_id": VID}).status_code == 401


def test_video_detail_works_before_any_note_exists(client: FlaskClient) -> None:
    detail = client.get(f"/api/videos/{VID}", headers=ALICE).json

    assert detail["video"]["id"] == VID
    assert detail["video"]["title"] == "Fetched Title"
    assert (detail["notes"], detail["fav"], detail["label"]) == ([], False, None)
    assert client.get("/api/videos/short", headers=ALICE).status_code == 404


def test_video_detail_includes_label_notes_and_favourite(client: FlaskClient) -> None:
    _add_note(client)
    client.post("/label", json={"label_name": "ml"}, headers=ALICE)
    client.post("/video-label", json={"label_name": "ml", "video_id": VID}, headers=ALICE)
    client.post("/fav-note", json={"video_id": VID}, headers=ALICE)

    detail = client.get(f"/api/videos/{VID}", headers=ALICE).json

    assert detail["label"] == "ml" and detail["fav"] is True
    assert detail["video"]["title"] == "A Talk"
    assert [n["note"] for n in detail["notes"]] == ["first note"]


def test_remove_video_deletes_only_my_notes_label_and_favourite(client: FlaskClient) -> None:
    _add_note(client, headers=ALICE)
    _add_note(client, headers=BOB)
    client.post("/label", json={"label_name": "ml"}, headers=ALICE)
    client.post("/video-label", json={"label_name": "ml", "video_id": VID}, headers=ALICE)
    client.post("/fav-note", json={"video_id": VID}, headers=ALICE)

    assert client.delete(f"/api/videos/{VID}", headers=ALICE).status_code == 200

    assert client.get(f"/api/videos/{VID}", headers=ALICE).json["notes"] == []
    assert client.get(f"/{VID}/label", headers=ALICE).json == {"label": None}
    assert client.get(f"/api/videos/{VID}", headers=ALICE).json["fav"] is False
    assert len(client.get(f"/api/videos/{VID}", headers=BOB).json["notes"]) == 1
    assert client.delete(f"/api/videos/{VID}", headers=ALICE).status_code == 404


def test_library_stats(client: FlaskClient) -> None:
    assert client.get("/api/stats", headers=ALICE).json == {
        "videos": 0,
        "notes": 0,
        "notes_this_week": 0,
        "favourites": 0,
        "pending": 0,
    }
    _add_note(client)
    client.post("/fav-note", json={"video_id": VID}, headers=ALICE)

    stats = client.get("/api/stats", headers=ALICE).json

    assert (stats["videos"], stats["notes"], stats["favourites"], stats["pending"]) == (1, 1, 1, 1)
    assert client.get("/api/stats").status_code == 401
