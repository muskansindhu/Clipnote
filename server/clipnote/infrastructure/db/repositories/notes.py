"""Postgres implementation of the note repository."""

from __future__ import annotations

from datetime import datetime

from clipnote.domain import (
    EnrichmentStatus,
    NewNote,
    Note,
    NoteSource,
    NoteType,
    format_clock,
)
from clipnote.infrastructure.db.connection import Database, Row

_COLUMNS = (
    "id, user_id, video_id, note, timestamp_seconds, note_source, note_type, status, "
    "created_at, updated_at"
)


def _to_note(row: Row) -> Note:
    return Note(
        id=row["id"],
        user_id=row["user_id"],
        video_id=row["video_id"],
        text=row["note"],
        timestamp_seconds=row["timestamp_seconds"],
        source=NoteSource(row["note_source"] or NoteSource.USER),
        note_type=NoteType(row["note_type"]),
        status=EnrichmentStatus(row["status"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class PostgresNoteRepository:
    """Notes stored in the ``notes`` table."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def add(self, note: NewNote) -> Note:
        seconds = note.timestamp_seconds
        with self._db.connection() as conn:
            row = conn.execute(
                f"""
                INSERT INTO notes (
                    video_timestamp, timestamp_seconds, note, note_source, note_type,
                    status, video_id, user_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING {_COLUMNS}
                """,
                (
                    format_clock(seconds) if seconds is not None else None,
                    seconds,
                    note.text,
                    note.source.value,
                    note.note_type.value,
                    note.status.value,
                    note.video_id,
                    note.user_id,
                ),
            ).fetchone()
        assert row is not None  # noqa: S101  # RETURNING always yields a row
        return _to_note(row)

    def get_by_id(self, note_id: int) -> Note | None:
        with self._db.connection() as conn:
            row = conn.execute(f"SELECT {_COLUMNS} FROM notes WHERE id = %s", (note_id,)).fetchone()
        return _to_note(row) if row else None

    def list_for_video(self, user_id: str, video_id: str) -> list[Note]:
        with self._db.connection() as conn:
            rows = conn.execute(
                f"""
                SELECT {_COLUMNS} FROM notes
                WHERE user_id = %s AND video_id = %s
                ORDER BY created_at, id
                """,
                (user_id, video_id),
            ).fetchall()
        return [_to_note(row) for row in rows]

    def list_for_user(self, user_id: str, *, since: datetime | None = None) -> list[Note]:
        with self._db.connection() as conn:
            rows = conn.execute(
                f"""
                SELECT {_COLUMNS} FROM notes
                WHERE user_id = %s AND (%s::timestamptz IS NULL OR created_at >= %s)
                ORDER BY video_id, timestamp_seconds NULLS LAST, id
                """,
                (user_id, since, since),
            ).fetchall()
        return [_to_note(row) for row in rows]

    def update_text(self, user_id: str, note_id: int, text: str) -> bool:
        with self._db.connection() as conn:
            cur = conn.execute(
                """
                UPDATE notes
                SET note = %s,
                    status = CASE WHEN status = 'failed' AND %s <> '' THEN 'ready' ELSE status END,
                    updated_at = now()
                WHERE id = %s AND user_id = %s
                """,
                (text, text, note_id, user_id),
            )
        return cur.rowcount > 0

    def update_text_at(self, user_id: str, video_id: str, seconds: int, text: str) -> int:
        with self._db.connection() as conn:
            cur = conn.execute(
                """
                UPDATE notes SET note = %s, updated_at = now()
                WHERE user_id = %s AND video_id = %s AND timestamp_seconds = %s
                """,
                (text, user_id, video_id, seconds),
            )
        return cur.rowcount

    def delete(self, user_id: str, note_id: int) -> bool:
        with self._db.connection() as conn:
            cur = conn.execute(
                "DELETE FROM notes WHERE id = %s AND user_id = %s", (note_id, user_id)
            )
        return cur.rowcount > 0

    def delete_at(self, user_id: str, video_id: str, seconds: int) -> int:
        with self._db.connection() as conn:
            cur = conn.execute(
                """
                DELETE FROM notes
                WHERE user_id = %s AND video_id = %s AND timestamp_seconds = %s
                """,
                (user_id, video_id, seconds),
            )
        return cur.rowcount

    def delete_for_video(self, user_id: str, video_id: str) -> int:
        with self._db.connection() as conn:
            cur = conn.execute(
                "DELETE FROM notes WHERE user_id = %s AND video_id = %s", (user_id, video_id)
            )
        return cur.rowcount

    def find_recent_duplicate(
        self,
        *,
        user_id: str,
        video_id: str,
        seconds: int | None,
        text: str | None,
        within_seconds: int,
    ) -> Note | None:
        with self._db.connection() as conn:
            row = conn.execute(
                f"""
                SELECT {_COLUMNS} FROM notes
                WHERE user_id = %s AND video_id = %s
                  AND timestamp_seconds IS NOT DISTINCT FROM %s
                  AND note IS NOT DISTINCT FROM %s
                  AND created_at > now() - make_interval(secs => %s)
                ORDER BY id DESC
                LIMIT 1
                """,
                (user_id, video_id, seconds, text, within_seconds),
            ).fetchone()
        return _to_note(row) if row else None

    def complete_enrichment(
        self,
        note_id: int,
        *,
        status: EnrichmentStatus,
        text: str | None = None,
        source: NoteSource | None = None,
    ) -> None:
        with self._db.connection() as conn:
            conn.execute(
                """
                UPDATE notes
                SET status = %s,
                    note = COALESCE(%s, note),
                    note_source = COALESCE(%s, note_source),
                    updated_at = now()
                WHERE id = %s
                """,
                (status.value, text, source.value if source else None, note_id),
            )

    def list_pending(self, limit: int) -> list[Note]:
        with self._db.connection() as conn:
            rows = conn.execute(
                f"SELECT {_COLUMNS} FROM notes WHERE status = 'pending' ORDER BY id LIMIT %s",
                (limit,),
            ).fetchall()
        return [_to_note(row) for row in rows]
