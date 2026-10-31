"""Repositories against a real, freshly migrated Postgres."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from clipnote.domain import (
    EnrichmentStatus,
    NewNote,
    NoteSource,
    NoteType,
    NotFoundError,
)
from clipnote.infrastructure.db import (
    Database,
    PostgresApiTokenRepository,
    PostgresLabelRepository,
    PostgresLibraryRepository,
    PostgresNoteRepository,
    PostgresUserRepository,
    PostgresVideoRepository,
)

pytestmark = pytest.mark.integration

VID_A, VID_B = "aaaaaaaaaaa", "bbbbbbbbbbb"


@pytest.fixture
def db(database_url: str) -> Database:
    return Database(database_url)


@pytest.fixture
def videos(db: Database) -> PostgresVideoRepository:
    repo = PostgresVideoRepository(db)
    repo.add_if_missing(video_id=VID_A, url="https://u/a", title="Alpha Talk", owner_id="alice")
    repo.add_if_missing(video_id=VID_B, url="https://u/b", title="100% Beta_Test", owner_id="alice")
    return repo


def _new(user: str, video: str, seconds: int | None, text: str | None = "t") -> NewNote:
    return NewNote(
        user_id=user,
        video_id=video,
        text=text,
        timestamp_seconds=seconds,
        source=NoteSource.USER if text else NoteSource.AI,
        note_type=NoteType.NOTE,
        status=EnrichmentStatus.READY if text else EnrichmentStatus.PENDING,
    )


def test_users_round_trip_and_case_insensitive_email(db: Database) -> None:
    users = PostgresUserRepository(db)
    user = users.add(username="muskan", email="M@Example.com", password_hash="h", google_sub=None)

    assert users.get_by_id(user.id) == user
    assert users.get_by_email("m@example.COM") == user
    assert users.get_by_google_sub("nope") is None
    assert users.username_exists("muskan")
    assert not users.username_exists("muskan", exclude_user_id=user.id)

    users.set_google_sub(user.id, "sub-1")
    users.set_credentials(user.id, username="renamed", email="new@example.com", password_hash="h2")
    users.set_password_hash(user.id, "h3")
    updated = users.get_by_google_sub("sub-1")
    assert updated is not None
    assert (updated.username, updated.email, updated.password_hash) == (
        "renamed",
        "new@example.com",
        "h3",
    )


def test_videos_summary_is_only_set_when_empty(videos: PostgresVideoRepository) -> None:
    videos.set_summary_if_empty(VID_A, "first")
    videos.set_summary_if_empty(VID_A, "second")
    videos.add_if_missing(video_id=VID_A, url="x", title="ignored", owner_id="bob")

    video = videos.get(VID_A)
    assert video is not None
    assert (video.summary, video.title) == ("first", "Alpha Talk")
    assert set(videos.get_many([VID_A, VID_B, "missing"])) == {VID_A, VID_B}
    assert videos.get_many([]) == {}
    videos.set_title(VID_A, "Renamed")
    assert videos.get(VID_A).title == "Renamed"  # type: ignore[union-attr]


def test_notes_are_stored_scoped_per_user_and_mirror_the_legacy_timestamp(
    db: Database, videos: PostgresVideoRepository
) -> None:
    notes = PostgresNoteRepository(db)
    mine = notes.add(_new("alice", VID_A, 3723, "mine"))
    notes.add(_new("bob", VID_A, 5, "theirs"))
    video_level = notes.add(_new("alice", VID_A, None, "whole video"))

    assert mine.display_time == "1:02:03"
    assert [n.text for n in notes.list_for_video("alice", VID_A)] == ["mine", "whole video"]
    assert video_level.timestamp_seconds is None
    with db.connection() as conn:
        legacy = conn.execute(
            "SELECT video_timestamp FROM notes WHERE id = %s", (mine.id,)
        ).fetchone()
    assert legacy == {"video_timestamp": "1:02:03"}


def test_notes_update_and_delete_cannot_cross_users(
    db: Database, videos: PostgresVideoRepository
) -> None:
    notes = PostgresNoteRepository(db)
    note = notes.add(_new("alice", VID_A, 10, "original"))

    assert not notes.update_text("bob", note.id, "hijack")
    assert not notes.delete("bob", note.id)
    assert notes.update_text("alice", note.id, "edited")
    assert notes.update_text_at("alice", VID_A, 10, "by time") == 1
    assert notes.get_by_id(note.id).text == "by time"  # type: ignore[union-attr]
    assert notes.delete_at("bob", VID_A, 10) == 0
    assert notes.delete_at("alice", VID_A, 10) == 1
    assert notes.get_by_id(note.id) is None


def test_editing_a_failed_note_marks_it_ready(
    db: Database, videos: PostgresVideoRepository
) -> None:
    notes = PostgresNoteRepository(db)
    note = notes.add(_new("alice", VID_A, 10, None))
    notes.complete_enrichment(note.id, status=EnrichmentStatus.FAILED)

    notes.update_text("alice", note.id, "written by hand")

    assert notes.get_by_id(note.id).status is EnrichmentStatus.READY  # type: ignore[union-attr]


def test_find_recent_duplicate_matches_nulls_and_respects_the_window(
    db: Database, videos: PostgresVideoRepository
) -> None:
    notes = PostgresNoteRepository(db)
    stored = notes.add(_new("alice", VID_A, None, None))

    def find(**overrides: object) -> object:
        params: dict[str, object] = {
            "user_id": "alice",
            "video_id": VID_A,
            "seconds": None,
            "text": None,
            "within_seconds": 60,
        }
        params.update(overrides)
        return notes.find_recent_duplicate(**params)  # type: ignore[arg-type]

    assert find().id == stored.id  # type: ignore[attr-defined]
    assert find(seconds=5) is None
    assert find(text="x") is None
    assert find(user_id="bob") is None
    with db.connection() as conn:
        conn.execute("UPDATE notes SET created_at = now() - interval '2 minutes'")
    assert find() is None


def test_complete_enrichment_and_pending_recovery(
    db: Database, videos: PostgresVideoRepository
) -> None:
    notes = PostgresNoteRepository(db)
    pending = notes.add(_new("alice", VID_A, 10, None))
    notes.add(_new("alice", VID_A, 20, "ready already"))

    assert [n.id for n in notes.list_pending(10)] == [pending.id]

    notes.complete_enrichment(
        pending.id, status=EnrichmentStatus.READY, text="ai text", source=NoteSource.AI
    )
    done = notes.get_by_id(pending.id)
    assert done is not None
    assert (done.text, done.source, done.status) == (
        "ai text",
        NoteSource.AI,
        EnrichmentStatus.READY,
    )
    assert notes.list_pending(10) == []


def test_list_for_user_filters_by_date_and_orders_untimed_last(
    db: Database, videos: PostgresVideoRepository
) -> None:
    notes = PostgresNoteRepository(db)
    notes.add(_new("alice", VID_A, None, "untimed"))
    notes.add(_new("alice", VID_A, 30, "later"))
    notes.add(_new("alice", VID_A, 5, "early"))

    assert [n.text for n in notes.list_for_user("alice")] == ["early", "later", "untimed"]
    future = datetime.now(UTC) + timedelta(days=1)
    assert notes.list_for_user("alice", since=future) == []


def test_library_listing_search_labels_dates_and_per_user_favourites(
    db: Database, videos: PostgresVideoRepository
) -> None:
    notes, library = PostgresNoteRepository(db), PostgresLibraryRepository(db)
    labels = PostgresLabelRepository(db)
    notes.add(_new("alice", VID_A, 1))
    notes.add(_new("alice", VID_B, 1))
    notes.add(_new("bob", VID_A, 1))
    label = labels.add("alice", "ml")
    labels.assign("alice", label.id, VID_B)
    library.set_favourite("alice", VID_A, True)

    def listing(**overrides: object) -> list[tuple[str, bool]]:
        params: dict[str, object] = {
            "user_id": "alice",
            "search": "",
            "label_names": [],
            "sort": "recent",
            "start": None,
            "end": None,
            "limit": 10,
            "offset": 0,
        }
        params.update(overrides)
        return [(v.id, v.fav) for v in library.list_videos(**params)]  # type: ignore[arg-type]

    assert listing(sort="title") == [(VID_B, False), (VID_A, True)]
    assert listing(search="alpha") == [(VID_A, True)]
    assert listing(search="100%") == [(VID_B, False)]
    assert listing(search="%") == [(VID_B, False)]
    assert listing(search="_") == [(VID_B, False)]
    assert listing(label_names=["ml"]) == [(VID_B, False)]
    assert listing(label_names=["other"]) == []
    assert listing(user_id="bob") == [(VID_A, False)]
    assert listing(start=datetime.now(UTC) + timedelta(days=1)) == []
    assert listing(limit=1, offset=1) != listing(limit=1, offset=0)
    assert library.is_favourite("alice", VID_A)
    assert not library.is_favourite("bob", VID_A)
    library.set_favourite("alice", VID_A, False)
    assert not library.is_favourite("alice", VID_A)
    assert library.find_video_id_by_title("alice", "Alpha Talk") == VID_A
    assert library.find_video_id_by_title("bob", "100% Beta_Test") is None


def test_labels_are_user_scoped_and_assignment_is_idempotent(
    db: Database, videos: PostgresVideoRepository
) -> None:
    labels, library = PostgresLabelRepository(db), PostgresLibraryRepository(db)
    PostgresNoteRepository(db).add(_new("alice", VID_A, 1))
    mine, theirs = labels.add("alice", "ml"), labels.add("bob", "ml")

    labels.assign("alice", mine.id, VID_A)
    labels.assign("alice", mine.id, VID_A)
    labels.assign("alice", theirs.id, VID_A)  # not alice's label: silently ignored

    assert labels.name_for_video("alice", VID_A) == "ml"
    assert labels.name_for_video("bob", VID_A) is None
    assert [v.id for v in library.list_by_label("alice", "ml") or []] == [VID_A]
    assert library.list_by_label("alice", "missing") is None
    with pytest.raises(NotFoundError, match="Video not found"):
        labels.assign("alice", mine.id, "zzzzzzzzzzz")

    assert not labels.rename("bob", mine.id, "x")
    assert labels.rename("alice", mine.id, "deep-learning")
    labels.unassign_all("bob", VID_A)
    assert labels.name_for_video("alice", VID_A) == "deep-learning"
    assert not labels.delete("bob", mine.id)
    assert labels.delete("alice", mine.id)
    assert labels.name_for_video("alice", VID_A) is None
    assert labels.get_by_name("alice", "deep-learning") is None
    assert [lb.name for lb in labels.list_for_user("bob")] == ["ml"]


def test_api_tokens_round_trip_and_revoke_once(db: Database) -> None:
    tokens = PostgresApiTokenRepository(db)
    token = tokens.add(
        user_id="alice", label="iPhone", scope="capture", token_hash="h1", prefix="cn_abcde"
    )

    assert tokens.get_by_hash("h1") == token
    assert tokens.get_by_hash("nope") is None
    tokens.touch(token.id)
    assert tokens.get_by_hash("h1").last_used_at is not None  # type: ignore[union-attr]
    assert not tokens.revoke("bob", token.id)
    assert tokens.revoke("alice", token.id)
    assert not tokens.revoke("alice", token.id)
    assert tokens.list_for_user("alice")[0].is_active is False
    assert tokens.list_for_user("bob") == []
