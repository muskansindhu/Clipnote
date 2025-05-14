from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg

from config import SUPABASE_CONNECTION_STRING
from utils import get_video_transcription, summarize_video

app = Flask(__name__)
CORS(app)


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

if __name__ == "__main__":
    app.run(debug=True)
