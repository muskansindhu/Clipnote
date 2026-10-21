import { TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT } from "@/lib/constants";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_STORAGE_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_STORAGE_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_STORAGE_KEY);

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the global "session expired" handling (used by the login form). */
  anonymous?: boolean;
}

function headers(anonymous: boolean | undefined, hasBody: boolean): Record<string, string> {
  const result: Record<string, string> = {};
  const token = anonymous ? null : getToken();
  if (token) result.Authorization = `Bearer ${token}`;
  if (hasBody) result["Content-Type"] = "application/json";
  return result;
}

async function failure(response: Response, anonymous: boolean | undefined): Promise<ApiError> {
  let message = response.statusText || "Something went wrong";
  try {
    const data = (await response.json()) as { message?: string };
    if (data.message) message = data.message;
  } catch {
    /* non-JSON error body: keep the status text */
  }
  if (response.status === 401 && !anonymous && getToken()) {
    clearToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return new ApiError(message, response.status);
}

/** Call the Clipnote JSON API with the saved token. Throws `ApiError` on non-2xx. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, anonymous } = options;
  const response = await fetch(path, {
    method,
    signal,
    headers: headers(anonymous, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await failure(response, anonymous);
  return (await response.json()) as T;
}

/** Download an authenticated file (Markdown export) and hand it to the browser. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(path, { headers: headers(false, false) });
  if (!response.ok) throw await failure(response, false);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Stream a Clipchat answer. Calls `onDelta` per chunk and resolves with the full answer. */
export async function streamClipchat(
  videoId: string,
  question: string,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`/clipchat/${videoId}/stream`, {
    method: "POST",
    signal,
    headers: headers(false, true),
    body: JSON.stringify({ question }),
  });
  if (!response.ok || !response.body) throw await failure(response, false);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      const event = /^event: (\w+)/m.exec(raw)?.[1];
      const data = /^data: (.*)$/m.exec(raw)?.[1];
      if (!data) continue;
      const payload = JSON.parse(data) as { delta?: string; answer?: string };
      if (event === "chunk" && payload.delta) {
        answer += payload.delta;
        onDelta(payload.delta);
      } else if (event === "done" && payload.answer !== undefined) {
        answer = payload.answer;
      }
    }
  }
  return answer;
}
