import json
import psycopg
import jwt
from datetime import datetime, timedelta, timezone

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

from config import SUPABASE_CONNECTION_STRING, S3_BUCKET, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
from utils import (
    get_video_transcription_apify,
    summarize_video,
    extract_video_id,
    put_object_to_s3,
    get_object_from_s3,
    extract_transcript_snippet,
    generate_ai_note,
    hms_to_seconds,
    require_auth
)

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

@app.route("/", methods=["GET"])
def home():
    return render_template("home.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if username != ADMIN_USERNAME:
        return jsonify({"message": "Invalid credentials"}), 401

    if password != ADMIN_PASSWORD:
        return jsonify({"message": "Invalid credentials"}), 401

    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=15)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return jsonify(access_token=token), 200

@app.route("/dashboard", methods=["GET"])
def dashboard():
    return render_template("dashboard.html")

@app.route("/<video_yt_id>")
def get_note_page(video_yt_id):
    return render_template("note.html")

@app.route("/all-video", methods=["GET"])
@require_auth
def get_all_notes():
    page = request.args.get("page", 1, type=int)
    limit = 10
    offset = (page - 1) * limit
    
    all_notes = []
    has_next = False

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            # Fetch one extra to check if there are more
            cur.execute("SELECT * FROM video ORDER BY created_at DESC LIMIT %s OFFSET %s", (limit + 1, offset))
            notes = cur.fetchall()
            
            if len(notes) > limit:
                has_next = True
                notes = notes[:limit]
        
        for note in notes:
            all_notes.append({
                "id" : note[0],
                "video_url" : note[1],
                "video_title" : note[2],
                "fav": note[3]
            })

    return jsonify({
        "videos": all_notes,
        "has_next": has_next
    })

@app.route("/note/<video_yt_id>", methods=["GET"])
@require_auth
def get_note(video_yt_id):
    video_notes = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, video_url, video_title, fav FROM video WHERE id = %s", (video_yt_id,))
            video = cur.fetchone()

            if not video:
                return jsonify({"message": "Video not found"}), 404

            cur.execute("SELECT id, created_at, video_timestamp, note, note_source FROM notes WHERE video_id = %s", (video_yt_id,))
            notes = cur.fetchall()

            for note in notes:
                video_notes.append({
                    "id": note[0],
                    "created_at": note[1],
                    "video_id": video[0],
                    "video_url": video[1],
                    "video_title": video[2],
                    "video_timestamp": note[2],
                    "note": note[3],
                    "fav": video[3],
                    "note_source": note[4]
                })

    return jsonify(video_notes), 200

@app.route("/add-notes", methods=["POST"])
@require_auth
def add_notes():
    raw_body = request.get_data(as_text=True)     # to prevent cors options method call
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
                uploaded = put_object_to_s3(video_yt_id, S3_BUCKET , transcript)

                if uploaded:
                    cur.execute(
                        """
                        INSERT INTO video (id, video_url, video_title, created_at)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (
                            video_yt_id,
                            data["videoUrl"],
                            data["videoTitle"],
                            datetime.now(timezone.utc)
                        )
                    )
                else:
                    return jsonify({"error": "Failed to upload transcript to S3"}), 500
            
            if not note_text:
                note_source = "ai"
                transcript = get_object_from_s3(video_yt_id, S3_BUCKET)
                transcript_chunk = extract_transcript_snippet(transcript, center_time_sec)
                note_text = generate_ai_note(transcript_chunk)

            cur.execute(
                "INSERT INTO notes (video_timestamp, note, video_id, note_source) VALUES (%s, %s, %s, %s)",
                (data["currentTimeStamp"], note_text, video_yt_id, note_source)
            )
            conn.commit()

    return jsonify({"message": "Note added successfully"}), 201

@app.route("/summarize", methods=["POST"])
@require_auth
def get_video_summary():
    raw_body = request.get_data(as_text=True) 
    data = json.loads(raw_body)
    video_id = data["video_url"].split("v=")[1].split("&")[0]
    timestamped_transcript = get_object_from_s3(video_id, S3_BUCKET)
    compiled_transcript = " ".join(snippet["text"] for snippet in timestamped_transcript if "text" in snippet)
    summary = summarize_video(compiled_transcript)
    return jsonify({"message": summary}), 200

@app.route("/fav-note", methods=["POST"])
@require_auth
def mark_note_as_fav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE video SET fav = TRUE WHERE video_title = %s", (video_title,))
        conn.commit()

    return {"message": "Note marked as favourite."}, 200

@app.route("/unfav-note", methods=["POST"])
@require_auth
def mark_note_as_unfav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE video SET fav = FALSE WHERE video_title = %s", (video_title,))
        conn.commit()

    return {"message": "Note marked as favourite."}, 200

@app.route("/labels", methods=["GET"])
@require_auth
def get_all_labels():
    all_labels = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM label")
            labels = cur.fetchall()
        
        for label in labels:
            all_labels.append({
                "id" : label[0],
                "label_name" : label[1]
            })

    return all_labels

@app.route("/label", methods=["POST"])
@require_auth
def add_new_label():

    data = request.json
    label_name = data["label_name"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO label (label_name) VALUES (%s)",
            (label_name,))
        
    return jsonify({"message":"Label added successfully"}), 201

@app.route("/<label>/note", methods=["GET"])
@require_auth
def filter_note_by_label(label):
    filtered_videos = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM label WHERE label_name = %s", (label,))
            label_row = cur.fetchone()

            if not label_row:
                return jsonify({"error": "Label not found"}), 404

            label_id = label_row[0]

            cur.execute("SELECT yt_video_id FROM video_label WHERE label_id = %s", (label_id,))
            video_rows = cur.fetchall()

            for video_row in video_rows:
                video_id = video_row[0]
                cur.execute("SELECT id, video_url, video_title, fav FROM video WHERE id = %s", (video_id,))
                video = cur.fetchone()

                if video:
                    filtered_videos.append({
                        "video_id": video[0],
                        "video_url": video[1],
                        "video_title": video[2],
                        "fav": video[3]
                    })

    return jsonify(filtered_videos), 200

@app.route("/<video_yt_id>/label", methods=['GET'])
@require_auth
def get_video_label(video_yt_id):
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT label_id FROM video_label WHERE yt_video_id = %s", (video_yt_id,))
            result = cur.fetchone()
            if not result:
                return {"label": None}, 200

            label_id = result[0]

            cur.execute("SELECT label_name FROM label WHERE id = %s", (label_id,))
            label_result = cur.fetchone()
            label_name = label_result[0] if label_result else None

    return {"label": label_name}, 200

@app.route("/video-label", methods=["POST"])
@require_auth
def add_video_label():
    data = request.json
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM label WHERE label_name = %s", (data["label_name"],))
            label_row = cur.fetchone()

            if not label_row:
                return jsonify({"error": "Label not found"}), 404

            label_id = label_row[0]

            cur.execute("INSERT INTO video_label (label_id, yt_video_id) VALUES (%s, %s)", (label_id, data["video_id"],))
            conn.commit()

        
    return jsonify({"message": "Video Label added successfully"}), 201

@app.route("/video-label", methods=["DELETE"])
@require_auth
def remove_video_label():
    data = request.json
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM video_label WHERE yt_video_id = %s", (data["video_id"],))
            conn.commit()
    return jsonify({"message": "Video label removed successfully"}), 200

@app.route("/<video_yt_id>", methods=["PATCH"])
@require_auth
def update_note(video_yt_id):
    raw_body = request.get_data(as_text=True)  
    data = json.loads(raw_body)
    note_text = data["notes"].strip()
    timestamp = data["timestamp"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE notes
                    SET note = %s
                    WHERE video_id = %s AND video_timestamp = %s
                """, (note_text, video_yt_id, timestamp))
                conn.commit()

    return jsonify({"status": "success"}), 200

@app.route("/<video_yt_id>", methods=["DELETE"])
@require_auth
def delete_note(video_yt_id):
    raw_body = request.get_data(as_text=True)  
    data = json.loads(raw_body)
    timestamp = data["timestamp"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM notes
                    WHERE video_id = %s AND video_timestamp = %s
                """, (video_yt_id, timestamp))
                conn.commit()

    return jsonify({"status": "success"}), 200

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001, debug=True)
