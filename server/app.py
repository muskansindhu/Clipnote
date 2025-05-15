from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import psycopg

from config import SUPABASE_CONNECTION_STRING
from utils import get_video_transcription, summarize_video

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)


@app.route("/", methods=["GET"])
def home():
    return render_template("home.html")

@app.route("/all-notes", methods=["GET"])
def get_all_notes():
    all_notes = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM ytnotes")
            notes = cur.fetchall()
        
        for note in notes:
            all_notes.append({
                "id" : note[0],
                "created_at" : note[1],
                "video_url" : note[2],
                "video_title" : note[3],
                "video_timestamp" : note[4],
                "note": note[5],
                "fav": note[6]
            })

    return all_notes

@app.route("/add-notes", methods=["POST"])
def add_notes():
    data = request.json
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO ytnotes (video_url, video_title, video_timestamp, notes) VALUES (%s, %s, %s, %s)",
                (data["videoUrl"], data["videoTitle"], data["currentTimeStamp"], data["notes"])
            )
            conn.commit()
    return jsonify({"message": "Note added successfully"}), 201

@app.route("/summarize", methods=["POST"])
def get_video_summary():
    data = request.json
    video_id = data["video_url"].split("=")[1]
    transcript = get_video_transcription(video_id)
    summary = summarize_video(transcript)
    return jsonify({"message": summary}), 200

@app.route("/fav-note", methods=["POST"])
def mark_note_as_fav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE ytnotes SET fav = TRUE WHERE video_title = %s", (video_title,))
        conn.commit()

    return {"message": "Note marked as favourite."}, 200


if __name__ == "__main__":
    app.run(debug=True)
