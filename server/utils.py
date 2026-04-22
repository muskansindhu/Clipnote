from __future__ import annotations

import json
import logging
from functools import wraps
from typing import Any, Callable, TypeVar, cast
from urllib.parse import parse_qs, urlparse

import boto3
import jwt
from apify_client import ApifyClient
from botocore.exceptions import ClientError
from flask import jsonify, request
from openai import OpenAI

from config import (
    ACCESS_KEY,
    APIFY_TOKEN,
    JWT_SECRET,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    SECRET_KEY,
)
from prompt import (
    AI_NOTE_SYSTEM_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    VIDEO_SUMMARY_SYSTEM_PROMPT,
    build_ai_note_user_prompt,
    build_summary_user_prompt,
    build_video_summary_user_prompt,
)

openai_client = OpenAI(api_key=OPENAI_API_KEY)
apify_client = ApifyClient(token=APIFY_TOKEN)
s3_client = boto3.client(
    "s3", aws_access_key_id=ACCESS_KEY, aws_secret_access_key=SECRET_KEY
)

F = TypeVar("F", bound=Callable[..., Any])


def put_object_to_s3(object_name: str, bucket: str, data: Any) -> bool:
    """Persist JSON-serializable content to S3."""
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=object_name,
            Body=json.dumps(data),
            ContentType="application/json",
        )
    except ClientError as e:
        logging.error(e)
        return False
    return True


def get_object_from_s3(object_name: str, bucket: str) -> Any | None:
    """Fetch and decode JSON content from S3."""
    try:
        response = s3_client.get_object(
            Bucket=bucket,
            Key=object_name,
        )
        body = response["Body"].read()
        return json.loads(body.decode("utf-8"))
    except ClientError as e:
        logging.error("Failed to get object from S3: %s", e)
        return None
    except json.JSONDecodeError as e:
        logging.error("Invalid JSON in S3 object %s: %s", object_name, e)
        return None


def get_video_transcription_apify(video_id: str) -> list[dict[str, Any]] | str:
    """Fetch a timestamped YouTube transcript using Apify."""
    try:
        run = apify_client.actor("pintostudio/youtube-transcript-scraper").call(
            run_input={"videoUrl": f"https://www.youtube.com/watch?v={video_id}"},
            logger=None,
            build="latest",
            timeout_secs=20,
            max_items=1,
        )
        items = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())
        if not items or "data" not in items[0]:
            return ""
        return items[0]["data"]
    except Exception:
        logging.exception("Unexpected transcript fetch error for %s", video_id)
        return "An unexpected error occurred while fetching the transcript."


def summarize_video(transcript: str) -> str:
    """Generate a 5-bullet summary for a transcript."""
    return _request_text_completion(
        request_name="video_summary_bullets",
        system_prompt=SUMMARY_SYSTEM_PROMPT,
        user_content=build_summary_user_prompt(transcript),
    )


def generate_video_summary(transcript: str) -> str | None:
    """Generate the saved short summary for a transcript."""
    try:
        return _request_text_completion(
            request_name="video_summary_short",
            system_prompt=VIDEO_SUMMARY_SYSTEM_PROMPT,
            user_content=build_video_summary_user_prompt(transcript),
        )
    except Exception as e:
        logging.error("Failed to generate summary: %s", e)
        return None


def extract_video_id(url: str) -> str | None:
    """Extract a YouTube video id from a watch URL."""
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    return query_params.get("v", [None])[0]


def extract_transcript_snippet(
    transcript: list[dict[str, Any]],
    center_timestamp: float,
    window: int = 15,
) -> str:
    """Extract transcript text near a requested timestamp."""
    start_window = center_timestamp - window
    end_window = center_timestamp + window
    snippet = [
        entry["text"]
        for entry in transcript
        if "text" in entry and start_window <= float(entry["start"]) <= end_window
    ]
    return " ".join(snippet)


def generate_ai_note(transcript_chunk: str) -> str:
    """Generate a one-line note from a short transcript snippet."""
    return _request_text_completion(
        request_name="ai_note_generation",
        system_prompt=AI_NOTE_SYSTEM_PROMPT,
        user_content=build_ai_note_user_prompt(transcript_chunk),
    )


def hms_to_seconds(hms_str: str) -> float:
    """Convert a timestamp string into seconds."""
    parts = [float(part) for part in hms_str.split(":")]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0]


def require_auth(f: F) -> F:
    """Validate a bearer token and attach the auth payload to the request."""

    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
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
            request.auth_payload = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token"}), 401

        return f(*args, **kwargs)

    return cast(F, decorated)


def _request_text_completion(
    *,
    request_name: str,
    system_prompt: str,
    user_content: str,
) -> str:
    """Run a plain text completion for summarization and note-generation tasks."""
    request_payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    }
    response = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=request_payload["messages"],
    )
    raw_content = (response.choices[0].message.content or "").strip()
    return raw_content


