import pytest
from support.world import World

from clipnote.application import CAPTURE_SCOPE
from clipnote.domain import AuthenticationError, NotFoundError, ValidationError


def test_created_token_authenticates_and_is_never_stored_in_plain_text(world: World) -> None:
    created = world.token_service.create("alice", "My iPhone")

    assert created.secret.startswith("cn_")
    assert created.record.prefix == created.secret[:8]
    assert all(created.secret != stored_hash for _, stored_hash in world.api_tokens.rows.values())
    record = world.token_service.authenticate(created.secret)
    assert record.user_id == "alice"
    assert world.api_tokens.touched == [record.id]


def test_unknown_token_is_rejected(world: World) -> None:
    with pytest.raises(AuthenticationError):
        world.token_service.authenticate("cn_nope")


def test_revoked_token_is_rejected(world: World) -> None:
    created = world.token_service.create("alice", "x")

    world.token_service.revoke("alice", created.record.id)

    with pytest.raises(AuthenticationError, match="revoked"):
        world.token_service.authenticate(created.secret)


def test_token_with_the_wrong_scope_is_rejected(world: World) -> None:
    created = world.token_service.create("alice", "x")

    with pytest.raises(AuthenticationError, match="cannot be used"):
        world.token_service.authenticate(created.secret, required_scope="admin")
    assert created.record.scope == CAPTURE_SCOPE


def test_cannot_revoke_another_users_token(world: World) -> None:
    created = world.token_service.create("alice", "x")

    with pytest.raises(NotFoundError):
        world.token_service.revoke("bob", created.record.id)


def test_blank_label_gets_a_default_and_long_labels_are_rejected(world: World) -> None:
    assert world.token_service.create("alice", "  ").record.label == "Shortcut"
    with pytest.raises(ValidationError, match="at most"):
        world.token_service.create("alice", "x" * 61)


def test_active_token_limit_is_enforced(world: World) -> None:
    for _ in range(10):
        world.token_service.create("alice", "t")

    with pytest.raises(ValidationError, match="at most 10"):
        world.token_service.create("alice", "one too many")

    world.token_service.revoke("alice", world.token_service.list_for_user("alice")[0].id)
    world.token_service.create("alice", "fits again")
