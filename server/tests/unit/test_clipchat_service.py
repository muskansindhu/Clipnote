import pytest
from support.world import World

from clipnote.domain import NotFoundError, ValidationError

VID = "dQw4w9WgXcQ"


def test_context_reports_assets_as_pending_without_fetching_anything(world: World) -> None:
    context = world.clipchat.context("alice", VID)

    assert context.asset_status == {"transcript": "pending", "summary": "pending"}
    assert context.title == "Fetched Title"
    assert context.url == f"https://www.youtube.com/watch?v={VID}"
    assert world.provider.calls == []


def test_context_includes_the_users_notes_and_favourite_flag(world: World) -> None:
    world.note_service.create_note("alice", video_id=VID, title="T", text="mine", seconds=5)
    world.note_service.set_favourite("alice", video_id=VID, fav=True)

    context = world.clipchat.context("alice", VID)

    assert [n.text for n in context.notes] == ["mine"]
    assert context.fav is True
    assert world.clipchat.context("bob", VID).notes == []


def test_context_persists_a_better_title_for_known_videos(world: World) -> None:
    world.videos.add_if_missing(video_id=VID, url="u", title="YouTube video", owner_id="alice")

    world.clipchat.context("alice", VID)

    assert world.videos.rows[VID].title == "Fetched Title"


def test_invalid_video_ids_are_not_found(world: World) -> None:
    with pytest.raises(NotFoundError):
        world.clipchat.context("alice", "../../x")


def test_prepare_fetches_transcript_and_generates_the_summary(world: World) -> None:
    world.videos.add_if_missing(video_id=VID, url="u", title="T", owner_id="alice")

    context = world.clipchat.prepare("alice", VID)

    assert context.asset_status == {"transcript": "ready", "summary": "ready"}
    assert context.summary == "an ai note"
    assert world.videos.rows[VID].summary == "an ai note"


def test_prepare_without_a_transcript_is_not_found(world: World) -> None:
    world.provider._entries = []

    with pytest.raises(NotFoundError, match="Transcript not available"):
        world.clipchat.prepare("alice", VID)


def test_ask_returns_the_model_answer_and_rejects_empty_questions(world: World) -> None:
    world.llm.structured = '{"answer":"**yes** [0:10]"}'

    assert world.clipchat.ask("alice", VID, " what? ") == "**yes** [10]"
    with pytest.raises(ValidationError, match="Question is required"):
        world.clipchat.ask("alice", VID, "   ")
