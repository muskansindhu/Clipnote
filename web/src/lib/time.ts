const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** Format whole seconds as `m:ss` or, from one hour up, `h:mm:ss` (YouTube style). */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/** Parse `1:23`, `01:02:03` or `45` into whole seconds; returns `null` when invalid. */
export function parseClock(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) {
    return null;
  }
  const total = parts.reduce((sum, part) => sum * SECONDS_PER_MINUTE + Number(part), 0);
  return Math.round(total);
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "2 days ago", "just now". Accepts ISO or RFC-822 strings (what the API returns). */
export function relativeTime(value: string | Date | null | undefined, now = new Date()): string {
  if (!value) return "never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(diffSeconds) >= size) {
      return formatter.format(Math.round(diffSeconds / size), unit);
    }
  }
  return "just now";
}

/** "20 Oct 2026". */
export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return "never";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}
