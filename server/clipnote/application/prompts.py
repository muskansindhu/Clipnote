"""Prompt templates for the LLM-backed features."""

from __future__ import annotations

from clipnote.constants import (
    CLIPCHAT_SYSTEM_PROMPT_TEMPLATE,
)


def transcript_user_prompt(transcript: str) -> str:
    """Build the user prompt for the summary flows."""
    return f"Transcript:\n{transcript}"


def ai_note_user_prompt(transcript_chunk: str) -> str:
    """Build the user prompt for AI note generation."""
    return f"Transcript snippet:\n{transcript_chunk}"


def clipchat_system_prompt(*, title: str, transcript: str) -> str:
    """Build the Clipchat system prompt."""
    return CLIPCHAT_SYSTEM_PROMPT_TEMPLATE.format(title=title, transcript=transcript)
