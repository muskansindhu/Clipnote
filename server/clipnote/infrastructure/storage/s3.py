"""Transcript cache backed by an S3 bucket."""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from clipnote.domain import TranscriptEntry

logger = logging.getLogger(__name__)


class S3TranscriptStore:
    """Stores each transcript as a JSON object keyed by the video id."""

    def __init__(self, *, bucket: str, access_key: str | None, secret_key: str | None) -> None:
        self._bucket = bucket
        self._client: Any = boto3.client(
            "s3", aws_access_key_id=access_key, aws_secret_access_key=secret_key
        )

    def get(self, video_id: str) -> list[TranscriptEntry] | None:
        try:
            body = self._client.get_object(Bucket=self._bucket, Key=video_id)["Body"].read()
            data = json.loads(body.decode("utf-8"))
        except (ClientError, BotoCoreError):
            logger.info("No cached transcript for %s", video_id)
            return None
        except json.JSONDecodeError:
            logger.warning("Cached transcript for %s is not valid JSON", video_id)
            return None
        return data if isinstance(data, list) else None

    def put(self, video_id: str, entries: Sequence[TranscriptEntry]) -> bool:
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=video_id,
                Body=json.dumps(list(entries)),
                ContentType="application/json",
            )
        except (ClientError, BotoCoreError):
            logger.exception("Could not store transcript for %s", video_id)
            return False
        return True
