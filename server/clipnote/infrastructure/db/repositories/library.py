"""Postgres implementation of the library (listing, search, favourites) repository."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from clipnote.domain import VideoListing, watch_url
from clipnote.infrastructure.db.connection import Database, Row
from clipnote.infrastructure.db.repositories.videos import DEFAULT_TITLE

_LIKE_ESCAPES = str.maketrans({"\\": "\\\\", "%": "\\%", "_": "\\_"})


def _to_listing(row: Row) -> VideoListing:
    return VideoListing(
        id=row["id"],
        url=row["video_url"] or watch_url(row["id"]),
        title=row["video_title"] or DEFAULT_TITLE,
        fav=bool(row["fav"]),
    )


class PostgresLibraryRepository:
    """A user's view of videos, joining notes, labels and per-user favourites."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def list_videos(
        self,
        *,
        user_id: str,
        search: str,
        label_names: Sequence[str],
        sort: str,
        start: datetime | None,
        end: datetime | None,
        limit: int,
        offset: int,
    ) -> list[VideoListing]:
        clauses = ["n.user_id = %s"]
        params: list[Any] = [user_id]
        if search:
            clauses.append("v.video_title ILIKE %s")
            params.append(f"%{search.translate(_LIKE_ESCAPES)}%")
        if start is not None:
            clauses.append("n.created_at >= %s")
            params.append(start)
        if end is not None:
            clauses.append("n.created_at < %s")
            params.append(end)
        if label_names:
            clauses.append(
                """EXISTS (
                    SELECT 1 FROM video_label vl
                    JOIN label l ON l.id = vl.label_id
                    WHERE vl.yt_video_id = v.id AND l.user_id = %s AND l.label_name = ANY(%s)
                )"""
            )
            params += [user_id, list(label_names)]
        order_by = "LOWER(v.video_title) ASC" if sort == "title" else "last_note_date DESC"

        query = f"""
            SELECT v.id, v.video_url, v.video_title, COALESCE(uv.fav, false) AS fav,
                   MAX(n.created_at) AS last_note_date
            FROM video v
            JOIN notes n ON n.video_id = v.id
            LEFT JOIN user_video uv ON uv.video_id = v.id AND uv.user_id = n.user_id
            WHERE {" AND ".join(clauses)}
            GROUP BY v.id, v.video_url, v.video_title, uv.fav
            ORDER BY {order_by}
            LIMIT %s OFFSET %s
        """
        with self._db.connection() as conn:
            rows = conn.execute(query, (*params, limit, offset)).fetchall()
        return [_to_listing(row) for row in rows]

    def list_by_label(self, user_id: str, label_name: str) -> list[VideoListing] | None:
        with self._db.connection() as conn:
            label = conn.execute(
                "SELECT id FROM label WHERE label_name = %s AND user_id = %s LIMIT 1",
                (label_name, user_id),
            ).fetchone()
            if label is None:
                return None
            rows = conn.execute(
                """
                SELECT v.id, v.video_url, v.video_title, COALESCE(uv.fav, false) AS fav
                FROM video_label vl
                JOIN video v ON v.id = vl.yt_video_id
                LEFT JOIN user_video uv ON uv.video_id = v.id AND uv.user_id = %s
                WHERE vl.label_id = %s
                """,
                (user_id, label["id"]),
            ).fetchall()
        return [_to_listing(row) for row in rows]

    def set_favourite(self, user_id: str, video_id: str, fav: bool) -> None:
        with self._db.connection() as conn:
            conn.execute(
                """
                INSERT INTO user_video (user_id, video_id, fav) VALUES (%s, %s, %s)
                ON CONFLICT (user_id, video_id) DO UPDATE SET fav = EXCLUDED.fav
                """,
                (user_id, video_id, fav),
            )

    def is_favourite(self, user_id: str, video_id: str) -> bool:
        with self._db.connection() as conn:
            row = conn.execute(
                "SELECT fav FROM user_video WHERE user_id = %s AND video_id = %s",
                (user_id, video_id),
            ).fetchone()
        return bool(row and row["fav"])

    def find_video_id_by_title(self, user_id: str, title: str) -> str | None:
        with self._db.connection() as conn:
            row = conn.execute(
                """
                SELECT v.id FROM video v
                JOIN notes n ON n.video_id = v.id
                WHERE n.user_id = %s AND v.video_title = %s
                LIMIT 1
                """,
                (user_id, title),
            ).fetchone()
        return row["id"] if row else None
