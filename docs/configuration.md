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

## Limits and abuse protection

| Variable | Default | Purpose |
|---|---|---|
| `AI_DAILY_LIMIT` | `100` | AI calls each user may use per UTC day: notes written by the model, summaries and Clipchat answers. `0` turns the cap off. Counted in the `ai_usage` table, so it survives restarts |
| `TRUSTED_PROXIES` | `0` | How many reverse proxies sit in front of the app. **Set this to `1` on a host such as Render**, otherwise every visitor looks like the proxy and shares one rate limit |

Rate limits (named constants in `server/clipnote/constants.py`), counted per client IP for anonymous
routes and per user for signed-in routes. Going over returns `429` with a `Retry-After` header.

| Route | Limit |
|---|---|
| `POST /login` | 10 per minute per IP |
| `POST /signup` | 5 per hour per IP |
| `POST /change-password` | 5 per 10 minutes per user |
| `POST /api/tokens` | 10 per hour per user |
| `POST /api/capture` | 60 per minute per user |
| Clipchat `ask` and `stream` | 20 per minute per user |
| `POST /summarize` | 10 per minute per user |

The request counters live in memory, so they reset on restart and are not shared between instances.
The daily AI allowance is stored in Postgres and is shared. A note saved with no text when the
allowance is used up is kept and marked failed, so the user can write it themselves.

## Other

| Variable | Purpose |
|---|---|
| `FLASK_ENV` | `production` disables the debugger and switches the legacy database variable |

## Extension

`extension/config.js` sets `BASE_URL` to the backend; `manifest.json` lists the allowed hosts.

## Tooling

`pyproject.toml` configures pytest, ruff and mypy. `docker-compose.yml` starts a local
Postgres on port 5433 (`clipnote` / `clipnote`, override with `CLIPNOTE_DB_PASSWORD`).
