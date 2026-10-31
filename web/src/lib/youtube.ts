import { VIDEO_ID_PATTERN } from "@/lib/constants";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);
const ID_PATH_PREFIXES = new Set(["shorts", "embed", "live", "v"]);

export function isVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}

/** Extract a video id from a pasted URL (or a bare 11-character id); `null` if none. */
export function extractVideoId(input: string): string | null {
  const text = input.trim();
  if (isVideoId(text)) return text;
  let url: URL;
  try {
    url = new URL(text.includes("://") ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let candidate: string | null | undefined = null;
  if (SHORT_HOSTS.has(host)) {
    candidate = segments[0];
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === "watch") candidate = url.searchParams.get("v");
    else if (segments.length > 1 && ID_PATH_PREFIXES.has(segments[0] ?? "")) candidate = segments[1];
  }
  return candidate && isVideoId(candidate) ? candidate : null;
}

export const thumbnailUrl = (videoId: string, quality: "hq" | "maxres" | "mq" = "hq"): string =>
  `https://i.ytimg.com/vi/${videoId}/${quality}default.jpg`;

export const watchUrl = (videoId: string, seconds?: number | null): string =>
  seconds ? `https://youtu.be/${videoId}?t=${Math.floor(seconds)}` : `https://youtu.be/${videoId}`;

let apiPromise: Promise<typeof YT> | null = null;

/** Load the YouTube IFrame API once. Rejects when the script cannot be fetched (offline). */
export function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<typeof YT>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("The YouTube player could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
