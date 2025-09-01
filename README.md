# Clipnote

Clipnote is a lightweight Chrome extension + backend that makes learning from YouTube videos 10x easier.  
Instead of juggling between watching and taking notes, Clipnote lets you **capture timestamp-linked notes** right inside the video — and even uses AI to generate summaries and insights.

Think of it as your **second brain for YouTube**.

---

## 🛠️ Tech Stack

- **Frontend (Extension)**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Flask (Python) REST API
- **Database**: PostgreSQL for persistent note storage
- **AI Integration**: Gemini LLMs (pluggable — you can hook in your own provider)

---

## ✨ Features

🌍 **Cross-Browser Support**

- Runs smoothly on all Chromium-based browsers (Chrome, Brave, Edge).

📊 **Interactive Dashboard**

- Modern UI to view and manage your notes.
- Full-text search across videos.
- Edit or delete notes with one click.
- Create labels to categorize related video notes together.
- Filter notes by labels for easier organization and quick retrieval.

🤖 **AI-Powered Notes**

- Generate context-aware notes for any video timestamp.
- Configure your own AI provider via API key.

⚡ **Quick Video Summaries**

- With one click, get a **5-point summary** of the entire video.
- Perfect for grabbing the gist before deep-diving.

🔒 **Privacy-First**

- Backend is self-hosted, so your data stays with you.
- No third-party servers snooping on your notes.

---

## 🔧 Setup

### 1. Extension Setup

1. Open `chrome://extensions/` in your Chromium browser.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.

### 2. Backend Setup

```bash
# Clone the repo
git clone https://github.com/muskansindhu/clipnote.git
cd clipnote/server

# Install dependencies
pip install -r requirements.txt

# Run the server
python3 app.py
```

By default, the backend runs at http://localhost:5001.

### 3. Backend Setup (Docker Quick Start)

```bash
# Clone the repo
git clone https://github.com/muskansindhu/clipnote.git
cd clipnote

# Build the image
docker build -t clipnote-server .

# Run the container
docker run -d -p 5001:5001 --name clipnote clipnote-server
```

### 4. Configure Extension & Login

1. Open extension/config.js.
2. Update the BASE_URL to point to your backend.
3. Visit http://localhost:5001/dashboard and log in.

This generates a JWT token, automatically stored in both the dashboard’s and extension’s local storage for seamless authentication.

### 5. Dashboard

- Once logged in, use the dashboard to manage, search, label, and filter your notes.

## ✅ Usage

- While watching a YouTube video:

  - Open Clipnote popup.

  - Add a note → It captures the **timestamp + video title**.

  - If the note field is left empty → An **AI-generated note** will be created automatically.

  - (Optional) Click **Summary** → Get the entire video summarized in 5 points.

- All notes instantly sync to your dashboard.
