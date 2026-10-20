"""Language model backed by the OpenAI chat completions API."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from openai import OpenAI, OpenAIError

from clipnote.domain import ExternalServiceError


class OpenAILanguageModel:
    """Text and structured completions from an OpenAI chat model."""

    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = OpenAI(api_key=api_key)
        self._model = model

    def complete_text(self, *, system: str, user: str) -> str:
        return self._complete(system=system, user=user).strip()

    def complete_structured(
        self, *, system: str, user: str, schema_name: str, schema: Mapping[str, Any]
    ) -> str:
        response_format: Any = {
            "type": "json_schema",
            "json_schema": {"name": schema_name, "strict": True, "schema": dict(schema)},
        }
        return self._complete(system=system, user=user, response_format=response_format)

    def _complete(self, *, system: str, user: str, response_format: Any = None) -> str:
        kwargs: dict[str, Any] = {}
        if response_format is not None:
            kwargs["response_format"] = response_format
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                **kwargs,
            )
        except OpenAIError as exc:
            raise ExternalServiceError("The language model request failed") from exc
        return response.choices[0].message.content or ""
