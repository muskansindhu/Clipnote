/** Every named constant for the web app, in one place (mirrors server/clipnote/constants.py). */

export const TOKEN_STORAGE_KEY = "clipnote_token";
export const THEME_STORAGE_KEY = "theme";
export const GOOGLE_COOKIE_NAME = "temp_access_token";
export const UNAUTHORIZED_EVENT = "clipnote:unauthorized";

export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
export const MIN_PASSWORD_LENGTH = 6;
export const LIBRARY_PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 250;
export const PENDING_POLL_MS = 3000;
export const PLAYER_TICK_MS = 400;
export const TOAST_DURATION_MS = 4200;
export const RECENT_NOTE_WINDOW_SECONDS = 5;

export const GITHUB_URL = "https://github.com/muskansindhu/Clipnote";
export const SHORTCUT_DOCS_URL = `${GITHUB_URL}/blob/main/docs/ios-shortcut.md`;

export const NOTE_TYPES = ["note", "idea", "question", "key_point", "todo"] as const;
export const SORT_OPTIONS = ["recent", "title"] as const;

export const SUGGESTED_QUESTIONS = [
  "Explain the main idea",
  "List key takeaways",
  "Show key moments",
  "What should I do after watching this?",
] as const;
