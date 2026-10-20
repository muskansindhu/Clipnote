# Clipnote PRD — A Personal Capture-First YouTube Knowledge Tool

Status: Draft v1 · Date: 2026-10-18 · Owner: Muskan Sindhu
Audience: me (single primary user, personal workflow first; public product second)

---

## 1. Problem

I watch YouTube to learn (talks, tutorials, long-form interviews), mostly on my iPhone. Notes die in the gap between *having* a thought and *recording* it:

1. **Capture friction.** On iPhone, leaving YouTube to type in another app breaks flow, pauses learning, and loses the timestamp.
2. **Notes are write-only.** Notes land in a dashboard I rarely revisit. Nothing resurfaces them, links them, or lets me use them elsewhere (Obsidian, Notion, Apple Notes).
3. **Feature sprawl.** The product has drifted toward a generic "YouTube + AI" tool (summary, chat, trial, labels), which is a crowded category. See §3.

## 2. Product thesis

> **Clipnote is the fastest way to mark a moment in a YouTube video, and the best place to turn those moments into notes I actually reuse.**

Two principles drive every decision:

- **Capture in ≤ 2 seconds, never leave the video.** One tap or one voice phrase produces a timestamped note. AI fills in the content when I don't type.
- **Notes must leave the app.** Markdown/Obsidian/Notion export is a core feature, not a nice-to-have. A tool I can't get my notes out of won't become part of my workflow.

### Non-goals
- Being a general AI video summarizer (NoteGPT, Eightify, Glasp already own that).
- Public sharing, social highlights, or a community layer.
- Supporting non-YouTube video (Netflix, Vimeo, Coursera) before the YouTube loop is excellent.

## 3. Market and competitor findings

Sources are in §12. Most comparison articles are vendor blogs with conflicting numbers, so treat pricing and limits as unverified.

| Tool | Strength | Gap relevant to me |
|---|---|---|
| NoteGPT / Eightify / Sipsip | Fast AI summaries, mostly Chrome extensions | Summary-first, not capture-first; no good iPhone story |
| Glasp | Transcript highlighting, export, multiple LLMs | Highlights public by default; desktop-oriented |
| Firefox add-ons (Timestamp Notes, NoteStamp) | Keyboard-shortcut notes without pausing; click timestamp to seek; .txt export | Firefox only; no AI, no mobile |
| Annotate.tv | Timestamped notes on web video | Web only |
| Share-sheet Shortcuts ("Share With TimeStamp") | Copies the URL with the current time | Produces only a link; the note is typed elsewhere |

**Whitespace:** I found no iOS-friendly tool that combines one-tap timestamp capture, AI-written notes, and export to my own notes system. Clipnote already has the hard backend parts for this.

## 4. Current-state analysis (from the code)

### What exists
Flask + Postgres (Supabase) backend; Chrome MV3 popup extension; Jinja/vanilla-JS dashboard (home, dashboard, note, profile, Clipchat pages); email + Google auth; labels, favourites, search; AI note from transcript when the note is empty; 5-point summary; Clipchat (chat with the video, streaming, chunked long-transcript handling, guest trial).

### What works well (keep)
- **Empty note → AI note from the transcript around the timestamp** (`/add-notes`). This is the single best idea in the product and the base of the "one-tap" capture.
- Transcript cached in S3 per video id, shared across users.
- Clipchat with `[seconds]` citations.

### Problems found

| # | Finding | Evidence | Impact |
|---|---|---|---|
| P1 | Docs say Gemini; code uses OpenAI `gpt-4o-mini` | `docs/configuration.md` lists `GEMINI_API_KEY`; `config.py`/`utils.py` use `OPENAI_API_KEY` | Confusing setup; docs are not a reliable source of truth |
| P2 | **Favourite is global, not per user**, and updates by *title* | `UPDATE video SET fav = TRUE WHERE video_title = %s` | One user's favourite affects every user and every video sharing a title. Real bug for any multi-user use |
| P3 | First note on a new video blocks on Apify transcript (20s timeout) + S3 + LLM summary | `add_notes()` | The slowest request happens at the moment capture must be instant |
| P4 | Timestamp stored as an `hh:mm:ss` string read from the DOM text | `models.py`, `popup.js` | No seek-by-seconds, brittle sorting, fragile to YouTube DOM changes |
| P5 | Extension only handles `youtube.com/watch`; brittle selectors (`#title > h1 > yt-formatted-string`, `.ytp-time-current`); no shortcut, no pause, no save confirmation, popup closes on blur | `popup.js` | Misses Shorts, `youtu.be`, playlists, embeds; capture takes several clicks |
| P6 | `models.py` is out of sync with the real schema (raw SQL inserts `user_id`, `created_at` on `video`; model has neither) | `add_notes()` vs `models.py` | Models are misleading; schema is effectively undocumented |
| P7 | Catch-all routes (`/<video_yt_id>` GET/PATCH/DELETE, `/<label>/note`) and `text/plain` JSON bodies | `app.py` | Route collisions are possible; weak API hygiene |
| P8 | Paid Apify scraper for transcripts although `youtube-transcript-api` is already a dependency | `utils.py`, `requirements.txt` | Cost and a single point of failure for every new video |
| P9 | Single 1100-line `app.py` with SQL in routes; `AGENTS.md` asks for services separation | `app.py` | Slows every feature below |
| P10 | No export, no notes-to-seconds seek links, no spaced resurfacing | n/a | Notes are not reused |

Tests exist (`tests/test_auth.py`, `test_notes.py`, `test_utils.py`). I did not run them in this analysis, because pytest isn't installed in the system Python and I didn't activate `venv`.

## 5. Feature decisions

### Cut or freeze

| Item | Decision | Reason |
|---|---|---|
| Guest/anonymous Clipchat trial (`/trial-login`, `/guest-login` alias) | **Remove** | Built for a public launch I'm not at. Adds auth surface and a legacy alias. Revisit if I go public |
| `/guest-login` alias | Remove first | Dead alias |
| Admin env vars (`ADMIN_USERNAME/PASSWORD`) | Remove if unused | Needs a quick grep before deletion (ask first per AGENTS.md) |
| Subscription / BYOK / ClipScore / Knowledge Graph (from `NOTES.md`) | **Defer** | Monetization and "video quality score" don't serve the personal loop |
| Chrome Web Store publishing | Defer | Load-unpacked is fine for personal use |
| Clipchat as a separate full page | **Fold** into the note page as a side panel | Chat is most useful next to the notes and transcript, not in a separate flow |
| Apify | Replace with `youtube-transcript-api` primary, Apify as fallback | P8 |

### Keep and improve
Notes, labels (rename to **tags**, allow many per video, add per-note tags), search, AI note, summary, Clipchat.

### Add (prioritised)

| ID | Feature | Why |
|---|---|---|
| F1 | **iPhone capture: Share to Clipnote** (iOS Shortcut + `/api/capture` + personal API token, see §6a). Watch Mode is now an optional later extra | The core unmet need, with Premium and the YouTube app kept and no new cost |
| F13 | **Personal API tokens** (create, list, revoke, capture-only scope) on the profile page | Needed by the Shortcut; also reusable for other automations |
| F2 | **Instant capture API**: save the note immediately and enrich asynchronously | Fixes P3 |
| F3 | **Markdown export + Obsidian/Notion/Apple Notes** (single note, per video, and "everything since date"), with `https://youtu.be/ID?t=SECONDS` links per note | Notes become reusable |
| F4 | **Seconds-based timestamps** + click-to-seek from note page; keep a display string derived from seconds | Fixes P4 |
| F5 | **Note types**: 💡 idea, ❓ question, ⭐ key point, ✅ todo; one-tap chips | Makes capture one tap and makes later review filterable |
| F6 | **Voice note capture** (dictation or audio, transcribed, then cleaned by the LLM) | Hands-free on a phone |
| F7 | **Chapter-aware notes**: group notes under YouTube chapters / transcript segments | Structure without effort |
| F8 | **Per-user favourites + pin** | Fixes P2 |
| F9 | **Daily/weekly review**: resurface 3 old notes by email/push; "questions I haven't answered" list | Closes the loop |
| F10 | **Cross-video search with semantic ranking** (embeddings on notes + summaries) | "Where did I hear that?" |
| F11 | **Extension v3**: floating on-page button + keyboard shortcut (`Alt+N`), reads `video.currentTime`, supports Shorts/`youtu.be`/playlists, shows save confirmation | Fixes P5 |
| F12 | Playlist/course mode: progress, per-playlist notes document | For course-style watching |

## 6. Research: taking notes on iPhone without switching apps

### What the research found
- Plain share-sheet Shortcuts only copy a **timestamped link**; the note still gets typed in another app. The MacStories workflow explicitly depends on manual pasting in Split View/Slide Over on iPad and accepts a few seconds of drift. It is not an iPhone solution.
- YouTube's share sheet has a **"start at" time toggle** (it uses the paused time), so the YouTube app can hand a timestamped URL to a share target.
- iOS 18+ Controls (Control Center, Lock Screen, Action Button) are built on **App Intents**, which can also power Siri phrases and Shortcuts. (Secondary sources, not Apple docs.)
- Safari supports **web extensions** on iPhone (WWDC26 session confirms current tooling), and content scripts can read `video.currentTime`. I could not confirm how a popup behaves while Picture-in-Picture is active, so a floating in-page button is safer than a popup.
- Free YouTube users generally lose background audio when they leave the app. Staying inside one surface avoids that.
- **Hard constraint:** a third-party app cannot read the playhead of the official YouTube app. Any approach that keeps the official app as the player cannot know the exact second without the user telling it (share-sheet toggle) or estimating it.

### Options compared

| # | Approach | Never leaves video? | Timestamp accuracy | Build effort | Verdict |
|---|---|---|---|---|---|
| A | **Watch Mode**: Clipnote's own mobile page embeds the YouTube player (IFrame Player API, `playsinline`) with the note composer under it; saved as a home-screen PWA | Yes, the video and notes share one screen | Exact (`getCurrentTime()`) | Low–medium, mostly web work | **Build first** |
| B | **Safari Web Extension** (Xcode wrapper): floating "＋" button on `m.youtube.com`; tap → bottom sheet note composer in the page | Yes, stays in Safari | Exact (`video.currentTime`) | Medium; needs Apple Developer account ($99/yr) and App Store/TestFlight | Second |
| C | **Share-sheet capture from the YouTube app**: Share → Clipnote (Share Extension or Shortcut) → one-tap "Save moment" with AI note from transcript at `t=` | Mostly: a sheet overlays the app; the video may pause | Exact only if the share toggle is on; otherwise falls back to "now" | Low via Shortcut; medium via a native Share Extension | Cheap stopgap for the YouTube app |
| D | **Voice**: Action Button/Control Center/Siri → "Clipnote, note: …" via App Intent | Yes (no UI switch) | **Weak**: can't read the playhead. Estimate with a stopwatch started from C ("Start watching") | High (native app) | Later; only useful paired with a stopwatch |
| E | **Live Activity stopwatch + Dynamic Island "Mark" button** | Yes | Drifts on pause/seek | High (native app) | Later; fragile |
| F | Picture-in-Picture video + Split View/Slide Over notes app | Partially | Manual | None | Not a product; it's a workaround |

### Decision (updated 2026-10-18)
I want to **keep the official YouTube app and my Premium features** (ad-free, background play, PiP) at **zero extra cost**. That rules out Watch Mode (A) as the primary path and favours **C: Share to Clipnote** via an iOS Shortcut, which needs no Apple Developer account, no App Store review and no new hosting.

1. **Primary: Share to Clipnote (C), see §6a.** Built first.
2. **Optional later: Watch Mode (A)** for exact mid-playback marks. Only worth it if I find I need them, and it is unverified whether embeds honour Premium.
3. **Later, if I pay for a developer account: Safari Web Extension (B).**
4. D/E (native app, Live Activity) stay out of scope.

**Accepted trade-off:** a Shortcut cannot read the playhead of the YouTube app. The timestamp comes from YouTube's own share link, which includes the time only when I **pause and turn on the "start at" toggle**. Notes while the video keeps playing are therefore approximate or video-level (see §6a "Timestamp rules").

### 6a. Share to Clipnote — design

**User flow (in the YouTube app, no app switch):**
1. Pause at the moment (or let it play, accepting the limits below).
2. Tap **Share**, turn on the **start at** toggle, choose **Clipnote** from the share sheet.
3. The Shortcut shows a small menu over the app:
   - **Quick mark**: no text; Clipnote writes an AI note from the transcript at that time.
   - **Type a note**: text prompt.
   - **Dictate**: speech to text.
   Optionally a second prompt picks a note type (💡 ❓ ⭐ ✅).
4. The Shortcut POSTs to Clipnote and shows a confirmation such as "Saved at 12:34". Back to the video.

**Components:**

| Component | Detail |
|---|---|
| iOS Shortcut "Send to Clipnote" | Accepts URLs from the share sheet; menu, optional text/dictation; one "Get Contents of URL" action (POST JSON); result notification. Built by hand and shared via an iCloud link, because I cannot generate a signed `.shortcut` file reliably. Step-by-step build guide goes in `docs/ios-shortcut.md`. |
| `POST /api/capture` | Bearer-token auth. Body: `{url, text?, type?}`. Parses the video id and start time from the URL, inserts the note immediately, enriches asynchronously, returns `{note_id, seconds, display_time, note_url}`. |
| Personal API token | A long-lived, revocable token generated on the profile page and pasted into the Shortcut once. Scope: capture only (cannot read notes or change the account). Stored hashed (`api_tokens` table). Avoids putting the short-lived login JWT in a Shortcut. |
| Title lookup | The Shortcut only has a URL, so the server fetches the title via YouTube's public oEmbed endpoint (no API key). If it fails, store the id and fill the title later. |
| Enrichment worker | Same async pipeline as F2: transcript fetch, summary, AI note text. |

**Timestamp rules (server):**
- Accept `youtu.be/ID?t=754`, `youtube.com/watch?v=ID&t=754`, `&start=754`, and `1h2m3s` forms. Also `/shorts/ID`.
- If a time is present: `timestamp_seconds = t`.
- If no time is present: **do not guess**. Save as a **video-level note** (`timestamp_seconds = NULL`) and mark it "no time". The note page offers a one-tap "set time" later.
- No rewind offset (the link time is already where I paused); I can adjust on the note page.

**Offline and errors:**
- No signal: the Shortcut falls back to appending the link and text to an Apple Note called "Clipnote inbox" (optional P2: import from it later).
- Duplicates: Shortcuts has no easy UUID, so the server dedupes on `(user, video, seconds, text)` within 60 seconds.
- Bad or revoked token: the response is a clear 401 message that the Shortcut displays.

**Risks to verify on the phone (30-minute spike with a hard-coded Shortcut):**
1. Whether the YouTube share sheet really includes `t=` with the toggle on, on my iOS version and app version.
2. Whether the video keeps playing or pauses while the Shortcut menu is shown.
3. Whether the Shortcut's prompts appear over the YouTube app or bounce me to the Shortcuts app.
4. Latency of the full round trip (target under 3 seconds after the last tap).

### Watch Mode UX
- Layout: video pinned top, composer pinned above the keyboard. Landscape: video left, notes right.
- **Big "Mark" button** captures the second immediately and *does not pause*. Optional text or voice can be added afterwards, and an empty mark becomes an AI note.
- Chips (💡 ❓ ⭐ ✅) set the note type in one tap.
- Rewind-on-mark (default −5 s) so the note points slightly before the thought.
- Offline queue (IndexedDB) so a flaky connection never drops a mark.
- Tapping any saved note seeks the player to its second.
- Open from a pasted/shared URL: `clipnote.../watch?url=…`.

**Known risks to verify on a device first (1-day spike):** autoplay and `playsinline` in the embedded player on iOS Safari/PWA; embed restrictions on some videos (embedding disabled by the uploader); ads in embeds; keyboard overlap with the pinned video; whether the PWA keeps audio when the screen locks.

## 7. Requirements

### Functional (P0 = must for v1)

- **P0** Save a moment from the YouTube app on iPhone via the share sheet in ≤ 4 taps, with exact time when the "start at" toggle is on (F1, §6a), and ≤ 1 keyboard shortcut on desktop (F11).
- **P0** Personal API token with capture-only scope and revoke (F13).
- **P0** Notes without a time are stored as video-level notes, never with a guessed time.
- **P0** Save returns in < 500 ms; transcript fetch, summary, AI note and embeddings run asynchronously and update the note when ready (F2).
- **P0** Seconds-based timestamps and click-to-seek (F4).
- **P0** Markdown export with per-note timestamp links (F3).
- **P0** Per-user favourites (F8) and the other P-bugs in §4.
- **P1** Note types (F5), voice capture (F6), share-sheet capture (C).
- **P1** Weekly review (F9), semantic search (F10).
- **P2** Chapters (F7), playlists (F12), Safari extension (B).

### Non-functional
- Capture latency target: p95 < 500 ms server time; the UI confirms optimistically.
- No lost notes: offline queue with retry.
- Privacy: notes private by default; data exportable; one-click delete of all data.
- Cost guardrails: cap LLM calls per user per day; cache transcripts and summaries per video.
- Resilience: transcript provider fallback chain; a video without a transcript still supports manual notes.
- Docs updated with each change (`docs/api.md`, `configuration.md`, `architecture.md`), per `AGENTS.md`.

## 8. Success metrics (personal)

- ≥ 5 videos/week captured from my iPhone after 4 weeks.
- Median time from the last tap in the share sheet to a "Saved" confirmation < 3 s.
- ≥ 50% of notes exported or reviewed at least once within 14 days.
- Zero "I lost that note" incidents over a month.

## 9. Phased roadmap

**Phase 0 — Stabilise (≈ 1 week)**
Fix docs drift (P1), per-user favourites (P2), sync models with schema (P6), tidy routes (P7), remove guest trial, add JSON content-type handling. Extract services out of `app.py` (P9), keeping tests green.

**Phase 1 — Capture (≈ 2 weeks)**
1. 30-minute Shortcut spike to settle the §6a risks.
2. Seconds timestamps + migration (F4), nullable for video-level notes.
3. Async enrichment (F2) and `youtube-transcript-api` primary (P8).
4. API tokens (F13) and `POST /api/capture` with URL parsing, oEmbed title lookup and dedupe (F1).
5. Build the Shortcut, publish an iCloud link, write `docs/ios-shortcut.md`.
6. Note chips (F5).
Watch Mode moves to Phase 3 as optional.

**Phase 2 — Reuse (≈ 2 weeks)**
Markdown/Obsidian export (F3), seek links, weekly review (F9), voice (F6), fold Clipchat into the note page.

**Phase 3 — Reach**
Extension v3 (F11), semantic search (F10), chapters and playlists (F7, F12). Optional: Watch Mode (A) and Safari Web Extension (B).

## 10. Open questions

1. *(Resolved)* iPhone capture uses Share to Clipnote so the YouTube app and Premium stay. Watch Mode is optional later.
2. Which notes system is the export target first: Obsidian, Notion, or Apple Notes?
3. Do I want to stay single-user (drop multi-tenant code paths) or keep the door open to others?
4. Is the existing `gpt-4o-mini` choice still right, or should I move to a current Claude/Haiku-class model for notes, and decide on BYOK later?
5. May I delete the guest-trial code and the admin env vars? (Needs your go-ahead per `AGENTS.md`.)

## 11. Data model changes (sketch)

- `notes.video_timestamp` (text) → add `timestamp_seconds INT` (**nullable**, for video-level notes from share links without a time); keep the text as a derived display value; backfill from the existing strings.
- New `api_tokens(id, user_id, token_hash, label, scope, created_at, last_used_at, revoked_at)`. Store only a hash; show the token once at creation.
- `notes`: add `type` (enum), `status` (`pending|ready|failed`) for async enrichment, `updated_at`.
- `video.fav` → new `user_video(user_id, video_id, fav, pinned)`.
- `video.user_id`: ownership should not decide visibility; `notes.user_id` already does.
- Migrations need explicit confirmation of the target environment before running.

## 12. Sources

- [Share With TimeStamp (RoutineHub)](https://routinehub.co/shortcut/15345/)
- [MacStories: Shortcuts workflow for timestamped research notes](https://www.macstories.net/stories/automation-april-a-three-part-shortcuts-workflow-for-syncing-timestamped-research-notes-with-videos/)
- [Gadget Hacks: link to YouTube start times from a phone](https://smartphones.gadgethacks.com/how-to/trick-lets-you-link-specific-start-times-youtube-videos-right-from-your-phone-0384347/)
- [Annotate.tv](https://annotate.tv/)
- [Firefox: Timestamp Notes](https://addons.mozilla.org/firefox/addon/timestamp-notes/) and [NoteStamp](https://addons.mozilla.org/firefox/addon/notestamp/)
- [Picture in Picture Assistant](https://apps.apple.com/app/id6758930812) and [OverPicture for Safari](https://apps.apple.com/app/id1188020834)
- [WWDC26: Create web extensions for Safari](https://developer.apple.com/videos/play/wwdc2026/216/)
- [Taskade: 11 best YouTube-to-notes tools](https://www.taskade.com/blog/youtube-to-notes), [Glasp vs NoteGPT](https://glasp.co/youtube-summary-vs-notegpt), [NoteGPT alternatives](https://sipsip.ai/blog/notegpt-alternatives)
- [iOS 26 widget and control surface](https://blakecrosley.com/blog/ios-26-widget-and-control-surface)
- [SlashGear: background play on iPhone](https://www.slashgear.com/1366132/how-to-play-youtube-in-background-iphone)
