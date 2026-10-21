# Clipnote

Clipnote makes learning from YouTube easier. Capture **timestamp-linked notes** while you
watch, let AI write the ones you do not have time to type, chat with the video, and export
everything to Markdown for Obsidian, Notion or plain files.

Think of it as your **second brain for YouTube**.

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

⚡ **Instant capture**

- Notes save immediately. Transcripts, summaries and AI text are filled in in the background.
- Leave a note empty and an **AI note** is written from the transcript at that moment.
- Note types: 💡 idea, ❓ question, ⭐ key point, ✅ to do. A link with no time becomes a
  video-level note.

📤 **Export**

- Markdown per video or for everything, with a seek link (`youtu.be/<id>?t=<seconds>`) on
  every note.

📊 **Dashboard**

- Search, labels, per-user favourites, edit and delete.

💬 **Clipchat**

- Ask questions about a video; answers cite exact timestamps.

🧩 **Chrome extension**

- Capture notes from the toolbar on any `youtube.com/watch` page.

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

### 5. iPhone

Follow [ios-shortcut.md](ios-shortcut.md).

## ✅ Usage

- **Chrome:** open a YouTube video, open the Clipnote popup, add a note. The timestamp and
  title are captured; an empty note becomes an AI note.
- **iPhone:** pause in the YouTube app → Share → turn on **Start at** → Send to Clipnote.
- **Dashboard:** `/dashboard` lists your videos; open one to edit notes, export Markdown or
  open Clipchat.

---

## 📸 Screenshots

### Extension Popup

<p align="center">
  <img src="../assets/clipnote-extension.png" alt="Extension Popup" width="40%">
</p>

### Dashboard View

<p align="center">
  <img src="../assets/clipnote-dashboard.png" alt="Dashboard" width="40%">
</p>
<p align="center">
  <img src="../assets/clipnote-notepage.png" alt="Note Page" width="40%">
</p>

### Mobile View

<p align="center">
  <img src="../assets/clipnote-mobileview-dashboard-lightmode.png" alt="Mobile Dashboard" width="30%">
  <img src="../assets/clipnote-mobileview-notepage-darkmode.png" alt="Mobile Note Page" width="30%">
</p>

---

## 🎥 Demo Video

👉 [Click here to watch the Clipnote Demo](https://www.youtube.com/watch?v=jLILbQJOhv8)
