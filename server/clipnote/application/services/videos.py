"""Video-level use cases: bullet summaries."""

from __future__ import annotations

from clipnote.application import prompts
from clipnote.application.ports import AiBudget, LanguageModel
from clipnote.application.services.ai_budget import spend_ai_call
from clipnote.application.services.transcripts import TranscriptService
from clipnote.constants import SUMMARY_SYSTEM_PROMPT
from clipnote.domain import NotFoundError, transcript_text


class VideoService:
    """Summaries of a video's transcript."""

    def __init__(
        self, transcripts: TranscriptService, llm: LanguageModel, budget: AiBudget
    ) -> None:
        self._budget = budget
        self._transcripts = transcripts
        self._llm = llm

    def bullet_summary(self, user_id: str, video_id: str) -> str:
        """Summarise a video as five bullet points.

        Raises:
            NotFoundError: If no transcript is available for the video.
            RateLimitError: If the user has used today's AI allowance.
        """
        entries = self._transcripts.get_or_fetch(video_id)
        if not entries:
            raise NotFoundError("Transcript not available for this video")
        spend_ai_call(self._budget, user_id)
        return self._llm.complete_text(
            system=SUMMARY_SYSTEM_PROMPT,
            user=prompts.transcript_user_prompt(transcript_text(entries)),
        )
