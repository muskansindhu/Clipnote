"""Migration behaviour against a real Postgres."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import psycopg
import pytest

from clipnote.constants import MIGRATIONS_DIR
from clipnote.infrastructure.db.migrate import apply_migrations

pytestmark = pytest.mark.integration


def _migrations_up_to(tmp_path: Path, *versions: str) -> Path:
    """A directory holding only the named migrations, to stop a database part-way."""
    target = tmp_path / "_".join(versions)
    target.mkdir()
    for version in versions:
        (target / f"{version}.sql").write_text((MIGRATIONS_DIR / f"{version}.sql").read_text())
    return target


def test_apply_migrations_is_idempotent(make_database: Callable[[], str]) -> None:
    url = make_database()

    first = apply_migrations(url)
    second = apply_migrations(url)

    assert first == ["0001_baseline", "0002_capture_features", "0003_drop_user_video"]
    assert second == []


def test_0002_backfills_seconds_and_per_user_favourites(
    make_database: Callable[[], str], tmp_path: Path
) -> None:
    url = make_database()
    apply_migrations(url, _migrations_up_to(tmp_path, "0001_baseline"))

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

    apply_migrations(url, _migrations_up_to(tmp_path, "0001_baseline", "0002_capture_features"))

    with psycopg.connect(url) as conn:
        seconds = dict(conn.execute("SELECT note, timestamp_seconds FROM notes").fetchall())
        favourites = conn.execute(
            "SELECT user_id, video_id FROM user_video WHERE fav ORDER BY 1, 2"
        ).fetchall()

    assert seconds == {"a": 83, "b": 3723, "c": 45, "d": 13, "e": None, "f": None}
    assert favourites == [("alice", "vid1")]


def test_0003_drops_user_video_and_keeps_everything_else(
    make_database: Callable[[], str], tmp_path: Path
) -> None:
    url = make_database()
    apply_migrations(url, _migrations_up_to(tmp_path, "0001_baseline", "0002_capture_features"))
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("INSERT INTO video (id) VALUES ('vid1')")
        conn.execute(
            "INSERT INTO user_video (user_id, video_id, fav) VALUES ('alice', 'vid1', true)"
        )
        conn.execute(
            "INSERT INTO notes (video_timestamp, note, video_id, user_id) "
            "VALUES ('1:00', 'keep me', 'vid1', 'alice')"
        )

    applied = apply_migrations(url)

    with psycopg.connect(url) as conn:
        table = conn.execute("SELECT to_regclass('user_video')").fetchone()
        notes = conn.execute("SELECT note FROM notes").fetchall()
        videos = conn.execute("SELECT id FROM video").fetchall()
    assert applied == ["0003_drop_user_video"]
    assert table == (None,)
    assert notes == [("keep me",)] and videos == [("vid1",)]
