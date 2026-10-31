"""Postgres implementation of the video repository."""

from __future__ import annotations

from collections.abc import Sequence

from clipnote.domain import Video, watch_url
from clipnote.infrastructure.db.connection import Database, Row

DEFAULT_TITLE = "YouTube video"


def _to_video(row: Row) -> Video:
    return Video(
        id=row["id"],
        url=row["video_url"] or watch_url(row["id"]),
        title=row["video_title"] or DEFAULT_TITLE,
        summary=row["video_summary"] or None,
    )


class PostgresVideoRepository:
    """Videos stored in the ``video`` table."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def get(self, video_id: str) -> Video | None:
        with self._db.connection() as conn:
            row = conn.execute(
                "SELECT id, video_url, video_title, video_summary FROM video WHERE id = %s",
                (video_id,),
            ).fetchone()
        return _to_video(row) if row else None

    def get_many(self, video_ids: Sequence[str]) -> dict[str, Video]:
        if not video_ids:
            return {}
        with self._db.connection() as conn:
            rows = conn.execute(
                "SELECT id, video_url, video_title, video_summary FROM video WHERE id = ANY(%s)",
                (list(video_ids),),
            ).fetchall()
        return {row["id"]: _to_video(row) for row in rows}

    def add_if_missing(self, *, video_id: str, url: str, title: str, owner_id: str) -> None:
        with self._db.connection() as conn:
            conn.execute(
                """
                INSERT INTO video (id, video_url, video_title, user_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (video_id, url, title, owner_id),
            )

    def set_title(self, video_id: str, title: str) -> None:
        with self._db.connection() as conn:
            conn.execute("UPDATE video SET video_title = %s WHERE id = %s", (title, video_id))

    def set_summary_if_empty(self, video_id: str, summary: str) -> None:
        with self._db.connection() as conn:
            conn.execute(
                """
                UPDATE video SET video_summary = %s
                WHERE id = %s AND (video_summary IS NULL OR video_summary = '')
                """,
                (summary, video_id),
            )
