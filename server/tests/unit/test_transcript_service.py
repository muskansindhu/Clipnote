from support.fakes import FakeProvider, FakeTranscriptStore

from clipnote.application import TranscriptService

ENTRIES = [{"start": 1, "text": "hi"}]


def test_cached_transcript_skips_providers() -> None:
    store = FakeTranscriptStore()
    store.data["v"] = ENTRIES
    provider = FakeProvider("p", ENTRIES)

    assert TranscriptService(store, [provider]).get_or_fetch("v") == ENTRIES
    assert provider.calls == []


def test_falls_back_to_the_next_provider_and_caches_the_result() -> None:
    store = FakeTranscriptStore()
    broken, working = FakeProvider("a", fail=True), FakeProvider("b", ENTRIES)

    result = TranscriptService(store, [broken, working]).get_or_fetch("v")

    assert result == ENTRIES
    assert store.data["v"] == ENTRIES
    assert broken.calls == ["v"] and working.calls == ["v"]


def test_skips_providers_that_return_nothing() -> None:
    store = FakeTranscriptStore()
    empty, working = FakeProvider("a", []), FakeProvider("b", ENTRIES)

    assert TranscriptService(store, [empty, working]).get_or_fetch("v") == ENTRIES


def test_returns_none_when_every_provider_fails() -> None:
    store = FakeTranscriptStore()
    service = TranscriptService(store, [FakeProvider("a", fail=True), FakeProvider("b", [])])

    assert service.get_or_fetch("v") is None
    assert store.data == {}


def test_still_returns_the_transcript_when_caching_fails() -> None:
    store = FakeTranscriptStore()
    store.put_ok = False

    assert TranscriptService(store, [FakeProvider("a", ENTRIES)]).get_or_fetch("v") == ENTRIES
