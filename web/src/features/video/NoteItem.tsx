import { motion } from "framer-motion";
import { Check, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { NOTE_META } from "@/features/video/noteMeta";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/time";
import type { Note } from "@/lib/types";

interface NoteItemProps {
  note: Note;
  active: boolean;
  onSeek: (seconds: number) => void;
  onSave: (noteId: number, text: string) => Promise<void>;
  onDelete: (note: Note) => void;
}

export function NoteItem({ note, active, onSeek, onSave, onDelete }: NoteItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.note ?? "");
  const [saving, setSaving] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const meta = NOTE_META[note.note_type];
  const isAi = note.note_source === "ai";
  const pending = note.status === "pending";
  const failed = note.status === "failed" && !note.note;
  const seconds = note.timestamp_seconds;

  useEffect(() => {
    if (editing) {
      areaRef.current?.focus();
      areaRef.current?.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const startEdit = () => {
    setDraft(note.note ?? "");
    setEditing(true);
  };
  const save = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      await onSave(note.id, text);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      data-note-id={note.id}
      className={cn(
        "group relative grid grid-cols-[3.75rem_1fr] gap-x-4 border-l-2 py-4 pl-4 transition-colors",
        active ? "border-brand" : "border-transparent",
      )}
    >
      <div className="pt-1">
        {seconds === null ? (
          <span className="text-xs text-fg-subtle">Whole video</span>
        ) : (
          <button
            type="button"
            onClick={() => onSeek(seconds)}
            title="Jump to this moment"
            className="font-mono text-[13px] font-medium tabular-nums text-brand hover:underline"
          >
            {formatClock(seconds)}
          </button>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex h-5 items-center gap-2 text-xs">
          {note.note_type !== "note" && <span className={cn("font-medium", meta.tone)}>{meta.label}</span>}
          {isAi && <span className="rounded border border-ai/40 px-1 text-[10px] font-semibold uppercase tracking-wide text-ai">AI</span>}
          {!editing && (
            <span className="ml-auto flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button variant="ghost" size="icon-sm" className="size-6" onClick={startEdit} aria-label="Edit note">
                <Pencil className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => onDelete(note)} aria-label="Delete note">
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              ref={areaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false);
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void save();
              }}
              aria-label="Edit note text"
              className="min-h-20"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="size-3.5" /> Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={() => void save()} loading={saving} disabled={!draft.trim()}>
                <Check className="size-3.5" /> Save
              </Button>
            </div>
          </div>
        ) : pending ? (
          <p className="shimmer mt-1 py-1 font-serif text-lg italic text-fg-muted" role="status">
            Writing your note…
          </p>
        ) : failed ? (
          <p className="mt-1 flex items-center gap-2 text-sm italic text-warning">
            <TriangleAlert className="size-3.5 shrink-0" />
            AI couldn't write this one.
            <button type="button" onClick={startEdit} className="font-medium not-italic text-fg underline underline-offset-2">
              Write your own
            </button>
          </p>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words font-serif text-[19px] leading-snug">{note.note}</p>
        )}
      </div>
    </motion.li>
  );
}
