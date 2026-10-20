"""In-memory implementations of the application ports, for fast unit tests."""

from __future__ import annotations

import itertools
from collections.abc import Callable, Mapping, Sequence
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

from clipnote.application import AccessClaims, VideoMetadata
from clipnote.domain import (
    ApiToken,
    AuthenticationError,
    EnrichmentStatus,
    ExternalServiceError,
    Label,
    LibraryStats,
    NewNote,
    Note,
    NoteSource,
    TranscriptEntry,
    User,
    Video,
    VideoListing,
)


def _now() -> datetime:
    return datetime.now(UTC)


class FakeUsers:
    def __init__(self) -> None:
        self.rows: dict[str, User] = {}
        self._ids = itertools.count(1)

    def get_by_id(self, user_id: str) -> User | None:
        return self.rows.get(user_id)

    def get_by_email(self, email: str) -> User | None:
        return next((u for u in self.rows.values() if u.email.lower() == email.lower()), None)

    def get_by_google_sub(self, google_sub: str) -> User | None:
        return next((u for u in self.rows.values() if u.google_sub == google_sub), None)

    def username_exists(self, username: str, *, exclude_user_id: str | None = None) -> bool:
        return any(u.username == username and u.id != exclude_user_id for u in self.rows.values())

    def add(
        self, *, username: str, email: str, password_hash: str | None, google_sub: str | None
    ) -> User:
        user = User(f"user-{next(self._ids)}", username, email, password_hash, google_sub)
        self.rows[user.id] = user
        return user

    def set_credentials(
        self, user_id: str, *, username: str, email: str, password_hash: str
    ) -> None:
        self.rows[user_id] = replace(
            self.rows[user_id], username=username, email=email, password_hash=password_hash
        )

    def set_google_sub(self, user_id: str, google_sub: str) -> None:
        self.rows[user_id] = replace(self.rows[user_id], google_sub=google_sub)

    def set_password_hash(self, user_id: str, password_hash: str) -> None:
        self.rows[user_id] = replace(self.rows[user_id], password_hash=password_hash)


class FakeVideos:
    def __init__(self) -> None:
        self.rows: dict[str, Video] = {}

    def get(self, video_id: str) -> Video | None:
        return self.rows.get(video_id)

    def get_many(self, video_ids: Sequence[str]) -> dict[str, Video]:
        return {vid: self.rows[vid] for vid in video_ids if vid in self.rows}

    def add_if_missing(self, *, video_id: str, url: str, title: str, owner_id: str) -> None:
        self.rows.setdefault(video_id, Video(video_id, url, title, None))

    def set_title(self, video_id: str, title: str) -> None:
        self.rows[video_id] = replace(self.rows[video_id], title=title)

    def set_summary_if_empty(self, video_id: str, summary: str) -> None:
        video = self.rows[video_id]
        if not video.summary:
            self.rows[video_id] = replace(video, summary=summary)


class FakeNotes:
    def __init__(self) -> None:
        self.rows: dict[int, Note] = {}
        self._ids = itertools.count(1)

    def add(self, note: NewNote) -> Note:
        now = _now()
        stored = Note(
            id=next(self._ids),
            user_id=note.user_id,
            video_id=note.video_id,
            text=note.text,
            timestamp_seconds=note.timestamp_seconds,
            source=note.source,
            note_type=note.note_type,
            status=note.status,
            created_at=now,
            updated_at=now,
        )
        self.rows[stored.id] = stored
        return stored

    def get_by_id(self, note_id: int) -> Note | None:
        return self.rows.get(note_id)

    def list_for_video(self, user_id: str, video_id: str) -> list[Note]:
        return [n for n in self.rows.values() if n.user_id == user_id and n.video_id == video_id]

    def list_for_user(self, user_id: str, *, since: datetime | None = None) -> list[Note]:
        return [
            n
            for n in self.rows.values()
            if n.user_id == user_id and (since is None or n.created_at >= since)
        ]

    def update_text(self, user_id: str, note_id: int, text: str) -> bool:
        note = self.rows.get(note_id)
        if note is None or note.user_id != user_id:
            return False
        self.rows[note_id] = replace(note, text=text)
        return True

    def update_text_at(self, user_id: str, video_id: str, seconds: int, text: str) -> int:
        ids = [
            n.id for n in self.list_for_video(user_id, video_id) if n.timestamp_seconds == seconds
        ]
        for note_id in ids:
            self.rows[note_id] = replace(self.rows[note_id], text=text)
        return len(ids)

    def delete(self, user_id: str, note_id: int) -> bool:
        note = self.rows.get(note_id)
        if note is None or note.user_id != user_id:
            return False
        del self.rows[note_id]
        return True

    def delete_at(self, user_id: str, video_id: str, seconds: int) -> int:
        ids = [
            n.id for n in self.list_for_video(user_id, video_id) if n.timestamp_seconds == seconds
        ]
        for note_id in ids:
            del self.rows[note_id]
        return len(ids)

    def delete_for_video(self, user_id: str, video_id: str) -> int:
        ids = [n.id for n in self.list_for_video(user_id, video_id)]
        for note_id in ids:
            del self.rows[note_id]
        return len(ids)

    def find_recent_duplicate(
        self,
        *,
        user_id: str,
        video_id: str,
        seconds: int | None,
        text: str | None,
        within_seconds: int,
    ) -> Note | None:
        cutoff = _now() - timedelta(seconds=within_seconds)
        for note in self.list_for_video(user_id, video_id):
            if (
                note.timestamp_seconds == seconds
                and note.text == text
                and note.created_at >= cutoff
            ):
                return note
        return None

    def complete_enrichment(
        self,
        note_id: int,
        *,
        status: EnrichmentStatus,
        text: str | None = None,
        source: NoteSource | None = None,
    ) -> None:
        note = self.rows[note_id]
        self.rows[note_id] = replace(
            note,
            status=status,
            text=text if text is not None else note.text,
            source=source or note.source,
        )

    def list_pending(self, limit: int) -> list[Note]:
        pending = [n for n in self.rows.values() if n.status is EnrichmentStatus.PENDING]
        return pending[:limit]


class FakeLibrary:
    def __init__(self, videos: FakeVideos, notes: FakeNotes) -> None:
        self._videos = videos
        self._notes = notes
        self.favourites: set[tuple[str, str]] = set()
        self.labelled: dict[tuple[str, str], list[str]] = {}

    def list_videos(
        self,
        *,
        user_id: str,
        search: str,
        label_names: Sequence[str],
        sort: str,
        start: datetime | None,
        end: datetime | None,
        limit: int,
        offset: int,
    ) -> list[VideoListing]:
        ids = list(
            dict.fromkeys(n.video_id for n in self._notes.rows.values() if n.user_id == user_id)
        )
        listings = [
            VideoListing(
                v.id,
                v.url,
                v.title,
                (user_id, v.id) in self.favourites,
                note_count=len(self._notes.list_for_video(user_id, v.id)),
            )
            for v in (self._videos.rows[i] for i in ids)
            if search.lower() in v.title.lower()
        ]
        if sort == "title":
            listings.sort(key=lambda item: item.title.lower())
        return listings[offset : offset + limit]

    def list_by_label(self, user_id: str, label_name: str) -> list[VideoListing] | None:
        return None

    def set_favourite(self, user_id: str, video_id: str, fav: bool) -> None:
        if fav:
            self.favourites.add((user_id, video_id))
        else:
            self.favourites.discard((user_id, video_id))

    def is_favourite(self, user_id: str, video_id: str) -> bool:
        return (user_id, video_id) in self.favourites

    def stats(self, user_id: str) -> LibraryStats:
        mine = self._notes.list_for_user(user_id)
        return LibraryStats(
            videos=len({n.video_id for n in mine}),
            notes=len(mine),
            notes_this_week=len(mine),
            favourites=sum(1 for owner, _ in self.favourites if owner == user_id),
            pending=sum(1 for n in mine if n.status is EnrichmentStatus.PENDING),
        )

    def find_video_id_by_title(self, user_id: str, title: str) -> str | None:
        for note in self._notes.rows.values():
            video = self._videos.rows.get(note.video_id)
            if note.user_id == user_id and video and video.title == title:
                return video.id
        return None


class FakeLabels:
    def __init__(self) -> None:
        self.labels: dict[int, Label] = {}
        self.assignments: set[tuple[str, int, str]] = set()
        self._ids = itertools.count(1)

    def list_for_user(self, user_id: str) -> list[Label]:
        return [label for label in self.labels.values() if label.user_id == user_id]

    def get_by_name(self, user_id: str, name: str) -> Label | None:
        return next((lb for lb in self.list_for_user(user_id) if lb.name == name), None)

    def add(self, user_id: str, name: str) -> Label:
        label = Label(next(self._ids), user_id, name)
        self.labels[label.id] = label
        return label

    def rename(self, user_id: str, label_id: int, name: str) -> bool:
        label = self.labels.get(label_id)
        if label is None or label.user_id != user_id:
            return False
        self.labels[label_id] = replace(label, name=name)
        return True

    def delete(self, user_id: str, label_id: int) -> bool:
        label = self.labels.get(label_id)
        if label is None or label.user_id != user_id:
            return False
        del self.labels[label_id]
        self.assignments = {a for a in self.assignments if a[1] != label_id}
        return True

    def assign(self, user_id: str, label_id: int, video_id: str) -> None:
        self.assignments.add((user_id, label_id, video_id))

    def unassign_all(self, user_id: str, video_id: str) -> None:
        self.assignments = {
            a for a in self.assignments if not (a[0] == user_id and a[2] == video_id)
        }

    def name_for_video(self, user_id: str, video_id: str) -> str | None:
        for owner, label_id, vid in self.assignments:
            if owner == user_id and vid == video_id:
                return self.labels[label_id].name
        return None


class FakeApiTokens:
    def __init__(self) -> None:
        self.rows: dict[int, tuple[ApiToken, str]] = {}
        self._ids = itertools.count(1)
        self.touched: list[int] = []

    def add(
        self, *, user_id: str, label: str, scope: str, token_hash: str, prefix: str
    ) -> ApiToken:
        token = ApiToken(next(self._ids), user_id, label, scope, prefix, _now(), None, None)
        self.rows[token.id] = (token, token_hash)
        return token

    def get_by_hash(self, token_hash: str) -> ApiToken | None:
        return next((t for t, h in self.rows.values() if h == token_hash), None)

    def list_for_user(self, user_id: str) -> list[ApiToken]:
        return [t for t, _ in self.rows.values() if t.user_id == user_id]

    def revoke(self, user_id: str, token_id: int) -> bool:
        entry = self.rows.get(token_id)
        if entry is None or entry[0].user_id != user_id:
            return False
        self.rows[token_id] = (replace(entry[0], revoked_at=_now()), entry[1])
        return True

    def touch(self, token_id: int) -> None:
        self.touched.append(token_id)


class FakeTranscriptStore:
    def __init__(self) -> None:
        self.data: dict[str, list[TranscriptEntry]] = {}
        self.put_ok = True

    def get(self, video_id: str) -> list[TranscriptEntry] | None:
        return self.data.get(video_id)

    def put(self, video_id: str, entries: Sequence[TranscriptEntry]) -> bool:
        if self.put_ok:
            self.data[video_id] = list(entries)
        return self.put_ok


class FakeProvider:
    def __init__(
        self, name: str, entries: list[TranscriptEntry] | None = None, *, fail: bool = False
    ) -> None:
        self.name = name
        self._entries = entries or []
        self._fail = fail
        self.calls: list[str] = []

    def fetch(self, video_id: str) -> list[TranscriptEntry]:
        self.calls.append(video_id)
        if self._fail:
            raise ExternalServiceError(f"{self.name} is down")
        return list(self._entries)


class FakeLLM:
    """Records calls and returns canned text. ``structured`` is returned as raw JSON."""

    def __init__(self, text: str = "an ai note", structured: str = '{"answer": "ok"}') -> None:
        self.text = text
        self.structured = structured
        self.text_calls: list[tuple[str, str]] = []
        self.structured_calls: list[dict[str, Any]] = []
        self.fail = False

    def complete_text(self, *, system: str, user: str) -> str:
        if self.fail:
            raise ExternalServiceError("llm down")
        self.text_calls.append((system, user))
        return self.text

    def complete_structured(
        self, *, system: str, user: str, schema_name: str, schema: Mapping[str, Any]
    ) -> str:
        self.structured_calls.append(
            {"system": system, "user": user, "schema_name": schema_name, "schema": schema}
        )
        return self.structured


class FakeMetadata:
    def __init__(self, title: str | None = "Fetched Title") -> None:
        self.title = title
        self.calls: list[str] = []

    def fetch(self, video_id: str) -> VideoMetadata | None:
        self.calls.append(video_id)
        return VideoMetadata(self.title) if self.title else None


class PlainHasher:
    def hash(self, password: str) -> str:
        return f"hashed:{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        return password_hash == f"hashed:{password}"


class FakeCodec:
    def issue(self, user: User, *, picture: str | None = None) -> str:
        return f"token-for:{user.id}" + (f":{picture}" if picture else "")

    def decode(self, token: str) -> AccessClaims:
        if not token.startswith("token-for:"):
            raise AuthenticationError("Invalid token")
        return AccessClaims(token.split(":")[1], None, None)


class QueueRunner:
    """Holds submitted tasks so a test decides when they run."""

    def __init__(self) -> None:
        self.tasks: list[tuple[Callable[..., None], tuple[Any, ...]]] = []

    def submit(self, task: Callable[..., None], *args: Any) -> None:
        self.tasks.append((task, args))

    def run_all(self) -> None:
        while self.tasks:
            task, args = self.tasks.pop(0)
            task(*args)
