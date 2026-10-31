"""A fully wired application running on in-memory fakes."""

from __future__ import annotations

from dataclasses import dataclass

from clipnote.application import (
    ApiTokenService,
    AuthService,
    CaptureService,
    ClipchatService,
    EnrichmentService,
    ExportService,
    LabelService,
    NoteService,
    TranscriptService,
)
from support.fakes import (
    FakeApiTokens,
    FakeCodec,
    FakeLabels,
    FakeLibrary,
    FakeLLM,
    FakeMetadata,
    FakeNotes,
    FakeProvider,
    FakeTranscriptStore,
    FakeUsers,
    FakeVideos,
    PlainHasher,
    QueueRunner,
)


@dataclass
class World:
    """A fully wired application running on fakes."""

    users: FakeUsers
    videos: FakeVideos
    notes: FakeNotes
    library: FakeLibrary
    labels: FakeLabels
    api_tokens: FakeApiTokens
    store: FakeTranscriptStore
    provider: FakeProvider
    llm: FakeLLM
    metadata: FakeMetadata
    runner: QueueRunner
    codec: FakeCodec
    auth: AuthService
    transcripts: TranscriptService
    enrichment: EnrichmentService
    note_service: NoteService
    capture: CaptureService
    label_service: LabelService
    token_service: ApiTokenService
    export: ExportService
    clipchat: ClipchatService


def build_world() -> World:
    """Wire the application services to fresh in-memory fakes."""
    users, videos, notes = FakeUsers(), FakeVideos(), FakeNotes()
    library = FakeLibrary(videos, notes)
    labels, api_tokens, store = FakeLabels(), FakeApiTokens(), FakeTranscriptStore()
    provider = FakeProvider("fake", [{"start": 10, "text": "intro words"}])
    llm, metadata, runner = FakeLLM(), FakeMetadata(), QueueRunner()
    codec = FakeCodec()

    transcripts = TranscriptService(store, [provider])
    enrichment = EnrichmentService(
        videos=videos, notes=notes, transcripts=transcripts, llm=llm, runner=runner
    )
    note_service = NoteService(
        notes=notes, videos=videos, library=library, metadata=metadata, enrichment=enrichment
    )
    return World(
        users=users,
        videos=videos,
        notes=notes,
        library=library,
        labels=labels,
        api_tokens=api_tokens,
        store=store,
        provider=provider,
        llm=llm,
        metadata=metadata,
        runner=runner,
        codec=codec,
        auth=AuthService(users, PlainHasher(), codec),
        transcripts=transcripts,
        enrichment=enrichment,
        note_service=note_service,
        capture=CaptureService(note_service),
        label_service=LabelService(labels, library),
        token_service=ApiTokenService(api_tokens),
        export=ExportService(notes, videos),
        clipchat=ClipchatService(
            videos=videos,
            notes=notes,
            library=library,
            transcripts=transcripts,
            llm=llm,
            metadata=metadata,
        ),
    )
