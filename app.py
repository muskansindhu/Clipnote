from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3

app = Flask(__name__)

CORS(app)


@app.route("/add-notes", methods=["POST"])
def add_notes():
    data = request.json  

    videoUrl = data["videoUrl"]
    videoTitle = data["videoTitle"]
    videoTimestamp = data["currentTimeStamp"]
    notes = data["notes"]

    connection = sqlite3.connect("notes.db")
    cursor = connection.cursor()

    cursor.execute(
    "INSERT INTO notes (videoURL, videoTitle, videoTimestamp, notes) VALUES (?, ?, ?, ?)", 
    (videoUrl, videoTitle, videoTimestamp, notes)
)
    connection.commit()

    connection.close()

    return jsonify({"message": "Note added successfully"}), 201

if __name__ == "__main__":
    app.run(debug=True)