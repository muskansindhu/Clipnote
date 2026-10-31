import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, clearToken, setToken, streamClipchat } from "@/lib/api";
import { decodeToken, userFromToken } from "@/lib/auth";
import { parseAnswer } from "@/lib/citations";
import { UNAUTHORIZED_EVENT } from "@/lib/constants";
import { matchesShortcut } from "@/lib/shortcuts";
import { formatClock, parseClock, relativeTime } from "@/lib/time";
import { extractVideoId, watchUrl } from "@/lib/youtube";

const ID = "dQw4w9WgXcQ";

describe("time", () => {
  it.each([
    [0, "0:00"],
    [83, "1:23"],
    [3599, "59:59"],
    [3723, "1:02:03"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it.each([
    ["1:23", 83],
    ["01:02:03", 3723],
    ["45", 45],
    ["", null],
    ["--:--", null],
    ["1:2:3:4", null],
  ])("parses %j as %j", (input, expected) => {
    expect(parseClock(input)).toBe(expected);
  });

  it("describes relative time in words", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(relativeTime("2026-10-18T12:00:00Z", now)).toBe("2 days ago");
    expect(relativeTime("2026-10-20T11:59:50Z", now)).toBe("just now");
    expect(relativeTime(null, now)).toBe("never");
    expect(relativeTime("Tue, 20 Oct 2026 10:00:00 GMT", now)).toBe("2 hours ago");
  });
});

describe("youtube", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}&t=30s`, ID],
    [`https://youtu.be/${ID}?si=x`, ID],
    [`youtu.be/${ID}`, ID],
    [`https://www.youtube.com/shorts/${ID}`, ID],
    [ID, ID],
    ["https://example.com/watch?v=" + ID, null],
    ["not a link", null],
    ["https://www.youtube.com/watch?v=short", null],
  ])("extracts the id from %s", (input, expected) => {
    expect(extractVideoId(input)).toBe(expected);
  });

  it("builds seek links", () => {
    expect(watchUrl(ID, 83)).toBe(`https://youtu.be/${ID}?t=83`);
    expect(watchUrl(ID, 0)).toBe(`https://youtu.be/${ID}`);
  });
});

describe("citations", () => {
  it("splits text, bold and citations", () => {
    expect(parseAnswer("**Yes** at [83] and [6238].")).toEqual([
      { type: "bold", value: "Yes" },
      { type: "text", value: " at " },
      { type: "cite", seconds: 83 },
      { type: "text", value: " and " },
      { type: "cite", seconds: 6238 },
      { type: "text", value: "." },
    ]);
    expect(parseAnswer("plain")).toEqual([{ type: "text", value: "plain" }]);
  });
});

describe("auth", () => {
  const encode = (payload: object) => `x.${btoa(JSON.stringify(payload))}.y`;

  it("reads the user from a token and rejects expired or malformed ones", () => {
    const token = encode({ sub: "u1", username: "muskan", email: "m@x.co", exp: 2_000_000_000 });
    expect(userFromToken(token, 1_000_000_000_000)).toMatchObject({ id: "u1", username: "muskan" });
    expect(userFromToken(token, 3_000_000_000_000)).toBeNull();
    expect(userFromToken("garbage")).toBeNull();
    expect(userFromToken(null)).toBeNull();
    expect(decodeToken(encode({ sub: "u" }))).toEqual({ sub: "u" });
  });

  it("falls back to the email name when there is no username", () => {
    expect(userFromToken(encode({ sub: "u", email: "jane@x.co" }))?.username).toBe("jane");
  });
});

describe("api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearToken();
  });

  it("sends the bearer token and parses JSON", async () => {
    setToken("tok");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));

    await expect(api("/x", { method: "POST", body: { a: 1 } })).resolves.toEqual({ ok: 1 });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    expect(init.body).toBe('{"a":1}');
  });

  it("throws ApiError with the server message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Nope" }), { status: 409 }),
    );

    await expect(api("/x")).rejects.toMatchObject({ name: "ApiError", message: "Nope", status: 409 });
    await expect(api("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("clears the session and signals on 401, except for anonymous calls", async () => {
    setToken("tok");
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ message: "Token expired" }), { status: 401 }),
    );

    await expect(api("/x", { anonymous: true })).rejects.toThrow("Token expired");
    expect(listener).not.toHaveBeenCalled();
    await expect(api("/x")).rejects.toThrow("Token expired");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("clipnote_token")).toBeNull();
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("streams server-sent events into deltas and the final answer", async () => {
    const body = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('event: chunk\ndata: {"delta": "Hel"}\n\nevent: chunk\nda'));
        controller.enqueue(enc.encode('ta: {"delta": "lo"}\n\nevent: done\ndata: {"answer": "Hello"}\n\n'));
        controller.close();
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 200 }));
    const deltas: string[] = [];

    const answer = await streamClipchat(ID, "hi", (delta) => deltas.push(delta));

    expect(deltas).toEqual(["Hel", "lo"]);
    expect(answer).toBe("Hello");
  });
});

describe("shortcuts", () => {
  const press = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

  it("matches a shift chord by physical key, ignoring Option remapping", () => {
    expect(matchesShortcut(press({ metaKey: true, shiftKey: true, code: "KeyL", key: "¬" }), "library")).toBe(true);
  });

  it("accepts Ctrl in place of Cmd", () => {
    expect(matchesShortcut(press({ ctrlKey: true, code: "KeyK" }), "palette")).toBe(true);
  });

  it("rejects a bare key and a chord with the wrong modifiers", () => {
    expect(matchesShortcut(press({ code: "KeyK" }), "palette")).toBe(false);
    expect(matchesShortcut(press({ metaKey: true, code: "KeyL" }), "library")).toBe(false);
    expect(matchesShortcut(press({ metaKey: true, altKey: true, code: "KeyK" }), "palette")).toBe(false);
  });

  it("keeps save (Cmd Enter) distinct from mark moment (Cmd Shift Enter)", () => {
    expect(matchesShortcut(press({ metaKey: true, code: "Enter" }), "markMoment")).toBe(false);
    expect(matchesShortcut(press({ metaKey: true, shiftKey: true, code: "Enter" }), "markMoment")).toBe(true);
  });
});
