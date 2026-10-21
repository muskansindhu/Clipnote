import { Clock, CornerDownLeft, Sparkles } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Misc";
import { NOTE_META } from "@/features/video/noteMeta";
import { cn } from "@/lib/cn";
import { NOTE_TYPES } from "@/lib/constants";
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
    <div className="rounded-2xl border border-line-strong bg-surface-1 p-3 shadow-card focus-within:border-violet/50 focus-within:ring-4 focus-within:ring-violet/10">
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
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && text.trim()) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="What's worth remembering?"
        aria-label="New note"
        className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed placeholder:text-fg-subtle focus:outline-none"
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
              "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors",
              type === value ? "bg-surface-3 text-fg" : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span className={NOTE_META[value].tone}>{NOTE_META[value].icon}</span>
            <span className={cn(type !== value && "hidden sm:inline")}>{NOTE_META[value].label}</span>
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
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet/12 px-3 font-mono text-xs font-semibold tabular-nums text-violet hover:bg-violet/20"
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
            <Sparkles className="size-3.5 text-violet" /> Mark & let AI write
            <Kbd className="ml-1 hidden sm:inline-flex">M</Kbd>
          </Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!text.trim()} onClick={() => void submit()}>
            Add note <CornerDownLeft className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});
