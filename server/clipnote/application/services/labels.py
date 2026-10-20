"""Labels used to group videos."""

from __future__ import annotations

from clipnote.application.ports import LabelRepository, LibraryRepository
from clipnote.constants import (
    LABEL_NAME_MAX_LENGTH,
)
from clipnote.domain import ConflictError, Label, NotFoundError, ValidationError, VideoListing


class LabelService:
    """Use cases for a user's labels."""

    def __init__(self, labels: LabelRepository, library: LibraryRepository) -> None:
        self._labels = labels
        self._library = library

    def list_for_user(self, user_id: str) -> list[Label]:
        """List the user's labels."""
        return self._labels.list_for_user(user_id)

    def add(self, user_id: str, name: str) -> Label:
        """Create a label.

        Raises:
            ValidationError: If the name is empty or too long.
            ConflictError: If the user already has a label with that name.
        """
        name = _clean_name(name)
        if self._labels.get_by_name(user_id, name) is not None:
            raise ConflictError("Label already exists")
        return self._labels.add(user_id, name)

    def rename(self, user_id: str, label_id: int, new_name: str) -> None:
        """Rename a label.

        Raises:
            ValidationError: If the name is empty or too long.
            NotFoundError: If the label does not belong to the user.
        """
        if not self._labels.rename(user_id, label_id, _clean_name(new_name)):
            raise NotFoundError("Label not found")

    def delete(self, user_id: str, label_id: int) -> None:
        """Delete a label and its video assignments.

        Raises:
            NotFoundError: If the label does not belong to the user.
        """
        if not self._labels.delete(user_id, label_id):
            raise NotFoundError("Label not found")

    def name_for_video(self, user_id: str, video_id: str) -> str | None:
        """Return the name of the label assigned to a video, if any."""
        return self._labels.name_for_video(user_id, video_id)

    def videos_for_label(self, user_id: str, label_name: str) -> list[VideoListing]:
        """List the videos carrying a label.

        Raises:
            NotFoundError: If the user has no label with that name.
        """
        videos = self._library.list_by_label(user_id, label_name)
        if videos is None:
            raise NotFoundError("Label not found")
        return videos

    def assign(self, user_id: str, *, label_name: str, video_id: str) -> None:
        """Assign one of the user's labels to a video.

        Raises:
            NotFoundError: If the user has no label with that name.
        """
        label = self._labels.get_by_name(user_id, label_name)
        if label is None:
            raise NotFoundError("Label not found")
        self._labels.assign(user_id, label.id, video_id)

    def unassign(self, user_id: str, video_id: str) -> None:
        """Remove the user's labels from a video."""
        self._labels.unassign_all(user_id, video_id)


def _clean_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise ValidationError("Label name is required")
    if len(cleaned) > LABEL_NAME_MAX_LENGTH:
        raise ValidationError(f"Label name must be at most {LABEL_NAME_MAX_LENGTH} characters")
    return cleaned
