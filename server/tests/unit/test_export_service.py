import pytest
from support.world import World

from clipnote.domain import NoteType, NotFoundError

VID = "dQw4w9WgXcQ"


def _note(
    world: World, seconds: int | None, text: str, note_type: NoteType = NoteType.NOTE
) -> None:
    world.note_service.create_note(
        "alice",
        video_id=VID,
        title='Deep "Learning": Intro',
        text=text,
        seconds=seconds,
        note_type=note_type,
    )


def test_export_video_renders_frontmatter_links_and_markers(world: World) -> None:
    _note(world, 754, "second", NoteType.IDEA)
    _note(world, 83, "first")

    file_name, markdown = world.export.export_video("alice", VID)

    assert file_name == "deep-learning-intro.md"
    assert markdown.startswith('---\ntitle: "Deep \\"Learning\\": Intro"\nsource:')
    assert '# Deep "Learning": Intro' in markdown
    lines = [line for line in markdown.splitlines() if line.startswith("- [")]
    assert lines == [
        f"- [1:23](https://youtu.be/{VID}?t=83) first",
        f"- [12:34](https://youtu.be/{VID}?t=754) 💡 second",
    ]


def test_export_video_lists_untimed_notes_in_their_own_section(world: World) -> None:
    _note(world, 10, "timed")
    _note(world, None, "whole video")

    _, markdown = world.export.export_video("alice", VID)

    assert markdown.index("- [0:10]") < markdown.index("## Video notes")
    assert markdown.rstrip().endswith("- whole video")


def test_export_video_marks_notes_that_are_still_being_written(world: World) -> None:
    _note(world, 10, "")

    _, markdown = world.export.export_video("alice", VID)

    assert "(note still being written)" in markdown


def test_export_video_only_includes_the_callers_notes(world: World) -> None:
    _note(world, 10, "mine")

    with pytest.raises(NotFoundError):
        world.export.export_video("bob", VID)


def test_export_all_concatenates_every_video(world: World) -> None:
    _note(world, 10, "one")
    world.note_service.create_note(
        "alice", video_id="video000002", title="Second", text="two", seconds=5
    )

    file_name, markdown = world.export.export_all("alice")

    assert file_name.startswith("clipnote-export-") and file_name.endswith(".md")
    assert "# Second" in markdown and "one" in markdown
    assert not markdown.startswith("---")


def test_export_all_with_nothing_to_export_is_not_found(world: World) -> None:
    with pytest.raises(NotFoundError):
        world.export.export_all("alice")
