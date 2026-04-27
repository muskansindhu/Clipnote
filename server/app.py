import json
import uuid
import psycopg
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from flask import (
    Flask,
    Response,
    request,
    jsonify,
    render_template,
    url_for,
    make_response,
    redirect,
    stream_with_context,
)
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from config import (
    SUPABASE_CONNECTION_STRING,
    S3_BUCKET,
    JWT_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_DISCOVERY_URL,
)
from auth_utils import (
    derive_username_from_email,
    issue_access_token,
    issue_guest_access_token,
    normalise_email,
    normalise_username,
)
from exceptions import TrialClipchatLimitError
from clipchat import (
    answer_clipchat_question,
    _is_guest_user,
    _get_clipchat_context,
    _ensure_clipchat_assets,
    _build_clipchat_asset_status,
    _reserve_guest_clipchat_query_slot,
    _build_guest_clipchat_limit_response,
    _attach_guest_trial_headers,
    _hydrate_clipchat_metadata,
    _build_guest_trial_details,
    _stream_clipchat_payload,
)
from utils import (
    get_video_transcription_apify,
    summarize_video,
    generate_video_summary,
    extract_video_id,
    fetch_youtube_video_metadata,
    put_object_to_s3,
    get_object_from_s3,
    extract_transcript_snippet,
    generate_ai_note,
    hms_to_seconds,
    require_auth,
    require_registered_user,
)
from authlib.integrations.flask_client import OAuth

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app, expose_headers=["X-Clipnote-Access-Token", "X-Clipnote-Trial-Videos-Used", "X-Clipnote-Trial-Video-Limit", "X-Clipnote-Trial-Queries-Used", "X-Clipnote-Trial-Queries-Remaining"])



oauth = OAuth(app)
app.secret_key = JWT_SECRET
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url=GOOGLE_DISCOVERY_URL,
    client_kwargs={"scope": "openid email profile"},
)

def _username_exists(
    cur: psycopg.Cursor[Any], username: str, *, exclude_user_id: str | None = None
) -> bool:
    if exclude_user_id is None:
        cur.execute("SELECT 1 FROM users WHERE username = %s", (username,))
    else:
        cur.execute(
            "SELECT 1 FROM users WHERE username = %s AND id <> %s",
            (username, exclude_user_id),
        )
    return cur.fetchone() is not None


def _build_available_username(cur: psycopg.Cursor[Any], email: str) -> str:
    base_username = derive_username_from_email(email)
    candidate = base_username
    suffix = 1

    while _username_exists(cur, candidate):
        suffix += 1
        candidate = f"{base_username}{suffix}"

    return candidate


@app.route("/", methods=["GET"])
def home():
    return render_template("home.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    data = request.get_json(silent=True) or {}
    email = normalise_email(data.get("email"))
    password = str(data.get("password") or "")

    if not email or not password:
        return jsonify({"message": "Email and password required"}), 400

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, email, password_hash, google_sub
                FROM users
                WHERE lower(email) = %s
                """,
                (email,),
            )
            user_row = cur.fetchone()

            if not user_row:
                return jsonify({"message": "Invalid credentials"}), 401

            password_hash = user_row[3]
            google_sub = user_row[4]

            if not password_hash:
                if google_sub:
                    return jsonify(
                        {
                            "message": "This account uses Google sign-in. Use Google login or add a password first."
                        }
                    ), 401
                return jsonify({"message": "Invalid credentials"}), 401

            if not check_password_hash(password_hash, password):
                return jsonify({"message": "Invalid credentials"}), 401

    token = issue_access_token(
        user_id=str(user_row[0]),
        username=str(user_row[1]),
        email=str(user_row[2]),
        jwt_secret=JWT_SECRET,
    )
    return jsonify(access_token=token), 200


@app.route("/login/google")
def login_google():
    redirect_uri = url_for("auth_google_callback", _external=True, _scheme="https")
    return oauth.google.authorize_redirect(redirect_uri)


@app.route("/auth/google/callback")
def auth_google_callback():
    token = oauth.google.authorize_access_token()
    user_info = token.get("userinfo") or oauth.google.parse_id_token(token)
    if not user_info:
        return jsonify({"message": "Google authentication failed"}), 401

    email = normalise_email(user_info.get("email"))
    sub = user_info.get("sub")
    if not email or not sub:
        return jsonify({"message": "Google account info missing"}), 400

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, email
                FROM users
                WHERE google_sub = %s
                """,
                (sub,),
            )
            user_row = cur.fetchone()
            if not user_row:
                cur.execute(
                    """
                    SELECT id, username, email
                    FROM users
                    WHERE lower(email) = %s
                    """,
                    (email,),
                )
                user_row = cur.fetchone()
                if user_row:
                    cur.execute(
                        """
                        UPDATE users
                        SET google_sub = %s
                        WHERE id = %s
                        """,
                        (sub, user_row[0]),
                    )
                else:
                    username = _build_available_username(cur, email)
                    cur.execute(
                        """
                        INSERT INTO users (username, email, password_hash, google_sub)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id, username, email
                        """,
                        (username, email, None, sub),
                    )
                    user_row = cur.fetchone()
                conn.commit()
            user_id = user_row[0]
            username = user_row[1]
            email = user_row[2]

    jwt_token = issue_access_token(
        user_id=str(user_id),
        username=str(username),
        email=str(email),
        jwt_secret=JWT_SECRET,
        picture=user_info.get("picture"),
    )

    if request.args.get("api") == "1":
        return jsonify(access_token=jwt_token), 200
    else:
        response = make_response(redirect("/dashboard"))
        response.set_cookie("temp_access_token", jwt_token, max_age=60, path="/")
        return response


@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    username = normalise_username(data.get("username"))
    email = normalise_email(data.get("email"))
    password = str(data.get("password") or "")

    if not username or not email or not password:
        return jsonify({"message": "Username, email, and password required"}), 400

    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

    hashed_password = generate_password_hash(password)
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, email, password_hash
                FROM users
                WHERE lower(email) = %s
                """,
                (email,),
            )
            user_row = cur.fetchone()

            if user_row:
                if user_row[3]:
                    return jsonify({"message": "Email already exists"}), 409

                if _username_exists(cur, username, exclude_user_id=str(user_row[0])):
                    return jsonify({"message": "Username already exists"}), 409

                cur.execute(
                    """
                    UPDATE users
                    SET username = %s, email = %s, password_hash = %s
                    WHERE id = %s
                    """,
                    (username, email, hashed_password, user_row[0]),
                )
                user_id = user_row[0]
            else:
                if _username_exists(cur, username):
                    return jsonify({"message": "Username already exists"}), 409

                cur.execute(
                    """
                    INSERT INTO users (username, email, password_hash)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (username, email, hashed_password),
                )
                user_id = cur.fetchone()[0]
            conn.commit()

    token = issue_access_token(
        user_id=str(user_id),
        username=username,
        email=email,
        jwt_secret=JWT_SECRET,
    )
    return jsonify(access_token=token), 201


@app.route("/trial-login", methods=["POST"])
@app.route("/guest-login", methods=["POST"])
def guest_login():
    import jwt
    import hashlib
    existing_token = request.cookies.get("clipnote_guest_token")
    
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    ip = ip.split(",")[0].strip()
    ua = request.headers.get("User-Agent", "")
    al = request.headers.get("Accept-Language", "")
    raw = f"{ip}-{ua}-{al}"
    hash_hex = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    guest_id = f"guest_{hash_hex[:16]}"
    
    clipchat_usage = {}
    trial_start = None
    
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT clipchat_usage FROM guest_usage WHERE guest_id = %s", (guest_id,))
            row = cur.fetchone()
            if row:
                clipchat_usage = row[0]
            else:
                cur.execute("INSERT INTO guest_usage (guest_id) VALUES (%s) ON CONFLICT DO NOTHING", (guest_id,))
                conn.commit()
    
    if existing_token:
        try:
            payload = jwt.decode(
                existing_token, 
                JWT_SECRET, 
                algorithms=["HS256"], 
                options={"verify_exp": False}
            )
            if payload.get("account_tier") == "clipchat_trial":
                trial_start = payload.get("trial_start")
        except Exception:
            pass

    token = issue_guest_access_token(
        guest_id=guest_id,
        jwt_secret=JWT_SECRET,
        clipchat_usage=clipchat_usage,
        trial_start=trial_start
    )
    
    response = jsonify(access_token=token)
    response.set_cookie(
        "clipnote_guest_token", 
        token, 
        max_age=365 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="Strict"
    )
    return response, 200


@app.route("/dashboard", methods=["GET"])
def dashboard():
    return render_template("dashboard.html")


@app.route("/profile", methods=["GET"])
def profile():
    return render_template("profile.html")


@app.route("/clipchat/<video_yt_id>", methods=["GET"])
def get_clipchat_page(video_yt_id: str):
    return render_template("clipchat.html")


@app.route("/clipchat", methods=["GET"])
def get_clipchat_landing_page():
    return render_template("clipchat.html")


@app.route("/clipchat/<video_yt_id>/context", methods=["GET"])
@require_auth
def get_clipchat_context(video_yt_id: str):
    clipchat_context = _get_clipchat_context(video_yt_id, request.user)
    if not clipchat_context:
        return jsonify({"message": "Video not found"}), 404

    clipchat_context = _hydrate_clipchat_metadata(
        video_yt_id=video_yt_id,
        clipchat_context=clipchat_context,
    )
    transcript = get_object_from_s3(video_yt_id, S3_BUCKET)
    clipchat_context["asset_status"] = _build_clipchat_asset_status(
        clipchat_context=clipchat_context,
        transcript=transcript,
    )

    if _is_guest_user(request.user):
        clipchat_context["trial"] = _build_guest_trial_details(
            request.auth_payload, video_yt_id=video_yt_id
        )

    return jsonify(clipchat_context), 200


@app.route("/clipchat/<video_yt_id>/prepare", methods=["POST"])
@require_auth
def prepare_clipchat_context(video_yt_id: str):
    clipchat_context = _get_clipchat_context(video_yt_id, request.user)
    if not clipchat_context:
        return jsonify({"message": "Video not found"}), 404

    clipchat_context = _hydrate_clipchat_metadata(
        video_yt_id=video_yt_id,
        clipchat_context=clipchat_context,
    )

    transcript, asset_status = _ensure_clipchat_assets(
        video_yt_id=video_yt_id,
        clipchat_context=clipchat_context,
    )
    if transcript is None:
        return jsonify({"message": "Transcript not available for this video"}), 404

    clipchat_context["asset_status"] = asset_status
    if _is_guest_user(request.user):
        clipchat_context["trial"] = _build_guest_trial_details(
            request.auth_payload, video_yt_id=video_yt_id
        )

    return jsonify(clipchat_context), 200


@app.route("/clipchat/<video_yt_id>/ask", methods=["POST"])
@require_auth
def ask_clipchat(video_yt_id: str):
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()

    if not question:
        return jsonify({"message": "Question is required"}), 400

    clipchat_context = _get_clipchat_context(video_yt_id, request.user)
    if not clipchat_context:
        return jsonify({"message": "Video not found"}), 404

    refreshed_token: str | None = None
    updated_guest_payload = request.auth_payload
    if _is_guest_user(request.user):
        try:
            refreshed_token, updated_usage = _reserve_guest_clipchat_query_slot(
                video_yt_id=video_yt_id,
                auth_payload=request.auth_payload,
            )
        except TrialClipchatLimitError as exc:
            return _build_guest_clipchat_limit_response(
                auth_payload=request.auth_payload,
                message=str(exc),
                video_yt_id=video_yt_id,
            )
        updated_guest_payload = dict(request.auth_payload)
        updated_guest_payload["clipchat_usage"] = updated_usage

    transcript, _ = _ensure_clipchat_assets(
        video_yt_id=video_yt_id,
        clipchat_context=clipchat_context,
    )
    if transcript is None:
        return jsonify({"message": "Transcript not available for this video"}), 404

    try:
        clipchat_response = answer_clipchat_question(
            video_title=str(clipchat_context["video_title"] or "Untitled Video"),
            video_summary=clipchat_context["video_summary"],
            transcript=transcript,
            notes=clipchat_context["notes"],
            question=question,
        )
    except Exception:
        app.logger.exception("Clipchat ask failed for video %s", video_yt_id)
        return jsonify({"message": "Clipchat could not answer right now"}), 502

    response = jsonify(clipchat_response)
    if _is_guest_user(request.user):
        response = _attach_guest_trial_headers(
            response,
            refreshed_token=refreshed_token,
            auth_payload=updated_guest_payload,
            video_yt_id=video_yt_id,
        )
    return response, 200


@app.route("/clipchat/<video_yt_id>/stream", methods=["POST"])
@require_auth
def stream_clipchat(video_yt_id: str):
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()

    if not question:
        return jsonify({"message": "Question is required"}), 400

    clipchat_context = _get_clipchat_context(video_yt_id, request.user)
    if not clipchat_context:
        return jsonify({"message": "Video not found"}), 404

    refreshed_token: str | None = None
    updated_guest_payload = request.auth_payload
    if _is_guest_user(request.user):
        try:
            refreshed_token, updated_usage = _reserve_guest_clipchat_query_slot(
                video_yt_id=video_yt_id,
                auth_payload=request.auth_payload,
            )
        except TrialClipchatLimitError as exc:
            return _build_guest_clipchat_limit_response(
                auth_payload=request.auth_payload,
                message=str(exc),
                video_yt_id=video_yt_id,
            )
        updated_guest_payload = dict(request.auth_payload)
        updated_guest_payload["clipchat_usage"] = updated_usage

    transcript, _ = _ensure_clipchat_assets(
        video_yt_id=video_yt_id,
        clipchat_context=clipchat_context,
    )
    if transcript is None:
        return jsonify({"message": "Transcript not available for this video"}), 404

    try:
        clipchat_response = answer_clipchat_question(
            video_title=str(clipchat_context["video_title"] or "Untitled Video"),
            video_summary=clipchat_context["video_summary"],
            transcript=transcript,
            notes=clipchat_context["notes"],
            question=question,
        )
    except Exception:
        app.logger.exception("Clipchat stream failed for video %s", video_yt_id)
        return jsonify({"message": "Clipchat could not answer right now"}), 502

    response = Response(
        stream_with_context(_stream_clipchat_payload(clipchat_response)),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
    if _is_guest_user(request.user):
        response = _attach_guest_trial_headers(
            response,
            refreshed_token=refreshed_token,
            auth_payload=updated_guest_payload,
            video_yt_id=video_yt_id,
        )
    return response


@app.route("/user-status", methods=["GET"])
@require_auth
def get_user_status():
    if not request.user.startswith("guest_"):
        return jsonify({"is_guest": False, "is_trial": False}), 200

    return jsonify(
        {
            "is_guest": True,
            "is_trial": True,
            "trial": _build_guest_trial_details(request.auth_payload),
        }
    ), 200


@app.route("/<video_yt_id>")
def get_note_page(video_yt_id):
    return render_template("note.html")


@app.route("/all-video", methods=["GET"])
@require_registered_user
def get_all_notes():
    page = request.args.get("page", 1, type=int)
    limit = 10
    offset = (page - 1) * limit

    search = request.args.get("search", "").strip()
    labels_param = request.args.get("labels", "").strip()
    labels = [label.strip() for label in labels_param.split(",") if label.strip()]
    sort = request.args.get("sort", "recent")
    start_date = request.args.get("start")
    end_date = request.args.get("end")

    all_notes = []
    has_next = False

    where_clauses = ["n.user_id = %s"]
    params = [request.user]

    if search:
        where_clauses.append("v.video_title ILIKE %s")
        params.append(f"%{search}%")

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
            where_clauses.append("n.created_at >= %s")
            params.append(start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date).replace(
                tzinfo=timezone.utc
            ) + timedelta(days=1)
            where_clauses.append("n.created_at < %s")
            params.append(end_dt)
        except ValueError:
            pass

    if labels:
        where_clauses.append(
            """
            EXISTS (
                SELECT 1
                FROM video_label vl
                JOIN label l ON l.id = vl.label_id
                WHERE vl.yt_video_id = v.id
                  AND l.user_id = %s
                  AND l.label_name = ANY(%s)
            )
            """
        )
        params.append(request.user)
        params.append(labels)

    order_by = "last_note_date DESC"
    if sort == "title":
        order_by = "LOWER(v.video_title) ASC"

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            query = """
                SELECT v.id, v.video_url, v.video_title, v.fav, MAX(n.created_at) as last_note_date
                FROM video v
                JOIN notes n ON v.id = n.video_id
                WHERE {where_clause}
                GROUP BY v.id, v.video_url, v.video_title, v.fav
                ORDER BY {order_by}
                LIMIT %s OFFSET %s
            """
            formatted_query = query.format(
                where_clause=" AND ".join(where_clauses), order_by=order_by
            )
            cur.execute(formatted_query, (*params, limit + 1, offset))
            notes = cur.fetchall()

            if len(notes) > limit:
                has_next = True
                notes = notes[:limit]

        for note in notes:
            all_notes.append(
                {
                    "id": note[0],
                    "video_url": note[1],
                    "video_title": note[2],
                    "fav": note[3],
                }
            )

    return jsonify({"videos": all_notes, "has_next": has_next})


@app.route("/note/<video_yt_id>", methods=["GET"])
@require_registered_user
def get_note(video_yt_id):
    video_notes = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, video_url, video_title, fav, video_summary FROM video WHERE id = %s",
                (video_yt_id,),
            )
            video = cur.fetchone()

            if not video:
                return jsonify({"message": "Video not found"}), 404

            cur.execute(
                "SELECT id, created_at, video_timestamp, note, note_source FROM notes WHERE video_id = %s AND user_id = %s",
                (video_yt_id, request.user),
            )
            notes = cur.fetchall()

            for note in notes:
                video_notes.append(
                    {
                        "id": note[0],
                        "created_at": note[1],
                        "video_id": video[0],
                        "video_url": video[1],
                        "video_title": video[2],
                        "video_timestamp": note[2],
                        "note": note[3],
                        "fav": video[3],
                        "note_source": note[4],
                        "video_summary": video[4],
                    }
                )

    return jsonify(video_notes), 200


@app.route("/add-notes", methods=["POST"])
@require_registered_user
def add_notes():
    raw_body = request.get_data(as_text=True)
    data = json.loads(raw_body)
    note_source = "user"

    video_yt_id = extract_video_id(data["videoUrl"])
    note_text = data["notes"].strip()
    timestamp = data["currentTimeStamp"]
    center_time_sec = hms_to_seconds(timestamp)

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM video WHERE id = %s", (video_yt_id,))
            video_exists = cur.fetchone() is not None

            if not video_exists:
                transcript = get_video_transcription_apify(video_yt_id)
                uploaded = put_object_to_s3(video_yt_id, S3_BUCKET, transcript)

                video_summary = None
                if transcript and isinstance(transcript, list):
                    compiled_transcript = " ".join(
                        snippet.get("text", "") for snippet in transcript if isinstance(snippet, dict)
                    )
                    if compiled_transcript.strip():
                        video_summary = generate_video_summary(compiled_transcript)

                if uploaded:
                    cur.execute(
                        """
                        INSERT INTO video (id, video_url, video_title, video_summary, created_at, user_id)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (
                            video_yt_id,
                            data["videoUrl"],
                            data["videoTitle"],
                            video_summary,
                            datetime.now(timezone.utc),
                            request.user,
                        ),
                    )
                else:
                    return jsonify({"error": "Failed to upload transcript to S3"}), 500

            if not note_text:
                note_source = "ai"
                transcript = get_object_from_s3(video_yt_id, S3_BUCKET)
                transcript_chunk = extract_transcript_snippet(
                    transcript, center_time_sec
                )
                note_text = generate_ai_note(transcript_chunk)

            cur.execute(
                "INSERT INTO notes (video_timestamp, note, video_id, note_source, user_id) VALUES (%s, %s, %s, %s, %s)",
                (
                    data["currentTimeStamp"],
                    note_text,
                    video_yt_id,
                    note_source,
                    request.user,
                ),
            )
            conn.commit()

    return jsonify({"message": "Note added successfully"}), 201


@app.route("/summarize", methods=["POST"])
@require_registered_user
def get_video_summary():
    raw_body = request.get_data(as_text=True)
    data = json.loads(raw_body)
    video_id = data["video_url"].split("v=")[1].split("&")[0]
    timestamped_transcript = get_object_from_s3(video_id, S3_BUCKET)
    compiled_transcript = " ".join(
        snippet["text"] for snippet in timestamped_transcript if "text" in snippet
    )
    summary = summarize_video(compiled_transcript)
    return jsonify({"message": summary}), 200


@app.route("/fav-note", methods=["POST"])
@require_registered_user
def mark_note_as_fav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE video SET fav = TRUE WHERE video_title = %s", (video_title,)
            )
        conn.commit()

    return {"message": "Note marked as favourite."}, 200


@app.route("/unfav-note", methods=["POST"])
@require_registered_user
def mark_note_as_unfav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE video SET fav = FALSE WHERE video_title = %s", (video_title,)
            )
        conn.commit()

    return {"message": "Note marked as favourite."}, 200


@app.route("/labels", methods=["GET"])
@require_registered_user
def get_all_labels():
    all_labels = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM label WHERE user_id = %s", (request.user,))
            labels = cur.fetchall()

        for label in labels:
            all_labels.append({"id": label[0], "label_name": label[1]})

    return all_labels


@app.route("/label", methods=["POST"])
@require_registered_user
def add_new_label():

    data = request.json
    label_name = data["label_name"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO label (label_name, user_id) VALUES (%s, %s)",
                (label_name, request.user),
            )

    return jsonify({"message": "Label added successfully"}), 201


@app.route("/label", methods=["PATCH"])
@require_registered_user
def update_label():
    data = request.json
    label_id = data["label_id"]
    new_name = data["new_name"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE label SET label_name = %s WHERE id = %s AND user_id = %s",
                (new_name, label_id, request.user),
            )
        conn.commit()

    return jsonify({"message": "Label updated successfully"}), 200


@app.route("/label", methods=["DELETE"])
@require_registered_user
def delete_label():
    data = request.json
    label_id = data["label_id"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM video_label WHERE label_id = %s", (label_id,))
            cur.execute(
                "DELETE FROM label WHERE id = %s AND user_id = %s",
                (label_id, request.user),
            )
        conn.commit()

    return jsonify({"message": "Label deleted successfully"}), 200


@app.route("/<label>/note", methods=["GET"])
@require_registered_user
def filter_note_by_label(label):
    filtered_videos = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM label WHERE label_name = %s AND user_id = %s",
                (label, request.user),
            )
            label_row = cur.fetchone()

            if not label_row:
                return jsonify({"error": "Label not found"}), 404

            label_id = label_row[0]

            cur.execute(
                "SELECT yt_video_id FROM video_label WHERE label_id = %s", (label_id,)
            )
            video_rows = cur.fetchall()

            for video_row in video_rows:
                video_id = video_row[0]
                cur.execute(
                    "SELECT id, video_url, video_title, fav FROM video WHERE id = %s",
                    (video_id,),
                )
                video = cur.fetchone()

                if video:
                    filtered_videos.append(
                        {
                            "video_id": video[0],
                            "video_url": video[1],
                            "video_title": video[2],
                            "fav": video[3],
                        }
                    )

    return jsonify(filtered_videos), 200


@app.route("/<video_yt_id>/label", methods=["GET"])
@require_registered_user
def get_video_label(video_yt_id):
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT label_id FROM video_label WHERE yt_video_id = %s",
                (video_yt_id,),
            )
            result = cur.fetchone()
            if not result:
                return {"label": None}, 200

            label_id = result[0]

            cur.execute("SELECT label_name FROM label WHERE id = %s", (label_id,))
            label_result = cur.fetchone()
            label_name = label_result[0] if label_result else None

    return {"label": label_name}, 200


@app.route("/video-label", methods=["POST"])
@require_registered_user
def add_video_label():
    data = request.json
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM label WHERE label_name = %s", (data["label_name"],)
            )
            label_row = cur.fetchone()

            if not label_row:
                return jsonify({"error": "Label not found"}), 404

            label_id = label_row[0]

            cur.execute(
                "INSERT INTO video_label (label_id, yt_video_id) VALUES (%s, %s)",
                (
                    label_id,
                    data["video_id"],
                ),
            )
            conn.commit()

    return jsonify({"message": "Video Label added successfully"}), 201


@app.route("/video-label", methods=["DELETE"])
@require_registered_user
def remove_video_label():
    data = request.json
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM video_label WHERE yt_video_id = %s", (data["video_id"],)
            )
            conn.commit()
    return jsonify({"message": "Video label removed successfully"}), 200


@app.route("/<video_yt_id>", methods=["PATCH"])
@require_registered_user
def update_note(video_yt_id):
    raw_body = request.get_data(as_text=True)
    data = json.loads(raw_body)
    note_text = data["notes"].strip()
    timestamp = data["timestamp"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                    UPDATE notes
                    SET note = %s
                    WHERE video_id = %s AND video_timestamp = %s AND user_id = %s
                """,
                (note_text, video_yt_id, timestamp, request.user),
            )
            conn.commit()

    return jsonify({"status": "success"}), 200


@app.route("/<video_yt_id>", methods=["DELETE"])
@require_registered_user
def delete_note(video_yt_id):
    raw_body = request.get_data(as_text=True)
    data = json.loads(raw_body)
    timestamp = data["timestamp"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                    DELETE FROM notes
                    WHERE video_id = %s AND video_timestamp = %s AND user_id = %s
                """,
                (video_yt_id, timestamp, request.user),
            )
            conn.commit()

    return jsonify({"status": "success"}), 200


@app.route("/change-password", methods=["POST"])
@require_registered_user
def change_password():
    data = request.get_json() or {}
    current_password = str(data.get("current_password") or "")
    new_password = str(data.get("new_password") or "")

    if not new_password or len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters."}), 400

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (request.user,))
            row = cur.fetchone()
            if not row:
                return jsonify({"message": "User not found."}), 404

            password_hash = row[0]

            if not password_hash:
                return jsonify({"message": "This account uses Google sign-in. Password changes are not available."}), 400

            if not current_password:
                return jsonify({"message": "Current password is required."}), 400

            if not check_password_hash(password_hash, current_password):
                return jsonify({"message": "Current password is incorrect."}), 401

            cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (generate_password_hash(new_password), request.user),
            )
            conn.commit()

    return jsonify({"message": "Password updated successfully."}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
