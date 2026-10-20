"""Postgres implementation of the label repository."""

from __future__ import annotations

from psycopg.errors import ForeignKeyViolation

from clipnote.domain import Label, NotFoundError
from clipnote.infrastructure.db.connection import Database, Row


def _to_label(row: Row) -> Label:
    return Label(id=row["id"], user_id=row["user_id"], name=row["label_name"])


class PostgresLabelRepository:
    """Labels and their video assignments, always scoped to one user."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def list_for_user(self, user_id: str) -> list[Label]:
        with self._db.connection() as conn:
            rows = conn.execute(
                "SELECT id, label_name, user_id FROM label WHERE user_id = %s ORDER BY id",
                (user_id,),
            ).fetchall()
        return [_to_label(row) for row in rows]

    def get_by_name(self, user_id: str, name: str) -> Label | None:
        with self._db.connection() as conn:
            row = conn.execute(
                "SELECT id, label_name, user_id FROM label WHERE user_id = %s AND label_name = %s",
                (user_id, name),
            ).fetchone()
        return _to_label(row) if row else None

    def add(self, user_id: str, name: str) -> Label:
        with self._db.connection() as conn:
            row = conn.execute(
                """
                INSERT INTO label (label_name, user_id) VALUES (%s, %s)
                RETURNING id, label_name, user_id
                """,
                (name, user_id),
            ).fetchone()
        assert row is not None  # noqa: S101  # RETURNING always yields a row
        return _to_label(row)

    def rename(self, user_id: str, label_id: int, name: str) -> bool:
        with self._db.connection() as conn:
            cur = conn.execute(
                "UPDATE label SET label_name = %s WHERE id = %s AND user_id = %s",
                (name, label_id, user_id),
            )
        return cur.rowcount > 0

    def delete(self, user_id: str, label_id: int) -> bool:
        with self._db.connection() as conn:
            owned = conn.execute(
                "SELECT 1 FROM label WHERE id = %s AND user_id = %s", (label_id, user_id)
            ).fetchone()
            if owned is None:
                return False
            conn.execute("DELETE FROM video_label WHERE label_id = %s", (label_id,))
            conn.execute("DELETE FROM label WHERE id = %s", (label_id,))
        return True

    def assign(self, user_id: str, label_id: int, video_id: str) -> None:
        try:
            with self._db.connection() as conn:
                conn.execute(
                    """
                    INSERT INTO video_label (label_id, yt_video_id)
                    SELECT l.id, %s FROM label l WHERE l.id = %s AND l.user_id = %s
                    ON CONFLICT DO NOTHING
                    """,
                    (video_id, label_id, user_id),
                )
        except ForeignKeyViolation as exc:
            raise NotFoundError("Video not found") from exc

    def unassign_all(self, user_id: str, video_id: str) -> None:
        with self._db.connection() as conn:
            conn.execute(
                """
                DELETE FROM video_label vl USING label l
                WHERE vl.label_id = l.id AND l.user_id = %s AND vl.yt_video_id = %s
                """,
                (user_id, video_id),
            )

    def name_for_video(self, user_id: str, video_id: str) -> str | None:
        with self._db.connection() as conn:
            row = conn.execute(
                """
                SELECT l.label_name FROM video_label vl
                JOIN label l ON l.id = vl.label_id
                WHERE vl.yt_video_id = %s AND l.user_id = %s
                ORDER BY l.id
                LIMIT 1
                """,
                (video_id, user_id),
            ).fetchone()
        return row["label_name"] if row else None
