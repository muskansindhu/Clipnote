"""Postgres implementation of the library (listing, search, favourites) repository."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from clipnote.constants import DEFAULT_VIDEO_TITLE, STATS_WINDOW_DAYS
from clipnote.domain import LibraryStats, VideoListing, watch_url
from clipnote.infrastructure.db.connection import Database, Row

_LIKE_ESCAPES = str.maketrans({"\\": "\\\\", "%": "\\%", "_": "\\_"})


def _to_listing(row: Row) -> VideoListing:
    return VideoListing(
        id=row["id"],
        url=row["video_url"] or watch_url(row["id"]),
        title=row["video_title"] or DEFAULT_VIDEO_TITLE,
        fav=bool(row["fav"]),
        note_count=int(row.get("note_count") or 0),
        last_note_at=row.get("last_note_at"),
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
        order_by = "LOWER(v.video_title) ASC" if sort == "title" else "last_note_at DESC"

        query = f"""
            SELECT v.id, v.video_url, v.video_title, COALESCE(uv.fav, false) AS fav,
                   COUNT(n.id) AS note_count, MAX(n.created_at) AS last_note_at
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
                SELECT v.id, v.video_url, v.video_title, COALESCE(uv.fav, false) AS fav,
                       (SELECT COUNT(*) FROM notes n
                        WHERE n.video_id = v.id AND n.user_id = %s) AS note_count,
                       (SELECT MAX(n.created_at) FROM notes n
                        WHERE n.video_id = v.id AND n.user_id = %s) AS last_note_at
                FROM video_label vl
                JOIN video v ON v.id = vl.yt_video_id
                LEFT JOIN user_video uv ON uv.video_id = v.id AND uv.user_id = %s
                WHERE vl.label_id = %s
                """,
                (user_id, user_id, user_id, label["id"]),
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

    def stats(self, user_id: str) -> LibraryStats:
        with self._db.connection() as conn:
            row = conn.execute(
                """
                SELECT
                  (SELECT COUNT(DISTINCT video_id) FROM notes WHERE user_id = %(u)s) AS videos,
                  (SELECT COUNT(*) FROM notes WHERE user_id = %(u)s) AS notes,
                  (SELECT COUNT(*) FROM notes WHERE user_id = %(u)s
                     AND created_at >= now() - make_interval(days => %(days)s)) AS notes_this_week,
                  (SELECT COUNT(*) FROM user_video WHERE user_id = %(u)s AND fav) AS favourites,
                  (SELECT COUNT(*) FROM notes WHERE user_id = %(u)s
                     AND status = 'pending') AS pending
                """,
                {"u": user_id, "days": STATS_WINDOW_DAYS},
            ).fetchone()
        assert row is not None  # noqa: S101  # an aggregate query always yields a row
        return LibraryStats(
            videos=row["videos"],
            notes=row["notes"],
            notes_this_week=row["notes_this_week"],
            favourites=row["favourites"],
            pending=row["pending"],
        )

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
