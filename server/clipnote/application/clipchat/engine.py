"""Answering questions about a video from its transcript.

Short transcripts go to the model in one call. Longer ones are indexed by keyword and
only the most relevant windows are sent, with citations normalised to raw seconds.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Sequence
from typing import Any

from clipnote.application.ports import LanguageModel
from clipnote.application.prompts import clipchat_system_prompt
from clipnote.constants import (
    CITATION_BLOCK_PATTERN,
    CLIPCHAT_CHUNK_CHAR_BUDGET,
    CLIPCHAT_CHUNK_OVERLAP_ENTRIES,
    CLIPCHAT_RESPONSE_SCHEMA,
    CLIPCHAT_SCHEMA_NAME,
    MAX_CLIPCHAT_CONTEXT_TOKENS,
    MAX_CLIPCHAT_ITERATION_CHUNKS,
    PARENTHESISED_CITATION_PATTERN,
    RETRIEVAL_CONTEXT_WINDOW,
    RETRIEVAL_MAX_HITS,
    RETRIEVAL_STOP_WORDS,
    TIMESTAMP_LABEL_PATTERN,
    TIMESTAMP_TOKEN_PATTERN,
)
from clipnote.domain import TranscriptEntry, parse_clock


def answer_question(
    model: LanguageModel,
    *,
    video_title: str,
    transcript: Sequence[TranscriptEntry] | None,
    question: str,
) -> dict[str, Any]:
    """Answer a Clipchat question using the raw transcript as context."""
    compact_entries = _compact_transcript_entries(transcript)
    if not compact_entries:
        return {"answer": "**I couldn't find that in the transcript.**"}

    transcript_context = _serialise_transcript_entries(compact_entries)
    if _estimate_token_count(transcript_context) <= MAX_CLIPCHAT_CONTEXT_TOKENS:
        return _answer_clipchat_single_pass(
            model,
            video_title=video_title,
            transcript_context=transcript_context,
            question=question,
        )

    transcript_index = build_inverted_index(compact_entries)
    return _answer_clipchat_with_retrieved_context(
        model,
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
    model: LanguageModel,
    *,
    system_prompt: str,
    user_content: str,
) -> dict[str, Any]:
    """Run a structured completion and parse the JSON response."""
    raw_content = model.complete_structured(
        system=system_prompt,
        user=user_content,
        schema_name=CLIPCHAT_SCHEMA_NAME,
        schema=CLIPCHAT_RESPONSE_SCHEMA,
    )
    return _parse_model_response(raw_content)


def _answer_clipchat_single_pass(
    model: LanguageModel,
    *,
    video_title: str,
    transcript_context: str,
    question: str,
) -> dict[str, Any]:
    """Answer a question in a single call when the transcript fits the budget."""
    response_payload = _request_structured_completion(
        model,
        system_prompt=clipchat_system_prompt(title=video_title, transcript=transcript_context),
        user_content=question,
    )
    return {"answer": _normalise_clipchat_answer(str(response_payload.get("answer", "")).strip())}


def _answer_clipchat_with_retrieved_context(
    model: LanguageModel,
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
        model,
        system_prompt=clipchat_system_prompt(
            title=video_title,
            transcript=json.dumps(retrieved_context, ensure_ascii=True, separators=(",", ":")),
        ),
        user_content=question,
    )
    return {"answer": _normalise_clipchat_answer(str(response_payload.get("answer", "")).strip())}


def _compact_transcript_entries(
    transcript: Sequence[dict[str, Any]] | None,
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
    return [token for token in query_tokens if len(token) > 1 and token not in RETRIEVAL_STOP_WORDS]


def _score_window(
    window: tuple[int, int],
    entry_scores: dict[int, float],
) -> float:
    """Score a merged retrieval window by the entries it contains."""
    start_index, end_index = window
    return sum(
        entry_scores.get(entry_index, 0.0) for entry_index in range(start_index, end_index + 1)
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
        "matched_entry_count": sum(len(index.get(keyword, [])) for keyword in query_keywords),
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
            seconds = max(0, parse_clock(token))
        except (TypeError, ValueError):
            continue

        if seconds in seconds_list:
            continue
        seconds_list.append(seconds)
    return seconds_list
