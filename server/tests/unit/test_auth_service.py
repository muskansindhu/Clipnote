import pytest
from support.world import World

from clipnote.domain import AuthenticationError, ConflictError, NotFoundError, ValidationError


def _register(world: World, *, username="muskan", email="m@example.com", password="secret1") -> str:
    world.auth.signup(username, email, password)
    return next(u.id for u in world.users.rows.values() if u.email == email)


def test_login_rejects_missing_credentials(world: World) -> None:
    with pytest.raises(ValidationError, match="Email and password required"):
        world.auth.login("", "")


def test_login_rejects_unknown_email(world: World) -> None:
    with pytest.raises(AuthenticationError, match="Invalid credentials"):
        world.auth.login("nobody@example.com", "secret1")


def test_login_normalises_email_before_lookup(world: World) -> None:
    user_id = _register(world)

    assert world.auth.login("  M@Example.COM ", "secret1") == f"token-for:{user_id}"


def test_login_rejects_wrong_password(world: World) -> None:
    _register(world)

    with pytest.raises(AuthenticationError, match="Invalid credentials"):
        world.auth.login("m@example.com", "wrong")


def test_login_tells_google_only_accounts_to_use_google(world: World) -> None:
    world.users.add(username="g", email="g@example.com", password_hash=None, google_sub="sub-1")

    with pytest.raises(AuthenticationError, match="uses Google sign-in"):
        world.auth.login("g@example.com", "anything")


def test_signup_creates_account_and_returns_token(world: World) -> None:
    token = world.auth.signup(" muskan ", "M@Example.com", "secret1")

    user = world.users.get_by_email("m@example.com")
    assert user is not None
    assert user.username == "muskan"
    assert token == f"token-for:{user.id}"


@pytest.mark.parametrize(
    ("username", "email", "password", "message"),
    [
        ("", "a@b.co", "secret1", "required"),
        ("u", "", "secret1", "required"),
        ("u", "a@b.co", "", "required"),
        ("u", "a@b.co", "12345", "at least 6"),
    ],
)
def test_signup_validates_input(
    world: World, username: str, email: str, password: str, message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        world.auth.signup(username, email, password)


def test_signup_rejects_duplicate_email_with_password(world: World) -> None:
    _register(world)

    with pytest.raises(ConflictError, match="Email already exists"):
        world.auth.signup("other", "m@example.com", "secret1")


def test_signup_rejects_duplicate_username(world: World) -> None:
    _register(world)

    with pytest.raises(ConflictError, match="Username already exists"):
        world.auth.signup("muskan", "other@example.com", "secret1")


def test_signup_adds_password_to_existing_google_account(world: World) -> None:
    google = world.users.add(
        username="g", email="g@example.com", password_hash=None, google_sub="s"
    )

    world.auth.signup("newname", "g@example.com", "secret1")

    updated = world.users.rows[google.id]
    assert updated.username == "newname"
    assert updated.has_password
    assert updated.google_sub == "s"


def test_google_login_links_existing_local_account(world: World) -> None:
    local_id = _register(world)

    token = world.auth.login_with_google(email="M@example.com", google_sub="sub-9", picture=None)

    assert world.users.rows[local_id].google_sub == "sub-9"
    assert token == f"token-for:{local_id}"


def test_google_login_creates_account_with_derived_unique_username(world: World) -> None:
    world.users.add(username="jane_doe", email="x@example.com", password_hash="h", google_sub=None)

    world.auth.login_with_google(email="jane.doe@example.com", google_sub="s", picture="pic")

    created = world.users.get_by_email("jane.doe@example.com")
    assert created is not None
    assert created.username == "jane_doe2"


def test_google_login_requires_email_and_subject(world: World) -> None:
    with pytest.raises(ValidationError, match="Google account info missing"):
        world.auth.login_with_google(email="", google_sub="", picture=None)


def test_change_password_updates_hash(world: World) -> None:
    user_id = _register(world)

    world.auth.change_password(user_id, "secret1", "brandnew")

    assert world.auth.login("m@example.com", "brandnew")


@pytest.mark.parametrize(
    ("current", "new", "error", "message"),
    [
        ("secret1", "123", ValidationError, "at least 6"),
        ("", "brandnew", ValidationError, "Current password is required"),
        ("nope", "brandnew", AuthenticationError, "incorrect"),
    ],
)
def test_change_password_rejects_bad_input(
    world: World, current: str, new: str, error: type[Exception], message: str
) -> None:
    user_id = _register(world)

    with pytest.raises(error, match=message):
        world.auth.change_password(user_id, current, new)


def test_change_password_unavailable_for_google_only_accounts(world: World) -> None:
    google = world.users.add(
        username="g", email="g@example.com", password_hash=None, google_sub="s"
    )

    with pytest.raises(ValidationError, match="Google sign-in"):
        world.auth.change_password(google.id, "x", "brandnew")


def test_change_password_unknown_user(world: World) -> None:
    with pytest.raises(NotFoundError):
        world.auth.change_password("missing", "x", "brandnew")
