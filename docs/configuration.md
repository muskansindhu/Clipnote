# Clipnote Configuration

Set these in `server/.env` or the process environment. Variables already set in the
environment win over `.env`. See `server/.env.example`.

## Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Falls back to `IPv6_SUPABASE_CONNECTION_STRING` (development), `IPv4_SUPABASE_CONNECTION_STRING` (when `FLASK_ENV=production`), then `SUPABASE_CONNECTION_STRING` |
| `JWT_SECRET` | Signs login tokens and Flask sessions. Use a long random value |

## Language model

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `openai` | `openai`, or `stub` for offline placeholder text (local demos, no key needed) |
| `OPENAI_API_KEY` | | Required when `LLM_PROVIDER=openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat model used for notes, summaries and Clipchat |

The old `GEMINI_API_KEY` is **not read** by the code; remove it.

## Transcripts

| Variable | Default | Purpose |
|---|---|---|
| `TRANSCRIPT_PROVIDERS` | `youtube_transcript_api,apify` | Sources, tried in order. `youtube_transcript_api` is free and keyless; `apify` is a paid fallback |
| `APIFY_TOKEN` | | Needed for the `apify` provider (skipped with a warning if missing) |
| `STORAGE_BACKEND` | `s3` | `s3` or `filesystem` |
| `S3_BUCKET`, `ACCESS_KEY`, `SECRET_KEY` | | S3 credentials when `STORAGE_BACKEND=s3` |
| `LOCAL_DATA_DIR` | `server/.local-data` | Where `filesystem` stores transcripts |

## Sign-in

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `GOOGLE_DISCOVERY_URL`. Google sign-in is
disabled when the first two are unset.

## Other

| Variable | Purpose |
|---|---|
| `FLASK_ENV` | `production` disables the debugger and switches the legacy database variable |

## Extension

`extension/config.js` sets `BASE_URL` to the backend; `manifest.json` lists the allowed hosts.

## Tooling

`pyproject.toml` configures pytest, ruff and mypy. `docker-compose.yml` starts a local
Postgres on port 5433 (`clipnote` / `clipnote`, override with `CLIPNOTE_DB_PASSWORD`).
