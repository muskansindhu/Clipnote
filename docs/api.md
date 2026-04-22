# Clipnote API Documentation

## REST API Endpoints

### Authentication
- `POST /login` — User login with email and password
- `GET /login/google` — Google OAuth login
- `GET /auth/google/callback` — Google OAuth callback
- `POST /signup` — Register a new user with username, email, and password
- `POST /guest-login` — Guest login

Accounts support a shared identity model with `username`, unique `email`,
`password_hash`, and optional `google_sub`. Password login uses email plus
password, while Google OAuth links by the same unique email address.

### User
- `GET /profile` — Render profile page
- `GET /user-status` — Get user status (guest/registered)

### Notes
- `GET /all-video` — List all videos with notes (pagination, search, filter, sort)
- `GET /note/<video_yt_id>` — Get all notes for a video
- `POST /add-notes` — Add a note (manual or AI-generated)
- `POST /summarize` — Summarize a video transcript
- `PATCH /<video_yt_id>` — Update a note
- `DELETE /<video_yt_id>` — Delete a note

### Favorites
- `POST /fav-note` — Mark a video as favorite
- `POST /unfav-note` — Unmark a video as favorite

### Labels
- `GET /labels` — List all labels
- `POST /label` — Add a new label
- `PATCH /label` — Update a label
- `DELETE /label` — Delete a label
- `GET /<label>/note` — Filter notes by label
- `GET /<video_yt_id>/label` — Get label for a video
- `POST /video-label` — Assign label to a video
- `DELETE /video-label` — Remove label from a video

### Pages
- `GET /` — Home page
- `GET /dashboard` — Dashboard page
- `GET /<video_yt_id>` — Note page for a video
- `GET /clipchat/<video_yt_id>` — Clipchat page for asking questions about a video

### Clipchat
- `GET /clipchat/<video_yt_id>/context` — Video title, URL, summary, notes, and metadata for the Clipchat page
- `POST /clipchat/<video_yt_id>/ask` — Ask a non-streaming Clipchat question
- `POST /clipchat/<video_yt_id>/stream` — Ask a streaming Clipchat question via server-sent events

Clipchat model responses are requested as a strict JSON object with this shape:

```json
{
  "answer": "**The speaker discusses the topic at [159].**"
}
```

Clipchat sends the transcript to the model together with the user query. For shorter transcripts, it uses a single LLM call. For larger transcripts, it processes the transcript in sequential chunks, collects per-chunk findings, and then runs a final synthesis call so long-video questions keep their continuity instead of trimming away context. When the model cites a video moment, it uses raw seconds in square brackets such as `[159]` or `[6238]`. The frontend formats those seconds into `mm:ss` or `hh:mm:ss` for display.

---

## Chrome Extension Integration
- Communicates with backend for authentication and note management
- Uses `chrome.runtime` and `chrome.storage` for token management
- Injects content script for handshake with web page
- Popup UI for note-taking, timestamp, and video details

---

## Error Handling
- All endpoints return JSON with `message` or `error` on failure
- Auth endpoints return HTTP 401/400 for invalid credentials or missing data
