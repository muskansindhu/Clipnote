from support.world import World

from clipnote.domain import EnrichmentStatus, NoteSource

VID = "dQw4w9WgXcQ"


def _pending_ai_note(world: World, seconds: int | None = 10):  # type: ignore[no-untyped-def]
    return world.note_service.create_note(
        "alice", video_id=VID, title="T", text=None, seconds=seconds
    ).note


def test_enrichment_writes_ai_note_summary_and_marks_ready(world: World) -> None:
    note = _pending_ai_note(world)

    world.runner.run_all()

    done = world.notes.rows[note.id]
    assert done.status is EnrichmentStatus.READY
    assert done.text == "an ai note"
    assert done.source is NoteSource.AI
    assert world.videos.rows[VID].summary == "an ai note"
    assert world.store.data[VID]


def test_enrichment_feeds_the_snippet_near_the_timestamp_to_the_model(world: World) -> None:
    world.provider._entries = [
        {"start": 10, "text": "near"},
        {"start": 500, "text": "far away"},
    ]
    note = _pending_ai_note(world, seconds=12)

    world.enrichment.enrich_note(note.id)

    note_prompts = [
        user for _, user in world.llm.text_calls if user.startswith("Transcript snippet")
    ]
    assert note_prompts == ["Transcript snippet:\nnear"]


def test_enrichment_keeps_user_text_and_only_adds_the_summary(world: World) -> None:
    note = world.note_service.create_note(
        "alice", video_id=VID, title="T", text="mine", seconds=10
    ).note

    world.runner.run_all()

    done = world.notes.rows[note.id]
    assert done.text == "mine"
    assert done.source is NoteSource.USER
    assert done.status is EnrichmentStatus.READY
    assert world.videos.rows[VID].summary == "an ai note"


def test_enrichment_marks_failed_when_no_transcript_exists(world: World) -> None:
    world.provider._entries = []
    note = _pending_ai_note(world)

    world.runner.run_all()

    assert world.notes.rows[note.id].status is EnrichmentStatus.FAILED
    assert world.notes.rows[note.id].text is None


def test_enrichment_marks_failed_instead_of_raising_when_the_model_errors(world: World) -> None:
    note = _pending_ai_note(world)
    world.llm.fail = True

    world.enrichment.enrich_note(note.id)

    assert world.notes.rows[note.id].status is EnrichmentStatus.FAILED


def test_video_level_ai_note_is_written_from_the_summary(world: World) -> None:
    note = _pending_ai_note(world, seconds=None)

    world.runner.run_all()

    prompts_seen = [user for _, user in world.llm.text_calls]
    assert any(p.startswith("Transcript snippet:\nan ai note") for p in prompts_seen)
    assert world.notes.rows[note.id].status is EnrichmentStatus.READY


def test_enrichment_is_idempotent(world: World) -> None:
    note = _pending_ai_note(world)

    world.enrichment.enrich_note(note.id)
    calls = len(world.llm.text_calls)
    world.enrichment.enrich_note(note.id)

    assert len(world.llm.text_calls) == calls


def test_enrich_unknown_note_is_a_no_op(world: World) -> None:
    world.enrichment.enrich_note(9999)


def test_recover_pending_requeues_notes_left_pending(world: World) -> None:
    _pending_ai_note(world)
    world.runner.tasks.clear()

    assert world.enrichment.recover_pending() == 1
    assert len(world.runner.tasks) == 1
