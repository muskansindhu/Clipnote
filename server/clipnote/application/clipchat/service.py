"""Chat with a video: context loading, asset preparation and question answering."""

from __future__ import annotations

from dataclasses import dataclass, field

from clipnote.application import prompts
from clipnote.application.clipchat.engine import answer_question
from clipnote.application.ports import (
    LanguageModel,
    LibraryRepository,
    NoteRepository,
    VideoMetadataProvider,
    VideoRepository,
)
from clipnote.application.services.transcripts import TranscriptService
from clipnote.constants import (
    DEFAULT_VIDEO_TITLE,
    VIDEO_SUMMARY_SYSTEM_PROMPT,
)
from clipnote.domain import (
    Note,
    NotFoundError,
    TranscriptEntry,
    ValidationError,
    is_valid_video_id,
    transcript_text,
    watch_url,
)


@dataclass(frozen=True, slots=True)
class ClipchatContext:
    """Everything the Clipchat page needs to know about a video."""

    video_id: str
    url: str
    title: str
    summary: str | None
    fav: bool
    notes: list[Note]
    asset_status: dict[str, str] = field(default_factory=dict)


class ClipchatService:
    """Use cases for the Clipchat page."""

    def __init__(
        self,
        *,
        videos: VideoRepository,
        notes: NoteRepository,
        library: LibraryRepository,
        transcripts: TranscriptService,
        llm: LanguageModel,
        metadata: VideoMetadataProvider,
    ) -> None:
        self._videos = videos
        self._notes = notes
        self._library = library
        self._transcripts = transcripts
        self._llm = llm
        self._metadata = metadata

    def context(self, user_id: str, video_id: str) -> ClipchatContext:
        """Load the video, the user's notes and what is already prepared.

        Raises:
            NotFoundError: If ``video_id`` is not a valid YouTube video id.
        """
        context = self._load(user_id, video_id)
        cached = self._transcripts.cached(video_id)
        status = {
            "transcript": "ready" if cached else "pending",
            "summary": "ready" if (context.summary or "").strip() else "pending",
        }
        return _with_status(context, status)

    def prepare(self, user_id: str, video_id: str) -> ClipchatContext:
        """Fetch the transcript and summary if they are missing.

        Raises:
            NotFoundError: If the id is invalid or no transcript exists for the video.
        """
        context = self._load(user_id, video_id)
        _, status, summary = self._ensure_assets(context)
        return _with_status(_with_summary(context, summary), status)

    def ask(self, user_id: str, video_id: str, question: str) -> str:
        """Answer a question about the video.

        Raises:
            ValidationError: If the question is empty.
            NotFoundError: If the id is invalid or no transcript exists for the video.
            ExternalServiceError: If the model call fails.
        """
        question = question.strip()
        if not question:
            raise ValidationError("Question is required")
        context = self._load(user_id, video_id)
        transcript, _, _ = self._ensure_assets(context)
        response = answer_question(
            self._llm,
            video_title=context.title or DEFAULT_VIDEO_TITLE,
            transcript=transcript,
            question=question,
        )
        return str(response.get("answer", ""))

    def _load(self, user_id: str, video_id: str) -> ClipchatContext:
        if not is_valid_video_id(video_id):
            raise NotFoundError("Video not found")
        video = self._videos.get(video_id)
        title = (video.title if video else "").strip()
        url = (video.url if video else "").strip() or watch_url(video_id)

        if not title or title == DEFAULT_VIDEO_TITLE:
            found = self._metadata.fetch(video_id)
            if found and found.title:
                title = found.title
                if video is not None:
                    self._videos.set_title(video_id, title)
        return ClipchatContext(
            video_id=video_id,
            url=url,
            title=title or DEFAULT_VIDEO_TITLE,
            summary=video.summary if video else None,
            fav=self._library.is_favourite(user_id, video_id),
            notes=self._notes.list_for_video(user_id, video_id),
        )

    def _ensure_assets(
        self, context: ClipchatContext
    ) -> tuple[list[TranscriptEntry], dict[str, str], str | None]:
        transcript = self._transcripts.get_or_fetch(context.video_id)
        if not transcript:
            raise NotFoundError("Transcript not available for this video")
        if context.summary:
            return transcript, {"transcript": "ready", "summary": "ready"}, context.summary

        text = transcript_text(transcript)
        summary = (
            self._llm.complete_text(
                system=VIDEO_SUMMARY_SYSTEM_PROMPT,
                user=prompts.transcript_user_prompt(text),
            )
            if text
            else ""
        )
        if summary and self._videos.get(context.video_id) is not None:
            self._videos.set_summary_if_empty(context.video_id, summary)
        status = {"transcript": "ready", "summary": "ready" if summary else "unavailable"}
        return transcript, status, summary or None


def _with_status(context: ClipchatContext, status: dict[str, str]) -> ClipchatContext:
    return ClipchatContext(
        context.video_id,
        context.url,
        context.title,
        context.summary,
        context.fav,
        context.notes,
        status,
    )


def _with_summary(context: ClipchatContext, summary: str | None) -> ClipchatContext:
    return ClipchatContext(
        context.video_id,
        context.url,
        context.title,
        summary,
        context.fav,
        context.notes,
        context.asset_status,
    )
