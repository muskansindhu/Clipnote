import pytest
from support.world import World

from clipnote.domain import (
    EnrichmentStatus,
    NoteSource,
    NoteType,
    NotFoundError,
    ValidationError,
)

VID = "dQw4w9WgXcQ"


def _create(world: World, user: str = "alice", **overrides):  # type: ignore[no-untyped-def]
    params = {"video_id": VID, "title": "A Talk", "text": "hello", "seconds": 83}
    params.update(overrides)
    return world.note_service.create_note(user, **params)


def test_create_note_saves_before_slow_work_and_marks_pending(world: World) -> None:
    result = _create(world)

    assert result.note.status is EnrichmentStatus.PENDING
    assert result.note.text == "hello"
    assert result.note.source is NoteSource.USER
    assert world.provider.calls == []
    assert len(world.runner.tasks) == 1


def test_create_note_with_text_on_summarised_video_is_ready_without_background_work(
    world: World,
) -> None:
    world.videos.add_if_missing(video_id=VID, url="u", title="t", owner_id="alice")
    world.videos.set_summary_if_empty(VID, "already summarised")

    result = _create(world)

    assert result.note.status is EnrichmentStatus.READY
    assert world.runner.tasks == []


def test_create_note_without_text_is_an_ai_note_and_pending(world: World) -> None:
    result = _create(world, text="   ")

    assert result.note.text is None
    assert result.note.source is NoteSource.AI
    assert result.note.status is EnrichmentStatus.PENDING


def test_create_note_looks_up_title_when_missing(world: World) -> None:
    result = _create(world, title=None)

    assert result.video.title == "Fetched Title"
    assert world.metadata.calls == [VID]


def test_create_note_falls_back_to_default_title(world: World) -> None:
    world.metadata.title = None

    assert _create(world, title="").video.title == "YouTube video"


def test_create_note_returns_recent_duplicate_instead_of_saving_twice(world: World) -> None:
    first = _create(world)
    second = _create(world)

    assert second.duplicate is True
    assert second.note.id == first.note.id
    assert len(world.notes.rows) == 1
    assert len(world.runner.tasks) == 1


def test_create_note_keeps_different_users_notes_apart(world: World) -> None:
    _create(world, user="alice")
    other = _create(world, user="bob")

    assert other.duplicate is False
    assert len(world.notes.rows) == 2


@pytest.mark.parametrize("video_id", ["short", "../../etc/passwd", ""])
def test_create_note_rejects_invalid_video_ids(world: World, video_id: str) -> None:
    with pytest.raises(ValidationError, match="Invalid video id"):
        _create(world, video_id=video_id)


def test_create_note_rejects_negative_timestamp(world: World) -> None:
    with pytest.raises(ValidationError, match="negative"):
        _create(world, seconds=-1)


def test_create_note_supports_video_level_notes_and_types(world: World) -> None:
    result = _create(world, seconds=None, note_type=NoteType.IDEA)

    assert result.note.timestamp_seconds is None
    assert result.note.display_time is None
    assert result.note.note_type is NoteType.IDEA


def test_video_notes_returns_only_the_users_notes(world: World) -> None:
    _create(world, user="alice", text="mine")
    _create(world, user="bob", text="theirs")

    result = world.note_service.video_notes("alice", VID)

    assert [n.text for n in result.notes] == ["mine"]


def test_video_notes_raises_for_unknown_video(world: World) -> None:
    with pytest.raises(NotFoundError):
        world.note_service.video_notes("alice", VID)


def test_update_text_by_id_and_by_clock_time(world: World) -> None:
    note = _create(world, seconds=83).note

    world.note_service.update_text("alice", video_id=VID, text=" by id ", note_id=note.id)
    assert world.notes.rows[note.id].text == "by id"

    world.note_service.update_text("alice", video_id=VID, text="by clock", timestamp="1:23")
    assert world.notes.rows[note.id].text == "by clock"


def test_update_text_cannot_touch_another_users_note(world: World) -> None:
    note = _create(world, user="alice").note

    with pytest.raises(NotFoundError):
        world.note_service.update_text("bob", video_id=VID, text="x", note_id=note.id)


def test_update_and_delete_require_an_identifier(world: World) -> None:
    with pytest.raises(ValidationError):
        world.note_service.update_text("alice", video_id=VID, text="x")
    with pytest.raises(ValidationError, match="Invalid clock string"):
        world.note_service.delete("alice", video_id=VID, timestamp="--:--")


def test_delete_by_id_and_by_clock_time(world: World) -> None:
    first = _create(world, seconds=10, text="a").note
    _create(world, seconds=83, text="b")

    world.note_service.delete("alice", video_id=VID, note_id=first.id)
    world.note_service.delete("alice", video_id=VID, timestamp="1:23")

    assert world.notes.rows == {}
    with pytest.raises(NotFoundError):
        world.note_service.delete("alice", video_id=VID, note_id=first.id)


def test_favourites_are_per_user(world: World) -> None:
    _create(world, user="alice")
    _create(world, user="bob")

    world.note_service.set_favourite("alice", video_id=VID, fav=True)

    assert world.note_service.video_notes("alice", VID).fav is True
    assert world.note_service.video_notes("bob", VID).fav is False


def test_favourite_by_title_resolves_within_the_users_library(world: World) -> None:
    _create(world, user="alice", title="Same Title")

    world.note_service.set_favourite("alice", video_title="Same Title", fav=True)

    assert world.library.is_favourite("alice", VID)
    with pytest.raises(NotFoundError):
        world.note_service.set_favourite("bob", video_title="Same Title", fav=True)


def test_list_videos_paginates_and_reports_next_page(world: World) -> None:
    for index in range(12):
        video_id = f"video{index:06d}"
        _create(world, video_id=video_id, title=f"Talk {index:02d}")

    first = world.note_service.list_videos("alice", page=1)
    second = world.note_service.list_videos("alice", page=2)

    assert len(first.videos) == 10 and first.has_next
    assert len(second.videos) == 2 and not second.has_next


def test_list_videos_sorts_by_title_and_searches(world: World) -> None:
    _create(world, video_id="video000001", title="Zebra")
    _create(world, video_id="video000002", title="Apple")

    by_title = world.note_service.list_videos("alice", sort="title")
    searched = world.note_service.list_videos("alice", search="zeb")

    assert [v.title for v in by_title.videos] == ["Apple", "Zebra"]
    assert [v.title for v in searched.videos] == ["Zebra"]
