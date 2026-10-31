import { Clock } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Misc";
import { NOTE_META } from "@/features/video/noteMeta";
import { cn } from "@/lib/cn";
import { NOTE_TYPES } from "@/lib/constants";
import { formatShortcut, matchesShortcut } from "@/lib/shortcuts";
import { formatClock } from "@/lib/time";
import type { NoteType } from "@/lib/types";

export interface ComposerHandle {
  focus: () => void;
  /** Save an empty note at the current time and let the AI write it. */
  markMoment: () => void;
}

interface NoteComposerProps {
  /** Current player position, or `null` when the player is unavailable. */
  getTime: () => number | null;
  onSubmit: (input: { text: string; seconds: number | null; type: NoteType }) => Promise<void>;
  playerReady: boolean;
}

export const NoteComposer = forwardRef<ComposerHandle, NoteComposerProps>(function NoteComposer(
  { getTime, onSubmit, playerReady },
  ref,
) {
  const [text, setText] = useState("");
  const [type, setType] = useState<NoteType>("note");
  const [seconds, setSeconds] = useState<number | null>(null);
  const [wholeVideo, setWholeVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const stamp = () => (wholeVideo ? null : getTime());

  const submit = async (override?: { text: string; seconds: number | null }) => {
    const payload = override ?? { text: text.trim(), seconds: seconds ?? stamp() };
    setBusy(true);
    try {
      await onSubmit({ ...payload, type });
      setText("");
      setSeconds(null);
      setType("note");
    } finally {
      setBusy(false);
    }
  };

  useImperativeHandle(ref, () => ({
    focus: () => areaRef.current?.focus(),
    markMoment: () => void submit({ text: "", seconds: wholeVideo ? null : getTime() }),
  }));

  const shown = wholeVideo ? null : seconds ?? (playerReady ? getTime() : null);

  return (
    <div className="rounded-lg border border-line-strong bg-surface-1 p-3 focus-within:border-fg">
      <textarea
        ref={areaRef}
        value={text}
        rows={2}
        onFocus={() => seconds === null && setSeconds(stamp())}
        onChange={(event) => {
          setText(event.target.value);
          if (seconds === null) setSeconds(stamp());
        }}
        onKeyDown={(event) => {
          const save =
            matchesShortcut(event.nativeEvent, "saveNote") ||
            (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.shiftKey);
          if (!save) return;
          event.preventDefault(); // also stops the browser's own "save page" on Cmd S
          if (text.trim()) void submit();
        }}
        placeholder="What's worth remembering?"
        aria-label="New note"
        className="w-full resize-none bg-transparent px-2 py-1.5 font-serif text-[19px] leading-snug placeholder:text-fg-subtle focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        {NOTE_TYPES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            aria-pressed={type === value}
            title={NOTE_META[value].label}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
              type === value ? "bg-surface-2 text-fg" : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span>{NOTE_META[value].label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (wholeVideo) {
              setWholeVideo(false);
              setSeconds(null);
            } else if (seconds !== null && playerReady) {
              setSeconds(getTime());
            } else {
              setWholeVideo(true);
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 font-mono text-xs font-medium tabular-nums text-brand hover:bg-surface-2"
          title={wholeVideo ? "Switch back to a moment" : "Re-stamp with the current time; click again for the whole video"}
        >
          <Clock className="size-3.5" />
          {shown === null ? "Whole video" : formatClock(shown)}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => void submit({ text: "", seconds: stamp() })}
            title="Save this moment and let AI write the note from the transcript"
          >
            Mark & let AI write
            <Kbd className="ml-1 hidden sm:inline-flex">{formatShortcut("markMoment")}</Kbd>
          </Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!text.trim()} onClick={() => void submit()}>
            Add note <Kbd className="ml-1 hidden border-bg/30 bg-transparent text-bg/70 sm:inline-flex">{formatShortcut("saveNote")}</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
});
