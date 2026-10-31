"""Composition root: the only place that knows which adapter backs which port."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from clipnote.application import (
    AccessTokenCodec,
    ApiTokenService,
    AuthService,
    CaptureService,
    ClipchatService,
    EnrichmentService,
    ExportService,
    LabelService,
    LanguageModel,
    NoteService,
    TranscriptProvider,
    TranscriptService,
    TranscriptStore,
    VideoService,
)
from clipnote.infrastructure.config import Settings
from clipnote.infrastructure.db import (
    Database,
    PostgresApiTokenRepository,
    PostgresLabelRepository,
    PostgresLibraryRepository,
    PostgresNoteRepository,
    PostgresUserRepository,
    PostgresVideoRepository,
)
from clipnote.infrastructure.errors import ConfigurationError
from clipnote.infrastructure.jobs import ThreadPoolTaskRunner
from clipnote.infrastructure.llm import OpenAILanguageModel, StubLanguageModel
from clipnote.infrastructure.security import JwtAccessTokenCodec, WerkzeugPasswordHasher
from clipnote.infrastructure.storage import FilesystemTranscriptStore, S3TranscriptStore
from clipnote.infrastructure.transcripts import (
    ApifyTranscriptProvider,
    YouTubeTranscriptApiProvider,
)
from clipnote.infrastructure.youtube import OEmbedMetadataProvider

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Container:
    """Every service the HTTP layer needs, already wired."""

    codec: AccessTokenCodec
    auth: AuthService
    notes: NoteService
    capture: CaptureService
    labels: LabelService
    api_tokens: ApiTokenService
    export: ExportService
    clipchat: ClipchatService
    videos: VideoService
    enrichment: EnrichmentService


def _build_store(settings: Settings) -> TranscriptStore:
    if settings.storage_backend == "filesystem":
        return FilesystemTranscriptStore(settings.local_data_dir / "transcripts")
    if settings.storage_backend == "s3":
        if not settings.s3_bucket:
            raise ConfigurationError("Set S3_BUCKET, or STORAGE_BACKEND=filesystem for local use.")
        return S3TranscriptStore(
            bucket=settings.s3_bucket,
            access_key=settings.aws_access_key,
            secret_key=settings.aws_secret_key,
        )
    raise ConfigurationError(f"Unknown STORAGE_BACKEND {settings.storage_backend!r}")


def _build_providers(settings: Settings) -> list[TranscriptProvider]:
    providers: list[TranscriptProvider] = []
    for name in settings.transcript_providers:
        if name == "youtube_transcript_api":
            providers.append(YouTubeTranscriptApiProvider())
        elif name == "apify":
            if settings.apify_token:
                providers.append(ApifyTranscriptProvider(settings.apify_token))
            else:
                logger.warning("APIFY_TOKEN is not set; skipping the apify transcript provider")
        else:
            raise ConfigurationError(f"Unknown transcript provider {name!r}")
    return providers


def _build_llm(settings: Settings) -> LanguageModel:
    if settings.llm_provider == "stub":
        return StubLanguageModel()
    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            raise ConfigurationError("Set OPENAI_API_KEY, or LLM_PROVIDER=stub for local use.")
        return OpenAILanguageModel(api_key=settings.openai_api_key, model=settings.openai_model)
    raise ConfigurationError(f"Unknown LLM_PROVIDER {settings.llm_provider!r}")


def build_container(settings: Settings) -> Container:
    """Create the adapters from ``settings`` and wire them into the services."""
    db = Database(settings.database_url)
    users = PostgresUserRepository(db)
    videos = PostgresVideoRepository(db)
    notes = PostgresNoteRepository(db)
    library = PostgresLibraryRepository(db)
    labels = PostgresLabelRepository(db)
    api_token_repo = PostgresApiTokenRepository(db)

    llm = _build_llm(settings)
    metadata = OEmbedMetadataProvider()
    transcripts = TranscriptService(_build_store(settings), _build_providers(settings))
    codec = JwtAccessTokenCodec(settings.jwt_secret)
    enrichment = EnrichmentService(
        videos=videos,
        notes=notes,
        transcripts=transcripts,
        llm=llm,
        runner=ThreadPoolTaskRunner(),
    )
    note_service = NoteService(
        notes=notes, videos=videos, library=library, metadata=metadata, enrichment=enrichment
    )
    return Container(
        codec=codec,
        auth=AuthService(users, WerkzeugPasswordHasher(), codec),
        notes=note_service,
        capture=CaptureService(note_service),
        labels=LabelService(labels, library),
        api_tokens=ApiTokenService(api_token_repo),
        export=ExportService(notes, videos),
        clipchat=ClipchatService(
            videos=videos,
            notes=notes,
            library=library,
            transcripts=transcripts,
            llm=llm,
            metadata=metadata,
        ),
        videos=VideoService(transcripts, llm),
        enrichment=enrichment,
    )
