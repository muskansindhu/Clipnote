"""Video-level use cases: bullet summaries."""

from __future__ import annotations

from clipnote.application import prompts
from clipnote.application.ports import LanguageModel
from clipnote.application.services.transcripts import TranscriptService
from clipnote.domain import NotFoundError, transcript_text


class VideoService:
    """Summaries of a video's transcript."""

    def __init__(self, transcripts: TranscriptService, llm: LanguageModel) -> None:
        self._transcripts = transcripts
        self._llm = llm

    def bullet_summary(self, video_id: str) -> str:
        """Summarise a video as five bullet points.

        Raises:
            NotFoundError: If no transcript is available for the video.
        """
        entries = self._transcripts.get_or_fetch(video_id)
        if not entries:
            raise NotFoundError("Transcript not available for this video")
        return self._llm.complete_text(
            system=prompts.SUMMARY_SYSTEM_PROMPT,
            user=prompts.transcript_user_prompt(transcript_text(entries)),
        )
