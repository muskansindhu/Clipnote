# Clipnote

Clipnote makes learning from YouTube easier. Capture **timestamp-linked notes** while you
watch, let AI write the ones you do not have time to type, chat with the video, and export
everything to Markdown for Obsidian, Notion or plain files.

Think of it as your **second brain for YouTube**.

<p align="center">
  <img src="../assets/clipnote-video-light.png" alt="A video with its timestamped notes" width="90%">
</p>

---

## 🛠️ Tech Stack

- **Backend**: Flask (Python) with a clean-architecture layout, see [architecture.md](architecture.md)
- **Database**: PostgreSQL with plain SQL migrations
- **AI**: OpenAI chat models behind a port, so the provider can be swapped
- **Transcripts**: `youtube-transcript-api` first, Apify as an optional fallback
- **Front end**: React 19 + TypeScript SPA (Vite, Tailwind v4, TanStack Query, Framer Motion); Chrome extension (Manifest V3)

---

## ✨ Features

📱 **Share to Clipnote (iPhone)**

- Save a note from the YouTube app through the share sheet, without leaving it and without
  giving up YouTube Premium. See [ios-shortcut.md](ios-shortcut.md).

🎬 **Capture without leaving full screen**

- Press **⌘⇧S** on a YouTube video. The video pauses and a small panel appears over it, even in
  full screen. Type a note, or leave it empty and let AI write it from the transcript.

⚡ **Instant capture**

- Notes save immediately. Transcripts, summaries and AI text are filled in in the background.
- Leave a note empty and an **AI note** is written from the transcript at that moment.
- Note types: 💡 idea, ❓ question, ⭐ key point, ✅ to do. A link with no time becomes a
  video-level note.

📤 **Export**

- Markdown per video or for everything, with a seek link (`youtu.be/<id>?t=<seconds>`) on
  every note.

📚 **Library**

- Search, labels, per-user favourites, edit and delete. A command palette (⌘K) jumps anywhere.
  Light and dark themes.

💬 **Clipchat**

- Ask questions about a video; answers cite exact timestamps.

🧩 **Chrome extension**

- Capture notes from the toolbar, or with ⌘⇧S, on any `youtube.com/watch` page.

🔒 **Privacy-first**

- Self-hostable. Your notes are private to your account. Personal API tokens are hashed,
  capture-only and revocable.

---

## 🔧 Setup

### 1. Local development

```bash
# Postgres on localhost:5433
docker compose up -d db

# Python environment
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Configure (see server/.env.example); for a no-keys local run:
export DATABASE_URL=postgresql://clipnote:clipnote@localhost:5433/clipnote
export JWT_SECRET=local-dev-secret
export STORAGE_BACKEND=filesystem LLM_PROVIDER=stub TRANSCRIPT_PROVIDERS=youtube_transcript_api

# Create the tables (never runs automatically)
cd server
python -m clipnote.infrastructure.db.migrate

# Build the web app (outputs to server/static/app)
(cd ../web && npm install && npm run build)   # or `npm run dev` for hot reload with an API proxy

# Run
python app.py            # http://localhost:5001
```

### 2. Tests and checks

```bash
pytest                   # unit + API tests; integration tests use the docker Postgres
ruff check . && mypy server/clipnote
```

### 3. Docker image

```bash
docker build -t clipnote-server .
docker run -d -p 5001:5001 --env-file server/.env --name clipnote clipnote-server
```

### 4. Chrome extension

1. Open `chrome://extensions/` and enable **Developer mode**.
2. **Load unpacked** and select the `extension/` folder.
3. Set `BASE_URL` in `extension/config.js` to your backend, then log in at `/login`.

### Keyboard shortcuts

Every web shortcut is a ⌘ chord (Ctrl on Windows and Linux). Press ⌘/ in the app to see the list.

| Shortcut | Action |
|---|---|
| ⌘K | Command palette |
| ⌘/ | Show shortcuts |
| ⌘⇧L / ⌘⇧H / ⌘⇧P | Library / Clipchat / Settings |
| ⌘⇧U | Add a video |
| ⌘⇧E | New note (video page) |
| ⌘⇧↵ | Mark this moment and let AI write the note (video page) |
| ⌘S (or ⌘↵) | Save the note you are typing (video page) |

**Capture while watching, even in full screen (Chrome extension).** Press **⌘⇧S** (Ctrl+Shift+S on Windows and Linux) on a YouTube video. The video pauses and a small panel appears over it, stamped with the current second. Type a note and press Enter, or press Enter on an empty box (or click "Let AI write") and the AI drafts the note from the transcript. The video resumes when the panel closes. Esc cancels outside full screen. If the key does nothing, open `chrome://extensions/shortcuts` and set "Add a note at this moment" yourself (Chrome keeps the key from an earlier install). Reload the extension after updating it.

### 5. iPhone

Follow [ios-shortcut.md](ios-shortcut.md).

## ✅ Usage

- **Chrome:** open a YouTube video and press ⌘⇧S (or open the Clipnote popup) to add a note.
  The timestamp and title are captured; an empty note becomes an AI note.
- **iPhone:** pause in the YouTube app → Share → turn on **Start at** → Send to Clipnote.
- **Library:** `/library` lists your videos; open one to write and edit notes, export Markdown
  or open Clipchat.

---

## 📸 Screenshots

### Library

<p align="center">
  <img src="../assets/clipnote-library.png" alt="Library" width="90%">
</p>

### A video and its notes

Notes sit in a ruled list with the timestamp in the margin. Click a time to jump the player there.

<p align="center">
  <img src="../assets/clipnote-video-light.png" alt="Video page, light theme" width="90%">
</p>
<p align="center">
  <img src="../assets/clipnote-video-dark.png" alt="Video page, dark theme" width="90%">
</p>

### Command palette

<p align="center">
  <img src="../assets/clipnote-palette.png" alt="Command palette" width="90%">
</p>

### Capture over a full-screen video (⌘⇧S)

<p align="center">
  <img src="../assets/clipnote-fullscreen-capture.jpg" alt="Note panel over a full-screen video" width="90%">
</p>

### Chrome extension popup

<p align="center">
  <img src="../assets/clipnote-extension.png" alt="Extension popup" width="40%">
</p>

### Settings

<p align="center">
  <img src="../assets/clipnote-settings.png" alt="Settings" width="90%">
</p>

### Landing page

<p align="center">
  <img src="../assets/clipnote-landing.png" alt="Landing page" width="90%">
</p>

### Mobile

<p align="center">
  <img src="../assets/clipnote-mobile-library.png" alt="Mobile library" width="30%">
  <img src="../assets/clipnote-mobile-video.png" alt="Mobile video page" width="30%">
</p>

---

## 🎥 Demo Video

👉 [Click here to watch the Clipnote Demo](https://www.youtube.com/watch?v=jLILbQJOhv8)
