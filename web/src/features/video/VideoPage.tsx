import { AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  MessagesSquare,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Kbd, Skeleton } from "@/components/ui/Misc";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { NoteComposer, type ComposerHandle } from "@/features/video/NoteComposer";
import { NoteItem } from "@/features/video/NoteItem";
import { NOTE_META } from "@/features/video/noteMeta";
import { Player, type PlayerHandle } from "@/features/video/Player";
import { downloadFile, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { NOTE_TYPES } from "@/lib/constants";
import { useLabels, useVideo, useVideoActions } from "@/lib/queries";
import { formatClock } from "@/lib/time";
import type { Note, NoteType } from "@/lib/types";
import { formatShortcut, matchesShortcut } from "@/lib/shortcuts";
import { watchUrl } from "@/lib/youtube";

type Filter = "all" | NoteType;

export function VideoPage() {
  const { videoId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const video = useVideo(videoId);
  const labels = useLabels();
  const actions = useVideoActions(videoId);
  const playerRef = useRef<PlayerHandle>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const [now, setNow] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [removing, setRemoving] = useState(false);

  const notes = video.data?.notes;
  const sorted = useMemo(
    () =>
      [...(notes ?? [])].sort((a, b) => {
        if (a.timestamp_seconds === null && b.timestamp_seconds === null) return a.id - b.id;
        if (a.timestamp_seconds === null) return 1;
        if (b.timestamp_seconds === null) return -1;
        return a.timestamp_seconds - b.timestamp_seconds || a.id - b.id;
      }),
    [notes],
  );
  const visible = sorted.filter((note) => filter === "all" || note.note_type === filter);
  const timed = visible.filter((note) => note.timestamp_seconds !== null);
  const untimed = visible.filter((note) => note.timestamp_seconds === null);
  const activeId = useMemo(() => {
    let current: number | null = null;
    for (const note of sorted) {
      if (note.timestamp_seconds !== null && note.timestamp_seconds <= now && playerReady) current = note.id;
    }
    return current;
  }, [sorted, now, playerReady]);

  const getTime = useCallback(() => playerRef.current?.currentTime() ?? null, []);
  const seek = useCallback((seconds: number) => playerRef.current?.seek(seconds), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (matchesShortcut(event, "newNote")) composerRef.current?.focus();
      else if (matchesShortcut(event, "markMoment")) composerRef.current?.markMoment();
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const addNote = async (input: { text: string; seconds: number | null; type: NoteType }) => {
    try {
      const result = await actions.createNote.mutateAsync({ ...input, title: video.data?.video.title });
      const at = result.note.timestamp_seconds;
      toast.success(
        result.duplicate
          ? "Already saved"
          : input.text
            ? `Saved${at !== null ? ` at ${formatClock(at)}` : ""}`
            : "Marked. AI is writing it…",
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save that note.");
      throw error;
    }
  };

  const saveEdit = async (noteId: number, text: string) => {
    try {
      await actions.updateNote.mutateAsync({ noteId, text });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the note.");
      throw error;
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    actions.deleteNote.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success("Note deleted");
      },
      onError: () => toast.error("Couldn't delete that note."),
    });
  };

  const exportMarkdown = async () => {
    try {
      await downloadFile(`/api/export/${videoId}`, "clipnote.md");
      toast.success("Markdown downloaded");
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 404 ? "Add a note first, then export." : "Export failed.");
    }
  };

  const removeVideo = () =>
    actions.removeVideo.mutate(undefined, {
      onSuccess: () => {
        toast.success("Removed from your library");
        navigate("/dashboard");
      },
      onError: () => toast.error("Couldn't remove that video."),
    });

  if (video.isError) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold">We couldn't open that video</h1>
        <p className="mt-2 text-fg-muted">{video.error instanceof ApiError ? video.error.message : "Please try again."}</p>
        <Link to="/dashboard" className={buttonStyles("secondary", "md", "mt-6")}>
          Back to library
        </Link>
      </div>
    );
  }

  const detail = video.data;
  const counts = (type: Filter) => (type === "all" ? sorted.length : sorted.filter((note) => note.note_type === type).length);

  return (
    <div className="space-y-8">
      <header className="border-b border-line pb-6">
        <div>
        {detail ? (
          <h1 className="max-w-4xl font-serif text-[34px] font-medium leading-[1.1] tracking-tight sm:text-[44px]">{detail.video.title}</h1>
        ) : (
          <Skeleton className="h-8 w-3/4" />
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-pressed={detail?.fav}
            disabled={!detail || sorted.length === 0}
            onClick={() => actions.setFavourite.mutate(!detail?.fav)}
            title={sorted.length === 0 ? "Add a note to favourite this video" : undefined}
          >
            <Star className={cn("size-3.5", detail?.fav && "fill-warning text-warning")} />
            {detail?.fav ? "Favourite" : "Favourite"}
          </Button>

          <Popover
            align="start"
            className="w-60"
            trigger={({ toggle }) => (
              <Button variant="secondary" size="sm" onClick={toggle} disabled={sorted.length === 0}>
                <Bookmark className="size-3.5" />
                {detail?.label ?? "Label"}
                <ChevronDown className="size-3.5 text-fg-subtle" />
              </Button>
            )}
          >
            {({ close }) => (
              <div role="menu">
                <MenuItem
                  icon={detail?.label ? undefined : <Check />}
                  onClick={() => {
                    actions.setLabel.mutate(null);
                    close();
                  }}
                >
                  No label
                </MenuItem>
                {labels.data?.map((label) => (
                  <MenuItem
                    key={label.id}
                    icon={detail?.label === label.label_name ? <Check /> : undefined}
                    onClick={() => {
                      actions.setLabel.mutate(label.label_name);
                      close();
                    }}
                  >
                    {label.label_name}
                  </MenuItem>
                ))}
                {labels.data?.length === 0 && (
                  <p className="px-3 py-2 text-xs text-fg-subtle">
                    No labels yet. Create some in <Link to="/profile" className="underline underline-offset-2">Settings</Link>.
                  </p>
                )}
              </div>
            )}
          </Popover>

          <Button variant="secondary" size="sm" onClick={() => void exportMarkdown()} disabled={sorted.length === 0}>
            <Download className="size-3.5" /> Export
          </Button>
          <Link to={`/clipchat/${videoId}`} className={buttonStyles("secondary", "sm")}>
            <MessagesSquare className="size-3.5" /> Chat
          </Link>
          <a href={watchUrl(videoId)} target="_blank" rel="noreferrer" className={buttonStyles("ghost", "sm")}>
            YouTube <ExternalLink className="size-3.5" />
          </a>
          {sorted.length > 0 && (
            <Button variant="ghost" size="sm" className="ml-auto hover:text-danger" onClick={() => setRemoving(true)}>
              <Trash2 className="size-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      </header>

    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {/* Player column */}
      <section className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <Player ref={playerRef} videoId={videoId} onTick={setNow} onReadyChange={setPlayerReady} />

        {detail?.video.summary && (
          <details className="group border-t border-line pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
              AI summary
              <ChevronDown className="ml-auto size-4 text-fg-subtle transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{detail.video.summary}</p>
          </details>
        )}
      </section>

      {/* Notes column */}
      <section aria-label="Notes" className="min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-baseline gap-2 font-serif text-2xl font-medium tracking-tight">
            Notes <span className="font-mono text-sm text-fg-subtle">{sorted.length}</span>
          </h2>
          <span className="hidden items-center gap-1.5 text-xs text-fg-subtle sm:flex">
            <Kbd>{formatShortcut("newNote")}</Kbd> new <Kbd>{formatShortcut("markMoment")}</Kbd> mark
          </span>
        </div>

        <NoteComposer ref={composerRef} getTime={getTime} onSubmit={addNote} playerReady={playerReady} />

        {sorted.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter notes by type">
            {(["all", ...NOTE_TYPES] as const)
              .filter((type) => type === "all" || counts(type) > 0)
              .map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={filter === type}
                  onClick={() => setFilter(type)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                    filter === type
                      ? "border-fg bg-fg text-bg"
                      : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  {type === "all" ? "All" : NOTE_META[type].label}
                  <span className="font-mono text-[11px] opacity-70">{counts(type)}</span>
                </button>
              ))}
          </div>
        )}

        {video.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-24" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="border-t border-line py-10">
            <p className="font-serif text-2xl font-medium">No notes yet</p>
            <p className="mt-1 max-w-xs text-sm text-fg-muted">
              Play the video and write your first note above. It's stamped with the time you're watching.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">No notes of this type.</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {timed.map((note) => (
                  <NoteItem key={note.id} note={note} active={note.id === activeId} onSeek={seek} onSave={saveEdit} onDelete={setDeleting} />
                ))}
              </AnimatePresence>
            </ul>
            {untimed.length > 0 && (
              <>
                <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">About the whole video</h3>
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>
                    {untimed.map((note) => (
                      <NoteItem key={note.id} note={note} active={false} onSeek={seek} onSave={saveEdit} onDelete={setDeleting} />
                    ))}
                  </AnimatePresence>
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={actions.deleteNote.isPending}
        title="Delete this note?"
        description="This can't be undone."
      />
      <ConfirmDialog
        open={removing}
        onClose={() => setRemoving(false)}
        onConfirm={removeVideo}
        loading={actions.removeVideo.isPending}
        title="Remove this video?"
        description={`This deletes all ${sorted.length} of your notes on it. This can't be undone.`}
        confirmLabel="Remove"
      />
    </div>
  );
}
