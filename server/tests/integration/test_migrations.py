"""Migration behaviour against a real Postgres."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import psycopg
import pytest

from clipnote.infrastructure.db.migrate import MIGRATIONS_DIR, apply_migrations

pytestmark = pytest.mark.integration


def test_apply_migrations_is_idempotent(make_database: Callable[[], str]) -> None:
    url = make_database()

    first = apply_migrations(url)
    second = apply_migrations(url)

    assert first == ["0001_baseline", "0002_capture_features"]
    assert second == []


def test_0002_backfills_seconds_and_per_user_favourites(
    make_database: Callable[[], str], tmp_path: Path
) -> None:
    url = make_database()
    only_baseline = tmp_path / "baseline"
    only_baseline.mkdir()
    (only_baseline / "0001_baseline.sql").write_text(
        (MIGRATIONS_DIR / "0001_baseline.sql").read_text()
    )
    apply_migrations(url, only_baseline)

    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("INSERT INTO video (id, fav) VALUES ('vid1', true), ('vid2', false)")
        conn.execute(
            """
            INSERT INTO notes (video_timestamp, note, video_id, user_id) VALUES
              ('01:23', 'a', 'vid1', 'alice'),
              ('1:02:03', 'b', 'vid1', 'alice'),
              ('45', 'c', 'vid2', 'bob'),
              ('12.6', 'd', 'vid2', 'bob'),
              ('--:--', 'e', 'vid2', 'bob'),
              (NULL, 'f', 'vid2', 'bob')
            """
        )

    apply_migrations(url)

    with psycopg.connect(url) as conn:
        seconds = dict(conn.execute("SELECT note, timestamp_seconds FROM notes").fetchall())
        favourites = conn.execute(
            "SELECT user_id, video_id FROM user_video WHERE fav ORDER BY 1, 2"
        ).fetchall()

    assert seconds == {"a": 83, "b": 3723, "c": 45, "d": 13, "e": None, "f": None}
    assert favourites == [("alice", "vid1")]
