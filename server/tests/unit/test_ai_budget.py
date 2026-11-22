"""The per-user daily AI allowance across the services that spend it."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from support.world import World

from clipnote.application.services.ai_budget import seconds_until_next_utc_day
from clipnote.domain import EnrichmentStatus, NoteSource, RateLimitError

VID = "dQw4w9WgXcQ"


def _empty_note(world: World, user: str = "alice"):  # type: ignore[no-untyped-def]
    return world.note_service.create_note(user, video_id=VID, title="T", text=None, seconds=10)


def test_empty_note_uses_one_ai_call(world: World) -> None:
    _empty_note(world)

    assert world.budget.used == {"alice": 1}


def test_note_with_text_uses_no_ai_call_for_the_note_itself(world: World) -> None:
    world.videos.add_if_missing(video_id=VID, url="u", title="T", owner_id="alice")
    world.videos.set_summary_if_empty(VID, "already summarised")

    world.note_service.create_note("alice", video_id=VID, title="T", text="mine", seconds=5)

    assert world.budget.used == {}


def test_empty_note_is_kept_but_marked_failed_when_the_allowance_is_used_up(world: World) -> None:
    world.budget.limit = 0

    created = _empty_note(world)

    assert created.note.status is EnrichmentStatus.FAILED
    assert created.note.source is NoteSource.AI
    assert created.note.text is None
    assert world.runner.tasks == []


def test_one_users_allowance_does_not_affect_another(world: World) -> None:
    world.budget.limit = 1
    _empty_note(world, "alice")

    assert _empty_note(world, "bob").note.status is EnrichmentStatus.PENDING


def test_clipchat_question_is_refused_when_the_allowance_is_used_up(world: World) -> None:
    world.llm.structured = '{"answer":"yes"}'
    world.budget.limit = 0

    with pytest.raises(RateLimitError, match="today's AI allowance"):
        world.clipchat.ask("alice", VID, "what?")


def test_clipchat_question_spends_a_call(world: World) -> None:
    world.llm.structured = '{"answer":"yes"}'
    world.videos.add_if_missing(video_id=VID, url="u", title="T", owner_id="alice")
    world.videos.set_summary_if_empty(VID, "summary")

    world.clipchat.ask("alice", VID, "what?")

    assert world.budget.used == {"alice": 1}


def test_background_summary_is_skipped_when_the_allowance_is_used_up(world: World) -> None:
    world.note_service.create_note("alice", video_id=VID, title="T", text="mine", seconds=5)
    world.budget.limit = 0

    world.runner.run_all()

    assert world.videos.rows[VID].summary is None


def test_reset_time_is_the_next_utc_midnight() -> None:
    now = datetime(2026, 11, 22, 23, 0, 0, tzinfo=UTC)

    assert seconds_until_next_utc_day(now) == 3600
