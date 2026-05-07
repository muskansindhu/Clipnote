from __future__ import annotations

import psycopg
from datetime import datetime, timezone
from flask import Response, jsonify
from exceptions import TrialClipchatLimitError
from auth_utils import issue_guest_access_token
from config import SUPABASE_CONNECTION_STRING, S3_BUCKET, JWT_SECRET
from utils import (
    get_video_transcription_apify,
    generate_video_summary,
    fetch_youtube_video_metadata,
    put_object_to_s3,
    get_object_from_s3,
)

import json
import logging
import re
from typing import Any, Iterator

from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL
from prompt import build_clipchat_system_prompt

openai_client = OpenAI(api_key=OPENAI_API_KEY)

MAX_CLIPCHAT_CONTEXT_TOKENS = 120_000
CLIPCHAT_CHUNK_CHAR_BUDGET = 90_000
CLIPCHAT_CHUNK_OVERLAP_ENTRIES = 3
MAX_CLIPCHAT_ITERATION_CHUNKS = 5
RETRIEVAL_CONTEXT_WINDOW = 2
RETRIEVAL_MAX_HITS = 24
RETRIEVAL_STOP_WORDS = {
    "a",
    "about",
    "all",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "do",
    "does",
    "for",
    "from",
    "how",
    "i",
    "in",
    "into",
    "is",
    "it",
    "key",
    "main",
    "moments",
    "of",
    "on",
    "show",
    "speaker",
    "takeaways",
    "tell",
    "that",
    "the",
    "this",
    "to",
    "transcript",
    "video",
    "what",
    "where",
    "which",
    "who",
    "why",
    "with",
}

CLIPCHAT_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "clipchat_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["answer"],
            "properties": {
                "answer": {"type": "string"},
            },
        },
    },
}

CITATION_BLOCK_PATTERN = re.compile(r"\[([^\[\]]+)\]")
TIMESTAMP_TOKEN_PATTERN = re.compile(r"\d+:\d{1,2}(?::\d{1,2})?|\d+(?:\.\d+)?")
TIMESTAMP_LABEL_PATTERN = re.compile(
    r"\(?\s*timestamps?\s*:\s*((?:\[\d+\](?:\s+\[\d+\])*))\s*\)?",
    re.IGNORECASE,
)
PARENTHESISED_CITATION_PATTERN = re.compile(r"\(\s*((?:\[\d+\](?:\s+\[\d+\])*))\s*\)")


def answer_clipchat_question(
    *,
    video_title: str,
    video_summary: str | None,
    transcript: list[dict[str, Any]] | None,
    notes: list[dict[str, str]],
    question: str,
) -> dict[str, Any]:
    """Answer a Clipchat question using the raw transcript as context."""
    del video_summary, notes

    compact_entries = _compact_transcript_entries(transcript)
    if not compact_entries:
        return {"answer": "**I couldn't find that in the transcript.**"}

    transcript_context = _serialise_transcript_entries(compact_entries)
    if _estimate_token_count(transcript_context) <= MAX_CLIPCHAT_CONTEXT_TOKENS:
        return _answer_clipchat_single_pass(
            video_title=video_title,
            transcript_context=transcript_context,
            question=question,
        )

    transcript_index = build_inverted_index(compact_entries)
    return _answer_clipchat_with_retrieved_context(
        video_title=video_title,
        transcript_entries=compact_entries,
        transcript_index=transcript_index,
        question=question,
    )


def build_inverted_index(entries: list[dict[str, str]]) -> dict[str, list[int]]:
    """Build a lightweight inverted index for transcript entry lookup."""
    inverted_index: dict[str, list[int]] = {}
    for entry_index, entry in enumerate(entries):
        # De-duplicate tokens per entry so common words do not over-inflate postings.
        entry_tokens = set(_tokenise_text_for_retrieval(entry.get("text", "")))
        for token in entry_tokens:
            inverted_index.setdefault(token, []).append(entry_index)
    return inverted_index


def retrieve_candidate_chunks(
    query: str,
    entries: list[dict[str, str]],
    index: dict[str, list[int]],
    *,
    top_k: int = MAX_CLIPCHAT_ITERATION_CHUNKS,
    context_window: int = RETRIEVAL_CONTEXT_WINDOW,
) -> list[list[dict[str, str]]]:
    """Retrieve up to top_k transcript chunks relevant to the query."""
    if not entries:
        return []

    query_keywords = _extract_query_keywords(query)
    if not query_keywords:
        return _build_fallback_candidate_chunks(entries, top_k=top_k)

    entry_scores: dict[int, float] = {}
    for keyword in query_keywords:
        matching_indices = index.get(keyword, [])
        if not matching_indices:
            continue

        keyword_weight = 1.0 / len(matching_indices)
        for entry_index in matching_indices:
            entry_scores[entry_index] = entry_scores.get(entry_index, 0.0) + keyword_weight

    if not entry_scores:
        return _build_fallback_candidate_chunks(entries, top_k=top_k)

    ranked_hits = sorted(
        entry_scores.items(),
        key=lambda item: (-item[1], item[0]),
    )
    candidate_windows = [
        (
            max(0, entry_index - context_window),
            min(len(entries) - 1, entry_index + context_window),
        )
        for entry_index, _ in ranked_hits[:RETRIEVAL_MAX_HITS]
    ]

    merged_windows = merge_overlapping_windows(candidate_windows)
    if not merged_windows:
        return _build_fallback_candidate_chunks(entries, top_k=top_k)

    ranked_windows = sorted(
        merged_windows,
        key=lambda window: (-_score_window(window, entry_scores), window[0]),
    )
    selected_windows = sorted(ranked_windows[:top_k], key=lambda window: window[0])

    candidate_chunks: list[list[dict[str, str]]] = []
    for start_index, end_index in selected_windows:
        window_entries = entries[start_index : end_index + 1]
        # Reuse the existing chunk serialisation budget when a window grows too large.
        candidate_chunks.extend(
            _chunk_transcript_entries(
                window_entries,
                max_chars=CLIPCHAT_CHUNK_CHAR_BUDGET,
                overlap_entries=0,
            )
        )
        if len(candidate_chunks) >= top_k:
            break

    if candidate_chunks:
        return candidate_chunks[:top_k]
    return _build_fallback_candidate_chunks(entries, top_k=top_k)


def merge_overlapping_windows(windows: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Merge overlapping or adjacent entry windows."""
    if not windows:
        return []

    sorted_windows = sorted(windows)
    merged_windows = [sorted_windows[0]]
    for start_index, end_index in sorted_windows[1:]:
        previous_start, previous_end = merged_windows[-1]
        if start_index <= previous_end + 1:
            merged_windows[-1] = (previous_start, max(previous_end, end_index))
            continue
        merged_windows.append((start_index, end_index))
    return merged_windows


def _request_structured_completion(
    *,
    request_name: str,
    system_prompt: str,
    user_content: str,
    response_format: dict[str, Any],
) -> dict[str, Any]:
    """Run a structured completion and parse the JSON response."""
    request_payload = {
        "model": OPENAI_MODEL,
        "response_format": response_format,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
    }

    response = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        response_format=response_format,
        messages=request_payload["messages"],
    )
    raw_content = response.choices[0].message.content or ""

    return _parse_model_response(raw_content)


def _answer_clipchat_single_pass(
    *,
    video_title: str,
    transcript_context: str,
    question: str,
) -> dict[str, Any]:
    """Answer a question in a single call when the transcript fits the budget."""
    response_payload = _request_structured_completion(
        request_name="clipchat_single_pass",
        system_prompt=build_clipchat_system_prompt(
            title=video_title,
            transcript=transcript_context,
        ),
        user_content=question,
        response_format=CLIPCHAT_RESPONSE_FORMAT,
    )
    return {
        "answer": _normalise_clipchat_answer(
            str(response_payload.get("answer", "")).strip()
        )
    }


def _answer_clipchat_with_retrieved_context(
    *,
    video_title: str,
    transcript_entries: list[dict[str, str]],
    transcript_index: dict[str, list[int]],
    question: str,
) -> dict[str, Any]:
    """Answer a long-transcript question from retrieved transcript context."""
    candidate_chunks = retrieve_candidate_chunks(
        question,
        transcript_entries,
        transcript_index,
    )
    retrieved_context = _build_retrieved_context_object(
        question=question,
        entries=transcript_entries,
        index=transcript_index,
        candidate_chunks=candidate_chunks,
    )
    response_payload = _request_structured_completion(
        request_name="clipchat_retrieved_context",
        system_prompt=build_clipchat_system_prompt(
            title=video_title,
            transcript=json.dumps(
                retrieved_context,
                ensure_ascii=True,
                separators=(",", ":"),
            ),
        ),
        user_content=question,
        response_format=CLIPCHAT_RESPONSE_FORMAT,
    )
    return {
        "answer": _normalise_clipchat_answer(
            str(response_payload.get("answer", "")).strip()
        )
    }


def _compact_transcript_entries(
    transcript: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    """Compact transcript entries down to the fields Clipchat actually uses."""
    compact_entries: list[dict[str, str]] = []
    if not transcript:
        return compact_entries

    for entry in transcript:
        if not isinstance(entry, dict):
            continue

        start = str(entry.get("start", "")).strip()
        text = str(entry.get("text", "")).strip()
        dur = str(entry.get("dur", "")).strip()
        if not start or not text:
            continue

        compact_entry: dict[str, str] = {"start": start, "text": text}
        if dur:
            compact_entry["dur"] = dur
        compact_entries.append(compact_entry)

    return compact_entries


def _serialise_transcript_entries(entries: list[dict[str, str]]) -> str:
    """Serialise compact transcript entries as dense JSON."""
    return json.dumps(entries, ensure_ascii=True, separators=(",", ":"))


def _chunk_transcript_entries(
    entries: list[dict[str, str]],
    *,
    max_chars: int,
    overlap_entries: int,
) -> list[list[dict[str, str]]]:
    """Split transcript entries into sequential JSON-sized chunks."""
    if not entries:
        return []

    chunks: list[list[dict[str, str]]] = []
    start_index = 0

    while start_index < len(entries):
        current_chunk: list[dict[str, str]] = []
        current_length = 2
        index = start_index

        while index < len(entries):
            entry_json = json.dumps(
                entries[index],
                ensure_ascii=True,
                separators=(",", ":"),
            )
            additional_length = len(entry_json) + (1 if current_chunk else 0)
            if current_chunk and current_length + additional_length > max_chars:
                break

            current_chunk.append(entries[index])
            current_length += additional_length
            index += 1

        if not current_chunk:
            current_chunk.append(entries[start_index])
            index = start_index + 1

        chunks.append(current_chunk)
        if index >= len(entries):
            break

        start_index = max(index - overlap_entries, start_index + 1)

    return chunks


def _tokenise_text_for_retrieval(text: str) -> list[str]:
    """Tokenise free text into lowercase words for retrieval."""
    return re.findall(r"[a-z0-9']+", text.lower())


def _estimate_token_count(text: str) -> int:
    """Estimate token count cheaply without an external tokenizer."""
    return len(re.findall(r"\w+|[^\w\s]", text))


def _extract_query_keywords(query: str) -> list[str]:
    """Extract the query terms most useful for keyword retrieval."""
    query_tokens = _tokenise_text_for_retrieval(query)
    return [
        token
        for token in query_tokens
        if len(token) > 1 and token not in RETRIEVAL_STOP_WORDS
    ]


def _score_window(
    window: tuple[int, int],
    entry_scores: dict[int, float],
) -> float:
    """Score a merged retrieval window by the entries it contains."""
    start_index, end_index = window
    return sum(
        entry_scores.get(entry_index, 0.0)
        for entry_index in range(start_index, end_index + 1)
    )


def _build_fallback_candidate_chunks(
    entries: list[dict[str, str]],
    *,
    top_k: int,
) -> list[list[dict[str, str]]]:
    """Fallback to a small set of transcript chunks when retrieval misses."""
    fallback_chunks = _chunk_transcript_entries(
        entries,
        max_chars=CLIPCHAT_CHUNK_CHAR_BUDGET,
        overlap_entries=CLIPCHAT_CHUNK_OVERLAP_ENTRIES,
    )
    if len(fallback_chunks) <= top_k:
        return fallback_chunks

    if top_k <= 1:
        return fallback_chunks[:1]

    selected_indices: list[int] = []
    for position in range(top_k):
        chunk_index = round(position * (len(fallback_chunks) - 1) / (top_k - 1))
        if chunk_index not in selected_indices:
            selected_indices.append(chunk_index)

    return [fallback_chunks[index] for index in selected_indices[:top_k]]


def _build_retrieved_context_object(
    *,
    question: str,
    entries: list[dict[str, str]],
    index: dict[str, list[int]],
    candidate_chunks: list[list[dict[str, str]]],
) -> dict[str, Any]:
    """Build a single retrieved-context object for one long-transcript LLM call."""
    query_keywords = _extract_query_keywords(question)
    return {
        "query": question,
        "keywords": query_keywords,
        "total_entries": len(entries),
        "matched_entry_count": sum(
            len(index.get(keyword, []))
            for keyword in query_keywords
        ),
        "candidate_chunks": [
            {
                "chunk_index": chunk_index,
                "entries": chunk_entries,
            }
            for chunk_index, chunk_entries in enumerate(candidate_chunks, start=1)
        ],
    }


def _parse_model_response(raw_content: str) -> dict[str, Any]:
    """Parse structured model output, tolerating accidental plain text."""
    try:
        parsed = json.loads(raw_content)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        logging.warning("Model returned non-JSON content: %s", raw_content)
    return {"answer": raw_content.strip(), "citations": []}


def _normalise_clipchat_answer(answer: str) -> str:
    """Normalise Clipchat citations to raw integer-second square brackets."""
    normalised_answer = CITATION_BLOCK_PATTERN.sub(_replace_citation_block, answer)
    normalised_answer = TIMESTAMP_LABEL_PATTERN.sub(r" \1", normalised_answer)
    normalised_answer = PARENTHESISED_CITATION_PATTERN.sub(r" \1", normalised_answer)
    normalised_answer = re.sub(r"\s{2,}", " ", normalised_answer)
    normalised_answer = re.sub(r" *\n *", "\n", normalised_answer)
    return normalised_answer.strip()


def _replace_citation_block(match: re.Match[str]) -> str:
    """Rewrite a citation block into one or more strict raw-second citations."""
    citation_content = match.group(1)
    normalised_seconds = _extract_citation_seconds(citation_content)
    if not normalised_seconds:
        return match.group(0)
    return " ".join(f"[{seconds}]" for seconds in normalised_seconds)


def _extract_citation_seconds(citation_content: str) -> list[int]:
    """Extract ordered unique timestamps from a citation block."""
    seconds_list: list[int] = []
    for segment in citation_content.split(","):
        token_match = TIMESTAMP_TOKEN_PATTERN.search(segment)
        if not token_match:
            continue

        token = token_match.group(0)
        try:
            if ":" in token:
                seconds = max(0, int(_hms_to_seconds(token) + 0.5))
            else:
                seconds = max(0, int(float(token) + 0.5))
        except (TypeError, ValueError):
            continue

        if seconds in seconds_list:
            continue
        seconds_list.append(seconds)
    return seconds_list


def _hms_to_seconds(hms_str: str) -> float:
    """Convert a timestamp string into seconds."""
    parts = hms_str.split(":")
    parts = [float(part) for part in parts]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0]



TRIAL_VIDEO_LIMIT = 1
TRIAL_QUERIES_PER_VIDEO_LIMIT = 5




def _is_guest_user(user_id: str) -> bool:
    return user_id.startswith("guest_")


def _normalise_guest_clipchat_usage(raw_usage: Any) -> dict[str, int]:
    usage: dict[str, int] = {}
    if not isinstance(raw_usage, dict):
        return usage

    for raw_video_id, raw_count in raw_usage.items():
        if not isinstance(raw_video_id, str):
            continue
        try:
            count = int(raw_count)
        except (TypeError, ValueError):
            continue
        usage[raw_video_id] = max(0, count)

    return usage


def _build_guest_trial_details(
    auth_payload: dict[str, Any], *, video_yt_id: str | None = None
) -> dict[str, Any]:
    usage = _normalise_guest_clipchat_usage(auth_payload.get("clipchat_usage"))

    trial_details: dict[str, Any] = {
        "videos_used": len(usage),
        "video_limit": TRIAL_VIDEO_LIMIT,
        "queries_per_video_limit": TRIAL_QUERIES_PER_VIDEO_LIMIT,
    }

    if video_yt_id is not None:
        queries_used = usage.get(video_yt_id, 0)
        trial_details["queries_used_for_video"] = queries_used
        trial_details["queries_remaining_for_video"] = max(
            0, TRIAL_QUERIES_PER_VIDEO_LIMIT - queries_used
        )

    return trial_details


def _issue_refreshed_guest_token(
    *, auth_payload: dict[str, Any], clipchat_usage: dict[str, int]
) -> str:
    exp_timestamp = auth_payload.get("exp")
    expires_at = None
    if exp_timestamp:
        expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)

    return issue_guest_access_token(
        guest_id=str(auth_payload.get("sub") or ""),
        jwt_secret=JWT_SECRET,
        clipchat_usage=clipchat_usage,
        trial_start=str(auth_payload.get("trial_start") or ""),
        expires_at=expires_at,
    )


def _build_transcript_text(transcript: list[dict[str, Any]]) -> str:
    return " ".join(
        str(snippet.get("text", "")).strip()
        for snippet in transcript
        if isinstance(snippet, dict) and str(snippet.get("text", "")).strip()
    )


def _persist_video_summary_if_available(
    *, video_yt_id: str, video_summary: str | None
) -> None:
    if not video_summary:
        return

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE video
                SET video_summary = %s
                WHERE id = %s AND (video_summary IS NULL OR video_summary = '')
                """,
                (video_summary, video_yt_id),
            )
            conn.commit()


def _hydrate_clipchat_metadata(
    *, video_yt_id: str, clipchat_context: dict[str, Any]
) -> dict[str, Any]:
    metadata = None
    default_video_url = f"https://www.youtube.com/watch?v={video_yt_id}"
    current_title = str(clipchat_context.get("video_title") or "").strip()
    current_url = str(clipchat_context.get("video_url") or "").strip()

    if not current_title or current_title == "YouTube video":
        metadata = fetch_youtube_video_metadata(video_yt_id)

    if metadata:
        clipchat_context["video_title"] = metadata.get("video_title") or current_title
        clipchat_context["video_url"] = metadata.get("video_url") or current_url
    else:
        if not current_title:
            clipchat_context["video_title"] = "YouTube video"
        if not current_url:
            clipchat_context["video_url"] = default_video_url

    return clipchat_context


def _build_clipchat_asset_status(
    *, clipchat_context: dict[str, Any], transcript: Any
) -> dict[str, str]:
    transcript_ready = isinstance(transcript, list) and len(transcript) > 0
    summary_ready = bool(str(clipchat_context.get("video_summary") or "").strip())

    return {
        "transcript": "ready" if transcript_ready else "pending",
        "summary": "ready" if summary_ready else "pending",
    }


def _ensure_clipchat_assets(
    *, video_yt_id: str, clipchat_context: dict[str, Any]
) -> tuple[list[dict[str, Any]] | None, dict[str, str]]:
    transcript_source = "s3"
    transcript = get_object_from_s3(video_yt_id, S3_BUCKET)
    if not transcript or not isinstance(transcript, list):
        transcript_source = "fetched"
        transcript = get_video_transcription_apify(video_yt_id)
        if isinstance(transcript, list) and transcript:
            put_object_to_s3(video_yt_id, S3_BUCKET, transcript)

    if not transcript or not isinstance(transcript, list):
        return None, {"transcript": "unavailable", "summary": "unavailable"}

    summary_source = "existing"
    if not clipchat_context.get("video_summary"):
        transcript_text = _build_transcript_text(transcript)
        if transcript_text:
            generated_summary = generate_video_summary(transcript_text)
            if generated_summary:
                clipchat_context["video_summary"] = generated_summary
                _persist_video_summary_if_available(
                    video_yt_id=video_yt_id,
                    video_summary=generated_summary,
                )
                summary_source = "generated"
            else:
                return transcript, {
                    "transcript": "ready",
                    "summary": "unavailable",
                    "transcript_source": transcript_source,
                    "summary_source": "failed",
                }
        else:
            return transcript, {
                "transcript": "ready",
                "summary": "unavailable",
                "transcript_source": transcript_source,
                "summary_source": "empty_transcript",
            }

    return transcript, {
        "transcript": "ready",
        "summary": "ready",
        "transcript_source": transcript_source,
        "summary_source": summary_source,
    }


def _reserve_guest_clipchat_query_slot(
    *, video_yt_id: str, auth_payload: dict[str, Any]
) -> tuple[str, dict[str, int]]:
    clipchat_usage = _normalise_guest_clipchat_usage(
        auth_payload.get("clipchat_usage")
    )
    current_video_queries = clipchat_usage.get(video_yt_id, 0)

    if video_yt_id not in clipchat_usage and len(clipchat_usage) >= TRIAL_VIDEO_LIMIT:
        raise TrialClipchatLimitError(
            "Whoa there! You've hit your 1-video free trial limit. Our GPUs are sweating and inference ain't cheap! 😅 Create an account to support the app and keep chatting."
        )

    if current_video_queries >= TRIAL_QUERIES_PER_VIDEO_LIMIT:
        raise TrialClipchatLimitError(
            "Beep boop! 🤖 You've used your 5 free questions for this video. GPUs need to eat too, and inference costs are adding up! Please create an account to support us."
        )

    updated_usage = dict(clipchat_usage)
    updated_usage[video_yt_id] = current_video_queries + 1
    
    guest_id = auth_payload.get("sub")
    if guest_id:
        with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO guest_usage (guest_id, clipchat_usage) 
                    VALUES (%s, %s::jsonb)
                    ON CONFLICT (guest_id) DO UPDATE SET clipchat_usage = EXCLUDED.clipchat_usage
                    """,
                    (guest_id, json.dumps(updated_usage))
                )
                conn.commit()

    refreshed_token = _issue_refreshed_guest_token(
        auth_payload=auth_payload,
        clipchat_usage=updated_usage,
    )
    return refreshed_token, updated_usage


def _build_guest_clipchat_limit_response(
    *, auth_payload: dict[str, Any], message: str, video_yt_id: str
) -> tuple[Response, int]:
    return (
        jsonify(
            {
                "message": message,
                "code": "clipchat_trial_limit",
                "trial": _build_guest_trial_details(
                    auth_payload, video_yt_id=video_yt_id
                ),
            }
        ),
        403,
    )


def _attach_guest_trial_headers(
    response: Response,
    *,
    refreshed_token: str | None,
    auth_payload: dict[str, Any],
    video_yt_id: str,
) -> Response:
    if refreshed_token:
        response.headers["X-Clipnote-Access-Token"] = refreshed_token
        response.set_cookie(
            "clipnote_guest_token",
            refreshed_token,
            max_age=365 * 24 * 60 * 60,
            httponly=True,
            secure=True,
            samesite="Strict"
        )

    trial_details = _build_guest_trial_details(auth_payload, video_yt_id=video_yt_id)
    response.headers["X-Clipnote-Trial-Videos-Used"] = str(
        trial_details["videos_used"]
    )
    response.headers["X-Clipnote-Trial-Video-Limit"] = str(
        trial_details["video_limit"]
    )
    response.headers["X-Clipnote-Trial-Queries-Used"] = str(
        trial_details["queries_used_for_video"]
    )
    response.headers["X-Clipnote-Trial-Queries-Remaining"] = str(
        trial_details["queries_remaining_for_video"]
    )
    return response


def _get_registered_clipchat_context(
    video_yt_id: str, user_id: str
) -> dict[str, Any] | None:
    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, video_url, video_title, fav, video_summary
                FROM video
                WHERE id = %s AND user_id = %s
                """,
                (video_yt_id, user_id),
            )
            video = cur.fetchone()

            if not video:
                cur.execute(
                    """
                    SELECT video_url, video_title, video_summary
                    FROM video
                    WHERE id = %s
                    ORDER BY created_at DESC NULLS LAST
                    LIMIT 1
                    """,
                    (video_yt_id,),
                )
                any_video = cur.fetchone()
                default_url = f"https://www.youtube.com/watch?v={video_yt_id}"
                return {
                    "video_id": video_yt_id,
                    "video_url": any_video[0] if any_video and any_video[0] else default_url,
                    "video_title": any_video[1] if any_video and any_video[1] else "YouTube video",
                    "fav": False,
                    "video_summary": any_video[2] if any_video else None,
                    "notes": [],
                }

            cur.execute(
                """
                SELECT id, video_timestamp, note, note_source
                FROM notes
                WHERE video_id = %s AND user_id = %s
                ORDER BY created_at ASC
                """,
                (video_yt_id, user_id),
            )
            notes = cur.fetchall()

    return {
        "video_id": video[0],
        "video_url": video[1],
        "video_title": video[2],
        "fav": video[3],
        "video_summary": video[4],
        "notes": [
            {
                "id": note[0],
                "video_timestamp": note[1],
                "note": note[2],
                "note_source": note[3],
            }
            for note in notes
        ],
    }


def _get_guest_clipchat_context(video_yt_id: str) -> dict[str, Any]:
    default_url = f"https://www.youtube.com/watch?v={video_yt_id}"
    default_title = "YouTube video"

    with psycopg.connect(SUPABASE_CONNECTION_STRING) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT video_url, video_title, video_summary
                FROM video
                WHERE id = %s
                ORDER BY created_at DESC NULLS LAST
                LIMIT 1
                """,
                (video_yt_id,),
            )
            video = cur.fetchone()

    return {
        "video_id": video_yt_id,
        "video_url": video[0] if video and video[0] else default_url,
        "video_title": video[1] if video and video[1] else default_title,
        "fav": False,
        "video_summary": video[2] if video else None,
        "notes": [],
    }


def _get_clipchat_context(video_yt_id: str, user_id: str) -> dict[str, Any] | None:
    if _is_guest_user(user_id):
        return _get_guest_clipchat_context(video_yt_id)
    return _get_registered_clipchat_context(video_yt_id, user_id)


def _stream_clipchat_payload(
    clipchat_response: dict[str, Any]
) -> Iterator[str]:
    answer = str(clipchat_response.get("answer", ""))
    chunk_size = 28

    for index in range(0, len(answer), chunk_size):
        chunk = answer[index : index + chunk_size]
        yield f"event: chunk\ndata: {json.dumps({'delta': chunk})}\n\n"

    done_payload = json.dumps({"answer": answer})
    yield f"event: done\ndata: {done_payload}\n\n"


