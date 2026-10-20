"""Request bodies, validated at the HTTP boundary."""

from __future__ import annotations

from typing import TypeVar

from flask import request
from pydantic import BaseModel, ConfigDict, Field
from pydantic import ValidationError as PydanticValidationError

from clipnote.domain import ValidationError

ModelT = TypeVar("ModelT", bound=BaseModel)


class _Body(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class LoginBody(_Body):
    email: str = ""
    password: str = ""


class SignupBody(_Body):
    username: str = ""
    email: str = ""
    password: str = ""


class ChangePasswordBody(_Body):
    current_password: str = ""
    new_password: str = ""


class AddNoteBody(_Body):
    """Payload sent by the Chrome extension (camelCase, as a text/plain JSON body)."""

    video_url: str = Field(default="", alias="videoUrl")
    video_title: str = Field(default="", alias="videoTitle")
    timestamp: str = Field(default="", alias="currentTimeStamp")
    notes: str = ""
    note_type: str | None = Field(default=None, alias="type")


class UpdateNoteBody(_Body):
    notes: str = ""
    timestamp: str | None = None
    note_id: int | None = None


class DeleteNoteBody(_Body):
    timestamp: str | None = None
    note_id: int | None = None


class SummarizeBody(_Body):
    video_url: str = ""


class FavouriteBody(_Body):
    video_id: str | None = None
    video_title: str | None = None


class LabelBody(_Body):
    label_name: str = ""


class LabelRenameBody(_Body):
    label_id: int
    new_name: str = ""


class LabelDeleteBody(_Body):
    label_id: int


class VideoLabelBody(_Body):
    label_name: str = ""
    video_id: str = ""


class VideoLabelRemoveBody(_Body):
    video_id: str = ""


class QuestionBody(_Body):
    question: str = ""


class CaptureBody(_Body):
    url: str = ""
    text: str | None = None
    note_type: str | None = Field(default=None, alias="type")


class CreateNoteBody(_Body):
    """A note created from the web app, usually at the player's current time."""

    video_id: str = ""
    seconds: int | None = None
    text: str | None = None
    title: str | None = None
    note_type: str | None = Field(default=None, alias="type")


class TokenCreateBody(_Body):
    label: str = ""


def parse_body(model: type[ModelT]) -> ModelT:
    """Validate the JSON request body as ``model``.

    The body is read even when the client sends ``text/plain`` (as the extension does).

    Raises:
        ValidationError: If the body is not a JSON object or a field has the wrong type.
    """
    data = request.get_json(force=True, silent=True)
    if data is None:
        data = {}
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    try:
        return model.model_validate(data)
    except PydanticValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first["loc"]) or "body"
        raise ValidationError(f"{field}: {first['msg']}") from exc
