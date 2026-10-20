# Share to Clipnote: iPhone Shortcut

Save a timestamped note from the **YouTube app** without leaving it. You keep the official
app and your YouTube Premium features; Clipnote only receives the link you share.

> **How the time is captured.** A Shortcut cannot read the YouTube app's playhead. The time
> comes from YouTube's own share link, which includes `t=<seconds>` only when you **pause**
> and turn on the **"Start at"** toggle in YouTube's share sheet. A link without a time is
> saved as a *video-level note* (shown as "Video"), never with a guessed time.

## What you need

- A running Clipnote server reachable from your phone over HTTPS (for example your Render
  deploy). `http://localhost` only works on the same machine.
- A personal API token: **Profile → Share to Clipnote (iPhone) → Create**. Copy it
  immediately; it is shown once. It can only save notes, and you can revoke it from the same
  page.

## Build the Shortcut (one time, about 3 minutes)

Open the **Shortcuts** app → **+** → name it **Send to Clipnote**.

1. **Shortcut settings (ⓘ):** turn on **Show in Share Sheet** and set **Share Sheet Types**
   to **URLs** only.
2. **Choose from Menu** with the prompt `Clipnote` and three items:
   `Quick mark (AI note)`, `Type a note`, `Dictate`.
3. Under each item, add one action and end it with **Set Variable** `Note`:
   - *Quick mark*: **Text** (leave it empty) → **Set Variable** `Note`.
   - *Type a note*: **Ask for Input** (type: Text, prompt `Note`) → **Set Variable** `Note`.
   - *Dictate*: **Dictate Text** → **Set Variable** `Note`.
4. After the menu, add **Get Contents of URL** and expand it with **Show More**:
   - **URL:** `https://YOUR-SERVER/api/capture`
   - **Method:** `POST`
   - **Headers:**
     - `Authorization` = `Bearer cn_…` (your token)
     - `Content-Type` = `application/json`
   - **Request Body:** `JSON`, with these fields:
     - `url` (Text) = **Shortcut Input**
     - `text` (Text) = the `Note` variable
     - `type` (Text, optional) = one of `idea`, `question`, `key_point`, `todo`, `note`
5. **Get Dictionary Value** for `message` from **Contents of URL**, then
   **Show Notification** with that value. You will see, for example, `Saved at 12:34`.

An empty `text` asks the AI to write the note from the transcript around that moment, in the
background. It appears on the note page as "Writing your note…" and fills itself in.

## Use it

1. In the YouTube app, **pause** at the moment you care about.
2. Tap **Share**, turn on **Start at** (it uses the paused time), then pick **More** and
   choose **Send to Clipnote** (you can pin it to the top row of the share sheet).
3. Pick *Quick mark*, *Type a note* or *Dictate*. Done.

Saving the same note twice within a minute is ignored, so a double tap is harmless.

## Verify it from a terminal

```bash
curl -s https://YOUR-SERVER/api/capture \
  -H "Authorization: Bearer cn_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/dQw4w9WgXcQ?t=83","text":"Test note","type":"idea"}'
```

A `201` response with `"message": "Saved at 1:23"` means the server side is working.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Invalid or revoked API token` | The token was revoked or copied incompletely. Create a new one. |
| `That does not look like a YouTube video link` | The Shortcut passed something other than the video URL. Check that the share-sheet type is URLs and that `url` is **Shortcut Input**. |
| Saved as **Video** (no time) | The share link had no `t=`. Pause first and turn on **Start at**. |
| AI note shows "AI note unavailable" | No transcript could be fetched for that video. Edit the note to write your own. |

## Things to verify on your device

These depend on iOS and YouTube app versions and could not be checked from a computer:

1. The YouTube share sheet includes `t=` when **Start at** is on.
2. Whether the video keeps playing or pauses while the Shortcut menu is shown.
3. Whether the Shortcut's prompts appear over the YouTube app or open the Shortcuts app.
4. The round-trip time from the last tap to the notification (target: under 3 seconds).
