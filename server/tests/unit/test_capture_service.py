import pytest
from support.world import World

from clipnote.domain import EnrichmentStatus, NoteType, ValidationError

VID = "dQw4w9WgXcQ"


def test_capture_uses_the_time_from_the_share_link(world: World) -> None:
    result = world.capture.capture(
        "alice", url=f"https://youtu.be/{VID}?si=abc&t=754", text="great point"
    )

    assert result.note.timestamp_seconds == 754
    assert result.note.display_time == "12:34"
    assert result.note.text == "great point"
    assert result.video.id == VID


def test_capture_without_a_time_makes_a_video_level_note_and_never_guesses(
    world: World,
) -> None:
    result = world.capture.capture("alice", url=f"https://youtu.be/{VID}", text="later")

    assert result.note.timestamp_seconds is None


def test_capture_with_empty_text_queues_an_ai_note(world: World) -> None:
    result = world.capture.capture("alice", url=f"https://youtu.be/{VID}?t=30")

    assert result.note.status is EnrichmentStatus.PENDING
    assert len(world.runner.tasks) == 1


def test_capture_accepts_a_note_type(world: World) -> None:
    result = world.capture.capture(
        "alice", url=f"https://youtu.be/{VID}?t=5", text="why?", note_type="Question"
    )

    assert result.note.note_type is NoteType.QUESTION


def test_capture_rejects_unknown_note_type(world: World) -> None:
    with pytest.raises(ValidationError, match="Unknown note type"):
        world.capture.capture("alice", url=f"https://youtu.be/{VID}", note_type="poem")


@pytest.mark.parametrize("url", ["", "https://example.com/x", "https://youtu.be/"])
def test_capture_rejects_links_that_are_not_youtube_videos(world: World, url: str) -> None:
    with pytest.raises(ValidationError, match="YouTube video link"):
        world.capture.capture("alice", url=url)


def test_capture_twice_within_the_window_is_deduplicated(world: World) -> None:
    first = world.capture.capture("alice", url=f"https://youtu.be/{VID}?t=9", text="same")
    second = world.capture.capture("alice", url=f"https://youtu.be/{VID}?t=9", text="same")

    assert second.duplicate is True
    assert second.note.id == first.note.id
