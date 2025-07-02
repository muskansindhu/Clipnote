from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import psycopg

from config import SUPABASE_CONNECTION_STRING, S3_BUCKET
from utils import get_video_transcription_apify, summarize_video, extract_video_id, put_object_to_s3, get_object_from_s3

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return render_template("home.html")

@app.route("/all-video", methods=["GET"])
def get_all_notes():
    all_notes = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM video")
            notes = cur.fetchall()
        
        for note in notes:
            all_notes.append({
                "id" : note[0],
                "video_url" : note[1],
                "video_title" : note[2],
                "fav": note[3]
            })

    return all_notes

@app.route("/note/<video_yt_id>", methods=["GET"])
def get_note(video_yt_id):
    video_notes = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, video_url, video_title, fav FROM video WHERE id = %s", (video_yt_id,))
            video = cur.fetchone()

            if not video:
                return jsonify({"message": "Video not found"}), 404

            cur.execute("SELECT id, created_at, video_timestamp, note FROM notes WHERE video_id = %s", (video_yt_id,))
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
                    "fav": video[3]
                })

    return jsonify(video_notes), 200

@app.route("/add-notes", methods=["POST"])
def add_notes():
    data = request.json
    video_yt_id = extract_video_id(data["videoUrl"])

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
                        INSERT INTO video (id, video_url, video_title)
                        VALUES (%s, %s, %s)
                        """,
                        (video_yt_id, data["videoUrl"], data["videoTitle"])
                    )
                else:
                    return jsonify({"error": "Failed to upload transcript to S3"}), 500
                
            cur.execute(
                "INSERT INTO notes (video_timestamp, note, video_id) VALUES (%s, %s, %s)",
                (data["currentTimeStamp"], data["notes"], video_yt_id)
            )
            conn.commit()

    return jsonify({"message": "Note added successfully"}), 201

@app.route("/summarize", methods=["POST"])
def get_video_summary():
    data = request.json
    video_id = data["video_url"].split("=")[1]
    timestamped_transcript = get_object_from_s3(video_id, S3_BUCKET)
    compiled_transcript = " ".join(snippet["text"] for snippet in timestamped_transcript if "text" in snippet)
    summary = summarize_video(compiled_transcript)
    return jsonify({"message": summary}), 200

@app.route("/fav-note", methods=["POST"])
def mark_note_as_fav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE video SET fav = TRUE WHERE video_title = %s", (video_title,))
        conn.commit()

    return {"message": "Note marked as favourite."}, 200

@app.route("/unfav-note", methods=["POST"])
def mark_note_as_unfav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE video SET fav = FALSE WHERE video_title = %s", (video_title,))
        conn.commit()

    return {"message": "Note marked as favourite."}, 200

@app.route("/<video_yt_id>")
def get_note_page(video_yt_id):
    return render_template("note.html")

@app.route("/labels", methods=["GET"])
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
def add_new_label():

    data = request.json
    label_name = data["label_name"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO label (label_name) VALUES (%s)",
            (label_name,))
        
    return jsonify({"message":"Label added successfully"}), 201

@app.route("/<label>/note", methods=["GET"])
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

@app.route("/video-label", methods=["POST"])
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


if __name__ == "__main__":
    app.run(debug=True)
