import { Fragment } from "react";
import { parseAnswer } from "@/lib/citations";
import { formatClock } from "@/lib/time";

interface AnswerProps {
  text: string;
  onSeek: (seconds: number) => void;
}

/** Renders a Clipchat answer with **bold** text and clickable `[seconds]` citations. */
export function Answer({ text, onSeek }: AnswerProps) {
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
      {parseAnswer(text).map((segment, index) => (
        <Fragment key={index}>
          {segment.type === "text" && segment.value}
          {segment.type === "bold" && <strong className="font-semibold">{segment.value}</strong>}
          {segment.type === "cite" && (
            <button
              type="button"
              onClick={() => onSeek(segment.seconds)}
              title="Jump to this moment"
              className="mx-0.5 inline-flex items-center rounded-md bg-violet/14 px-1.5 py-0.5 align-baseline font-mono text-xs font-semibold tabular-nums text-violet transition-colors hover:bg-violet/28"
            >
              {formatClock(segment.seconds)}
            </button>
          )}
        </Fragment>
      ))}
    </p>
  );
}
