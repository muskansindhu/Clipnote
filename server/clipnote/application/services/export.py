"""Markdown export of notes, for Obsidian, Notion and plain text."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import UTC, date, datetime

from clipnote.application.ports import NoteRepository, VideoRepository
from clipnote.domain import Note, NoteType, NotFoundError, Video, timestamp_url

_TYPE_MARKERS = {
    NoteType.NOTE: "",
    NoteType.IDEA: "💡 ",
    NoteType.QUESTION: "❓ ",
    NoteType.KEY_POINT: "⭐ ",
    NoteType.TODO: "✅ ",
}


class ExportService:
    """Renders a user's notes as Markdown with a seek link on every note."""

    def __init__(self, notes: NoteRepository, videos: VideoRepository) -> None:
        self._notes = notes
        self._videos = videos

    def export_video(self, user_id: str, video_id: str) -> tuple[str, str]:
        """Render one video's notes.

        Returns:
            ``(file_name, markdown)``.

        Raises:
            NotFoundError: If the video is unknown or the user has no notes on it.
        """
        video = self._videos.get(video_id)
        notes = self._notes.list_for_video(user_id, video_id)
        if video is None or not notes:
            raise NotFoundError("No notes found for this video")
        body = _render_video(video, notes, with_frontmatter=True)
        return f"{_slug(video.title)}.md", body

    def export_all(self, user_id: str, *, since: date | None = None) -> tuple[str, str]:
        """Render every video the user has notes on, optionally only newer notes.

        Returns:
            ``(file_name, markdown)``.

        Raises:
            NotFoundError: If there is nothing to export.
        """
        since_dt = None if since is None else _start_of_day(since)
        notes = self._notes.list_for_user(user_id, since=since_dt)
        if not notes:
            raise NotFoundError("No notes to export")
        by_video: dict[str, list[Note]] = defaultdict(list)
        for note in notes:
            by_video[note.video_id].append(note)
        videos = self._videos.get_many(list(by_video))
        sections = [
            _render_video(videos[video_id], video_notes, with_frontmatter=False)
            for video_id, video_notes in by_video.items()
            if video_id in videos
        ]
        return f"clipnote-export-{_today()}.md", "\n\n".join(sections)


def _start_of_day(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=UTC)


def _today() -> str:
    return datetime.now(UTC).date().isoformat()


def _render_video(video: Video, notes: list[Note], *, with_frontmatter: bool) -> str:
    lines: list[str] = []
    if with_frontmatter:
        lines += [
            "---",
            f"title: {json.dumps(video.title, ensure_ascii=False)}",
            f"source: {json.dumps(video.url)}",
            f"exported: {_today()}",
            "---",
            "",
        ]
    lines += [f"# {video.title}", "", f"Source: {video.url}", ""]
    if video.summary:
        lines += [f"> {video.summary.strip()}".replace("\n", "\n> "), ""]

    timed = sorted(
        (note for note in notes if note.timestamp_seconds is not None),
        key=lambda note: (note.timestamp_seconds or 0, note.id),
    )
    untimed = [note for note in notes if note.timestamp_seconds is None]

    for note in timed:
        link = timestamp_url(note.video_id, note.timestamp_seconds)
        lines.append(f"- [{note.display_time}]({link}) {_note_line(note)}")
    if untimed:
        if timed:
            lines.append("")
        lines += ["## Video notes", ""]
        lines += [f"- {_note_line(note)}" for note in untimed]
    return "\n".join(lines).rstrip() + "\n"


def _note_line(note: Note) -> str:
    text = (note.text or "").strip() or "(note still being written)"
    return _TYPE_MARKERS[note.note_type] + " ".join(text.splitlines())


def _slug(title: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in " -_" else "" for char in title)
    return "-".join(cleaned.split()).strip("-").lower()[:80] or "clipnote"
