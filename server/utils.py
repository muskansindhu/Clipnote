import json
import logging
from urllib.parse import urlparse, parse_qs
from functools import wraps

import jwt
import boto3
from botocore.exceptions import ClientError
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
from apify_client import ApifyClient
from google import genai
from flask import request, jsonify

from config import GEMINI_API_KEY, APIFY_TOKEN, JWT_SECRET

ytt_api = YouTubeTranscriptApi()

genai_client = genai.Client(api_key=GEMINI_API_KEY)

client = ApifyClient(token=APIFY_TOKEN)

s3_client = boto3.client('s3')

def put_object_to_s3(object_name, bucket, data):
    try:
        response = s3_client.put_object(
            Bucket=bucket,
            Key=object_name,
            Body=json.dumps(data),
            ContentType='application/json'
        )
    except ClientError as e:
        logging.error(e)
        return False
    return True

def delete_object_from_s3(object_name, bucket):
    try:
        response = s3_client.delete_object(Bucket=bucket, Key=object_name)
    except ClientError as e:
        logging.error(e)
        return False
    return True

def get_object_from_s3(object_name, bucket):
    try:
        response = s3_client.get_object(
            Bucket=bucket,
            Key=object_name,
        )
        body = response['Body'].read()
        transcript = json.loads(body.decode('utf-8'))
        return transcript

    except ClientError as e:
        logging.error(f"Failed to get object from S3: {e}")
        return None

    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON in S3 object {object_name}: {e}")
        return None

def get_video_transcription_ytapi(video_id):
    try:
        fetched_transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        compiled_transcript = " ".join(snippet['text'] for snippet in fetched_transcript)
        return compiled_transcript
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
        print(f"[Transcript Error] {e}")
        return "Transcript not available for this video."
    except Exception as e:
        print(f"[Unexpected Error] {e}")
        return "An unexpected error occurred while fetching the transcript."
    
def get_video_transcription_apify(video_id):
    try:
        run_input = {
            "videoUrl": f"https://www.youtube.com/watch?v={video_id}",
        }

        run = client.actor("pintostudio/youtube-transcript-scraper").call(
            run_input=run_input,
            logger=None,
            build="latest",
            timeout_secs=20,
            max_items=1
        )

        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        if not items or "data" not in items[0]:
            return ""
        
        transcript_with_timestamp = items[0]["data"]
        return transcript_with_timestamp

    except Exception as e:
        print(f"[Unexpected Error] {e}")
        return "An unexpected error occurred while fetching the transcript."

def summarize_video(transcript):
    prompt = f"Please summarize the given text in 5 bullet points and do not add any extra line other than the summary content: {transcript}"
    response = genai_client.models.generate_content(
        model="gemini-2.0-flash", contents=prompt
    )
    return response.text

def extract_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    return query_params.get("v", [None])[0]

def extract_transcript_snippet(transcript, center_timestamp, window=15):
    start_window = center_timestamp - window
    end_window = center_timestamp + window

    snippet = [
        entry['text']
        for entry in transcript
        if 'text' in entry and start_window <= float(entry['start']) <= end_window
    ]

    return " ".join(snippet)

def generate_ai_note(transcript_chunk):
    prompt = f"Generate a 1 liner note for the given text and do not add any extra line other than the note content: {transcript_chunk}"
    response = genai_client.models.generate_content(
        model="gemini-2.0-flash", contents=prompt
    )
    return response.text

def hms_to_seconds(hms_str):
    parts = hms_str.split(":")
    parts = [float(p) for p in parts]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    elif len(parts) == 2:
        return parts[0] * 60 + parts[1]
    else:
        return parts[0]
    
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            parts = auth_header.split(" ")
            if len(parts) == 2 and parts[0] == "Bearer":
                token = parts[1]

        if not token:
            return jsonify({"message": "Token missing"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user = payload["sub"]
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        return f(*args, **kwargs)
    return decorated
