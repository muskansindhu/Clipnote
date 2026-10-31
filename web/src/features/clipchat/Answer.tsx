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
    <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed">
      {parseAnswer(text).map((segment, index) => (
        <Fragment key={index}>
          {segment.type === "text" && segment.value}
          {segment.type === "bold" && <strong className="font-semibold">{segment.value}</strong>}
          {segment.type === "cite" && (
            <button
              type="button"
              onClick={() => onSeek(segment.seconds)}
              title="Jump to this moment"
              className="mx-0.5 align-baseline font-mono text-xs font-medium tabular-nums text-brand underline-offset-2 hover:underline"
            >
              {formatClock(segment.seconds)}
            </button>
          )}
        </Fragment>
      ))}
    </p>
  );
}
