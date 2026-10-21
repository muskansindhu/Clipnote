import { motion } from "framer-motion";
import { Bot, Check, Pencil, Sparkles, Trash2, TriangleAlert, User, X } from "lucide-react";
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      data-note-id={note.id}
      className={cn(
        "group relative rounded-2xl border bg-surface-1 p-4 transition-colors",
        active ? "border-violet/50 shadow-[0_0_0_3px_var(--glow-violet)]" : "border-line hover:border-line-strong",
      )}
    >
      <div className="flex items-center gap-2">
        {seconds === null ? (
          <span className="rounded-lg bg-surface-3 px-2.5 py-1 text-xs font-medium text-fg-muted">Whole video</span>
        ) : (
          <button
            type="button"
            onClick={() => onSeek(seconds)}
            title="Jump to this moment"
            className="rounded-lg bg-violet/14 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-violet transition-colors hover:bg-violet/25"
          >
            {formatClock(seconds)}
          </button>
        )}
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.tone)}>
          {meta.icon} {note.note_type !== "note" && meta.label}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span
            className="grid size-6 place-items-center rounded-full bg-surface-2 text-fg-subtle"
            title={isAi ? "Written by AI" : "Written by you"}
          >
            {isAi ? <Bot className="size-3.5 text-violet" /> : <User className="size-3.5" />}
          </span>
          {!editing && (
            <span className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button variant="ghost" size="icon-sm" onClick={startEdit} aria-label="Edit note">
                <Pencil className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onDelete(note)} aria-label="Delete note">
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          )}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
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
        <p className="shimmer mt-3 rounded-lg py-1 text-sm italic text-fg-muted" role="status">
          <Sparkles className="mr-1.5 inline size-3.5 text-violet" />
          Writing your note…
        </p>
      ) : failed ? (
        <p className="mt-3 flex items-center gap-2 text-sm italic text-warning">
          <TriangleAlert className="size-3.5 shrink-0" />
          AI couldn't write this one.
          <button type="button" onClick={startEdit} className="font-medium not-italic text-violet hover:underline">
            Write your own
          </button>
        </p>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{note.note}</p>
      )}
    </motion.li>
  );
}
