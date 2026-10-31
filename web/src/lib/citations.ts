/** Splits a Clipchat answer into text, **bold** and `[seconds]` citation segments. */
export type AnswerSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "cite"; seconds: number };

const TOKEN_PATTERN = /\*\*([^*]+)\*\*|\[(\d+)\]/g;

export function parseAnswer(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;
  for (const match of answer.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ type: "text", value: answer.slice(cursor, index) });
    if (match[1] !== undefined) segments.push({ type: "bold", value: match[1] });
    else segments.push({ type: "cite", seconds: Number(match[2]) });
    cursor = index + match[0].length;
  }
  if (cursor < answer.length) segments.push({ type: "text", value: answer.slice(cursor) });
  return segments;
}
