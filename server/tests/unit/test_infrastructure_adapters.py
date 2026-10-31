import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import jwt
import pytest
import requests

from clipnote.domain import AuthenticationError, ExternalServiceError, User
from clipnote.infrastructure.config import load_settings
from clipnote.infrastructure.errors import ConfigurationError
from clipnote.infrastructure.jobs import ThreadPoolTaskRunner
from clipnote.infrastructure.llm import OpenAILanguageModel, StubLanguageModel
from clipnote.infrastructure.security import JwtAccessTokenCodec, WerkzeugPasswordHasher
from clipnote.infrastructure.storage import FilesystemTranscriptStore
from clipnote.infrastructure.youtube import OEmbedMetadataProvider

VID = "dQw4w9WgXcQ"
USER = User("u1", "muskan", "m@example.com", "hash", None)


def test_filesystem_store_round_trips_and_refuses_path_traversal(tmp_path: Path) -> None:
    store = FilesystemTranscriptStore(tmp_path)
    entries = [{"start": 1, "text": "hi"}]

    assert store.get(VID) is None
    assert store.put(VID, entries) is True
    assert store.get(VID) == entries
    assert store.put("../../etc/passwd", entries) is False
    assert store.get("../../etc/passwd") is None
    assert list(tmp_path.iterdir()) == [tmp_path / f"{VID}.json"]


def test_filesystem_store_ignores_corrupt_files(tmp_path: Path) -> None:
    (tmp_path / f"{VID}.json").write_text("{not json")

    assert FilesystemTranscriptStore(tmp_path).get(VID) is None


def test_jwt_codec_round_trips_identity() -> None:
    codec = JwtAccessTokenCodec("secret")

    claims = codec.decode(codec.issue(USER, picture="http://pic"))

    assert (claims.user_id, claims.username, claims.email) == ("u1", "muskan", "m@example.com")


def test_jwt_codec_rejects_tampered_wrong_secret_and_expired_tokens() -> None:
    codec = JwtAccessTokenCodec("secret")
    good = codec.issue(USER)
    expired = jwt.encode(
        {"sub": "u1", "exp": datetime.now(UTC) - timedelta(seconds=1)}, "secret", "HS256"
    )
    no_subject = jwt.encode({"exp": datetime.now(UTC) + timedelta(days=1)}, "secret", "HS256")

    with pytest.raises(AuthenticationError, match="Invalid token"):
        codec.decode(good + "x")
    with pytest.raises(AuthenticationError, match="Invalid token"):
        JwtAccessTokenCodec("other").decode(good)
    with pytest.raises(AuthenticationError, match="expired"):
        codec.decode(expired)
    with pytest.raises(AuthenticationError, match="Invalid token"):
        codec.decode(no_subject)
    retired_trial = jwt.encode(
        {"sub": "guest_abc123", "exp": datetime.now(UTC) + timedelta(days=1)}, "secret", "HS256"
    )
    with pytest.raises(AuthenticationError, match="Invalid token"):
        codec.decode(retired_trial)


def test_password_hasher_verifies_only_the_right_password() -> None:
    hasher = WerkzeugPasswordHasher()
    hashed = hasher.hash("secret1")

    assert hasher.verify(hashed, "secret1")
    assert not hasher.verify(hashed, "secret2")
    assert hashed != "secret1"


def test_thread_runner_runs_tasks_and_survives_failures() -> None:
    runner = ThreadPoolTaskRunner(max_workers=1)
    done: list[int] = []

    def boom() -> None:
        raise RuntimeError("expected in this test")

    runner.submit(boom)
    runner.submit(done.append, 7)
    runner._executor.shutdown(wait=True)

    assert done == [7]


def test_stub_model_is_deterministic_and_offline() -> None:
    model = StubLanguageModel()

    text = model.complete_text(system="s", user="Transcript snippet:\none two three")
    structured = json.loads(
        model.complete_structured(system="s", user="why?", schema_name="x", schema={})
    )

    assert text == "[stub] one two three"
    assert "why?" in structured["answer"]


def test_openai_model_wraps_api_errors() -> None:
    from openai import OpenAIError

    model = OpenAILanguageModel(api_key="k", model="m")
    failing = patch.object(
        model._client.chat.completions, "create", side_effect=OpenAIError("down")
    )
    with failing, pytest.raises(ExternalServiceError):
        model.complete_text(system="s", user="u")


def test_openai_model_sends_a_strict_json_schema_for_structured_calls() -> None:
    model = OpenAILanguageModel(api_key="k", model="m")
    response = MagicMock()
    response.choices = [MagicMock(message=MagicMock(content='{"answer":"x"}'))]

    with patch.object(model._client.chat.completions, "create", return_value=response) as create:
        out = model.complete_structured(
            system="s", user="u", schema_name="name", schema={"type": "object"}
        )

    assert out == '{"answer":"x"}'
    fmt = create.call_args.kwargs["response_format"]
    assert fmt["json_schema"]["strict"] is True and fmt["json_schema"]["name"] == "name"


def _response(payload: Any, status: int = 200) -> MagicMock:
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.side_effect = (
        None if status == 200 else requests.HTTPError(str(status))
    )
    return response


def test_oembed_returns_title_and_author() -> None:
    with patch("requests.get", return_value=_response({"title": " T ", "author_name": "A"})):
        meta = OEmbedMetadataProvider().fetch(VID)

    assert meta is not None and (meta.title, meta.author) == ("T", "A")


@pytest.mark.parametrize(
    "response",
    [_response({}, 404), _response({"title": ""}), _response(ValueError)],
)
def test_oembed_returns_none_on_failures(response: MagicMock) -> None:
    if response.json.return_value is ValueError:
        response.json.side_effect = ValueError
    with patch("requests.get", return_value=response):
        assert OEmbedMetadataProvider().fetch(VID) is None


def test_oembed_never_requests_invalid_ids() -> None:
    with patch("requests.get") as get:
        assert OEmbedMetadataProvider().fetch("../x") is None
    get.assert_not_called()


def test_settings_prefer_database_url_then_legacy_names() -> None:
    base = {"JWT_SECRET": "s"}
    both = {"DATABASE_URL": "pg://new", "SUPABASE_CONNECTION_STRING": "x"}
    dev = {
        **base,
        "IPv6_SUPABASE_CONNECTION_STRING": "pg://v6",
        "IPv4_SUPABASE_CONNECTION_STRING": "pg://v4",
    }

    assert load_settings({**base, **both}).database_url == "pg://new"
    legacy = load_settings({**base, "SUPABASE_CONNECTION_STRING": "pg://legacy"})
    assert legacy.database_url == "pg://legacy"
    assert load_settings(dev).database_url == "pg://v6"
    assert load_settings({**dev, "FLASK_ENV": "production"}).database_url == "pg://v4"


def test_settings_require_database_and_jwt_secret() -> None:
    with pytest.raises(ConfigurationError, match="DATABASE_URL"):
        load_settings({"JWT_SECRET": "s"})
    with pytest.raises(ConfigurationError, match="JWT_SECRET"):
        load_settings({"DATABASE_URL": "pg://x"})


def test_settings_defaults_and_overrides() -> None:
    env = {"DATABASE_URL": "pg://x", "JWT_SECRET": "s"}

    defaults = load_settings(env)
    custom = load_settings(
        {**env, "TRANSCRIPT_PROVIDERS": " apify , ,youtube_transcript_api", "LLM_PROVIDER": "stub"}
    )

    assert defaults.transcript_providers == ("youtube_transcript_api", "apify")
    assert (defaults.storage_backend, defaults.llm_provider) == ("s3", "openai")
    assert defaults.is_production is False
    assert custom.transcript_providers == ("apify", "youtube_transcript_api")
    assert custom.llm_provider == "stub"
