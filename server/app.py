from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import psycopg

from config import SUPABASE_CONNECTION_STRING
from utils import get_video_transcription, summarize_video, extract_video_id

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
                "video_yt_id" : note[2],
                "video_url" : note[3],
                "video_title" : note[4],
                "video_timestamp" : note[5],
                "note": note[6],
                "fav": note[7]
            })

    return all_notes

@app.route("/note/<video_yt_id>", methods=["GET"])
def get_note(video_yt_id):

    video_notes = []

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM ytnotes WHERE video_yt_id=%s",(video_yt_id,))
            notes = cur.fetchall()
        
        for note in notes:
            video_notes.append({
                "id" : note[0],
                "created_at" : note[1],
                "video_yt_id" : note[2],
                "video_url" : note[3],
                "video_title" : note[4],
                "video_timestamp" : note[5],
                "note": note[6],
                "fav": note[7]
            })

    return video_notes


@app.route("/add-notes", methods=["POST"])
def add_notes():
    data = request.json
    video_yt_id = extract_video_id(data["videoUrl"])

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO ytnotes (video_url, video_yt_id, video_title, video_timestamp, notes) VALUES (%s, %s, %s, %s, %s)",
                (data["videoUrl"], video_yt_id, data["videoTitle"], data["currentTimeStamp"], data["notes"])
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

@app.route("/unfav-note", methods=["POST"])
def mark_note_as_unfav():
    data = request.json
    video_title = data["video_title"]

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE ytnotes SET fav = FALSE WHERE video_title = %s", (video_title,))
        conn.commit()

    return {"message": "Note marked as favourite."}, 200

@app.route("/<video_yt_id>")
def get_note_page(video_yt_id):
    return render_template("note.html")

if __name__ == "__main__":
    app.run(debug=True)
