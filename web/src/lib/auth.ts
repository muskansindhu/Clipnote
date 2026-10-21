import { GOOGLE_COOKIE_NAME, TOKEN_STORAGE_KEY } from "@/lib/constants";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  picture: string | null;
}

interface JwtPayload {
  sub?: string;
  username?: string;
  email?: string;
  picture?: string;
  exp?: number;
}

/** Decode a JWT payload without verifying it (the server verifies on every request). */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const base64 = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => "%" + char.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** The signed-in user for a token, or `null` if it is malformed or expired. */
export function userFromToken(token: string | null, now = Date.now()): SessionUser | null {
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload?.sub || (payload.exp && payload.exp * 1000 <= now)) return null;
  const email = payload.email ?? "";
  return {
    id: payload.sub,
    username: payload.username || email.split("@")[0] || "You",
    email,
    picture: payload.picture ?? null,
  };
}

/** Pick up the one-minute cookie set after Google sign-in and move it into storage. */
export function adoptGoogleCookie(): void {
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(`${GOOGLE_COOKIE_NAME}=`));
  if (!match) return;
  const token = decodeURIComponent(match.slice(GOOGLE_COOKIE_NAME.length + 1));
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  document.cookie = `${GOOGLE_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

interface ChromeRuntime {
  runtime?: { sendMessage?: (id: string, message: unknown, callback?: () => void) => void };
}

/** Hand the login token to the Clipnote Chrome extension, if it is installed. */
export function notifyExtension(token: string): void {
  const extensionId = document.documentElement.getAttribute("data-clipnote-extension-id");
  const chromeApi = (window as unknown as { chrome?: ChromeRuntime }).chrome;
  if (!extensionId || !chromeApi?.runtime?.sendMessage) return;
  try {
    chromeApi.runtime.sendMessage(extensionId, { type: "SET_TOKEN", jwt: token }, () => undefined);
  } catch {
    /* the extension is optional */
  }
}
