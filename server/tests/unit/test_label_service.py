import pytest
from support.world import World

from clipnote.domain import ConflictError, NotFoundError, ValidationError


def test_assign_and_read_back_a_label(world: World) -> None:
    world.label_service.add("alice", "ml")

    world.label_service.assign("alice", label_name="ml", video_id="vid")

    assert world.label_service.name_for_video("alice", "vid") == "ml"
    assert world.label_service.name_for_video("bob", "vid") is None


def test_cannot_assign_another_users_label(world: World) -> None:
    world.label_service.add("alice", "ml")

    with pytest.raises(NotFoundError):
        world.label_service.assign("bob", label_name="ml", video_id="vid")


def test_unassign_only_affects_the_callers_labels(world: World) -> None:
    world.label_service.add("alice", "a")
    world.label_service.add("bob", "b")
    world.label_service.assign("alice", label_name="a", video_id="vid")
    world.label_service.assign("bob", label_name="b", video_id="vid")

    world.label_service.unassign("alice", "vid")

    assert world.label_service.name_for_video("alice", "vid") is None
    assert world.label_service.name_for_video("bob", "vid") == "b"


def test_rename_and_delete_are_owner_scoped(world: World) -> None:
    label = world.label_service.add("alice", "old")

    with pytest.raises(NotFoundError):
        world.label_service.rename("bob", label.id, "hijack")
    with pytest.raises(NotFoundError):
        world.label_service.delete("bob", label.id)

    world.label_service.rename("alice", label.id, "new")
    assert [lb.name for lb in world.label_service.list_for_user("alice")] == ["new"]
    world.label_service.delete("alice", label.id)
    assert world.label_service.list_for_user("alice") == []


@pytest.mark.parametrize("name", ["", "   ", "x" * 61])
def test_label_names_are_validated(world: World, name: str) -> None:
    with pytest.raises(ValidationError):
        world.label_service.add("alice", name)


def test_videos_for_unknown_label_is_not_found(world: World) -> None:
    with pytest.raises(NotFoundError):
        world.label_service.videos_for_label("alice", "nope")


def test_duplicate_label_names_are_rejected_per_user(world: World) -> None:
    world.label_service.add("alice", "ml")

    with pytest.raises(ConflictError):
        world.label_service.add("alice", "ml")
    world.label_service.add("bob", "ml")
