# Clipnote Configuration

## Backend Environment Variables

Set these in your `.env` file:

- `SUPABASE_CONNECTION_STRING`: PostgreSQL connection string
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_DISCOVERY_URL`: Google OAuth discovery URL (default provided)
- `GEMINI_API_KEY`: Google Gemini API key
- `APIFY_TOKEN`: Apify API token
- `S3_BUCKET`: AWS S3 bucket name
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: Admin credentials
- `JWT_SECRET`: JWT signing secret
- `ACCESS_KEY`, `SECRET_KEY`: AWS credentials

## Extension Configuration

- `extension/config.js`: Set `BASE_URL` to backend API (e.g., `https://clipnote.muskansindhu.tech`)
- `manifest.json`: Permissions for tabs, scripting, storage; content scripts for backend URLs

## Requirements

- Python dependencies in `requirements.txt`
- Chrome browser for extension

## Deployment

- Backend: Render
- Extension: Load unpacked extension in Chrome (navigate to `extension/` folder)

## Static Assets

- Place CSS/JS in `server/static/`
- HTML templates in `server/templates/`

---
