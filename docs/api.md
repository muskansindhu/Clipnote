# Clipnote API Documentation

## REST API Endpoints

### Authentication
- `POST /login` — User login with username and password
- `GET /login/google` — Google OAuth login
- `GET /auth/google/callback` — Google OAuth callback
- `POST /signup` — Register a new user
- `POST /guest-login` — Guest login

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
