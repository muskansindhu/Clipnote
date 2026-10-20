# Clipnote API

All endpoints return JSON unless noted. Errors look like
`{"message": "...", "error": "..."}` (`error` repeats `message` for older clients).

| Status | Meaning |
|---|---|
| 400 | Invalid input |
| 401 | Missing, invalid, expired or revoked token; wrong credentials |
| 404 | Not found (or not yours) |
| 409 | Conflict, such as a duplicate email or label |
| 502 | The language model failed |

## Authentication

Protected endpoints take `Authorization: Bearer <token>`. There are two token kinds:

- **Login token** (JWT, 15 days): returned by `/login`, `/signup` and Google sign-in.
- **API token** (`cn_...`): created on the profile page, **capture only**. Accepted by
  `POST /api/capture` and nothing else.

| Endpoint | Description |
|---|---|
| `POST /login` | `{email, password}` → `{access_token}` |
| `POST /signup` | `{username, email, password}` → `{access_token}` (201) |
| `GET /login/google`, `GET /auth/google/callback` | Google OAuth (only when configured) |
| `POST /change-password` | `{current_password, new_password}` |

## Capture (iOS Shortcut)

### `POST /api/capture`

Saves a note for the video and moment in a shared link. See [ios-shortcut.md](ios-shortcut.md).

```json
{ "url": "https://youtu.be/dQw4w9WgXcQ?t=754", "text": "optional", "type": "idea" }
```

- The time is read from `t=`, `start=`, `time_continue=` or `#t=` (`754`, `754s`, `1h2m3s`).
- No time in the link → a **video-level note** (`seconds: null`); nothing is guessed.
- Empty `text` → an AI note is written in the background (`status: "pending"`).
- `type` is one of `note` (default), `idea`, `question`, `key_point`, `todo`.
- The same note saved twice within 60 seconds returns the first one (`duplicate: true`).

Response (201): `message`, `note_id`, `video_id`, `video_title`, `seconds`, `display_time`,
`status`, `duplicate`, `note_url`.

### API tokens (login token required)

| Endpoint | Description |
|---|---|
| `GET /api/tokens` | List your tokens (prefix, dates, revoked state; never the secret) |
| `POST /api/tokens` | `{label}` → `{token, record}`. `token` is shown **once**. Max 10 active |
| `DELETE /api/tokens/<id>` | Revoke |

## Notes

| Endpoint | Description |
|---|---|
| `GET /all-video` | Your videos. Query: `page`, `search`, `labels` (comma list), `sort` (`recent`/`title`), `start`, `end` (ISO dates). → `{videos: [{id, video_url, video_title, fav}], has_next}` |
| `GET /note/<video_id>` | Your notes on a video (list). Each has `id`, `video_timestamp` (`"1:23"` or `null`), `timestamp_seconds`, `note`, `note_source` (`user`/`ai`), `note_type`, `status` (`pending`/`ready`/`failed`), `fav`, `video_title`, `video_url`, `video_summary`, `created_at` |
| `POST /add-notes` | Used by the Chrome extension. `{videoUrl, videoTitle, currentTimeStamp, notes}`; JSON may be sent as `text/plain`. Returns immediately (201); transcript, summary and AI text are filled in afterwards |
| `PATCH /<video_id>` | `{note_id, notes}` (preferred) or `{timestamp, notes}` |
| `DELETE /<video_id>` | `{note_id}` (preferred) or `{timestamp}` |
| `POST /summarize` | `{video_url}` → `{message}` (five bullets) |
| `POST /fav-note`, `POST /unfav-note` | `{video_id}` (or legacy `{video_title}`). Favourites are **per user** |

## Labels

`GET /labels`, `POST /label {label_name}`, `PATCH /label {label_id, new_name}`,
`DELETE /label {label_id}`, `GET /<label_name>/note`, `GET /<video_id>/label`,
`POST /video-label {label_name, video_id}`, `DELETE /video-label {video_id}`.
Labels are private to their owner; duplicate names return 409.

## Export

| Endpoint | Description |
|---|---|
| `GET /api/export/<video_id>` | Markdown file with front matter and a seek link on every note |
| `GET /api/export?since=YYYY-MM-DD` | Every video you have notes on (optionally only newer notes) |

Both return `text/markdown` with a `Content-Disposition` attachment header.

## Clipchat

| Endpoint | Description |
|---|---|
| `GET /clipchat/<video_id>/context` | Title, URL, summary, your notes, favourite flag, `asset_status` |
| `POST /clipchat/<video_id>/prepare` | Fetch the transcript and summary if missing |
| `POST /clipchat/<video_id>/ask` | `{question}` → `{answer}` |
| `POST /clipchat/<video_id>/stream` | Same, as server-sent events (`chunk`, then `done`) |

Answers cite moments as raw seconds in square brackets, for example `[159]`; the front end
formats them. Short transcripts use one model call; long ones are indexed by keyword and only
the relevant windows are sent.

## Pages

`GET /`, `/login`, `/dashboard`, `/profile`, `/clipchat`, `/clipchat/<video_id>` and
`/<video_id>` (note page; only valid 11-character video ids match).

## Removed

The anonymous Clipchat trial (`/trial-login`, `/guest-login`, `/user-status`) was removed.
Tokens issued by it no longer authenticate.
