import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, CalendarRange, Flame, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AddVideoDialog } from "@/components/layout/AddVideoDialog";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { EmptyState, Segmented } from "@/components/ui/Misc";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { VideoCard, VideoCardSkeleton } from "@/features/library/VideoCard";
import { cn } from "@/lib/cn";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { useLabels, useLibrary, useRemoveVideo, useStats, useToggleFavourite } from "@/lib/queries";
import type { LibraryFilters, LibraryVideo, SortOption } from "@/lib/types";


export function LibraryPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [labels, setLabels] = useState<string[]>([]);
  const [range, setRange] = useState({ start: "", end: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<LibraryVideo | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = useMemo<LibraryFilters>(
    () => ({ search: debounced, sort, labels, start: range.start, end: range.end }),
    [debounced, sort, labels, range],
  );
  const library = useLibrary(filters);
  const stats = useStats();
  const labelList = useLabels();
  const toggleFav = useToggleFavourite();
  const remove = useRemoveVideo();

  const videos = library.data?.pages.flatMap((page) => page.videos) ?? [];
  const isFiltering = Boolean(debounced || labels.length || range.start || range.end);

  // Load the next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !library.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && !library.isFetchingNextPage && void library.fetchNextPage(),
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [library.hasNextPage, library.isFetchingNextPage, library.fetchNextPage, library]);

  const toggleLabel = (name: string) =>
    setLabels((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  const clearFilters = () => {
    setSearch("");
    setLabels([]);
    setRange({ start: "", end: "" });
  };

  const confirmRemove = () => {
    if (!removing) return;
    remove.mutate(removing.id, {
      onSuccess: () => {
        toast.success("Removed from your library");
        setRemoving(null);
      },
      onError: () => toast.error("Couldn't remove that video. Try again."),
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="font-serif text-[44px] font-medium leading-none tracking-tight">Library</h1>
          <p className="mt-3 text-sm text-fg-muted">
            {stats.data
              ? `${stats.data.videos} videos · ${stats.data.notes} notes · ${stats.data.notes_this_week} this week`
              : "\u00a0"}
          </p>
        </div>
      </header>

      {stats.data && stats.data.pending > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 border-l-2 border-ai pl-3 text-sm"
        >
          <span>
            <strong className="font-semibold">{stats.data.pending}</strong> note{stats.data.pending === 1 ? " is" : "s are"} being
            written in the background. They'll fill in on their own.
          </span>
        </motion.div>
      )}

      {/* Toolbar */}
      <section aria-label="Filters" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your videos…"
              aria-label="Search your videos"
              className="pl-10 pr-10"
              type="search"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <DateRange range={range} onChange={setRange} />
          <Segmented
            label="Sort order"
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: "Recent" },
              { value: "title", label: "A–Z" },
            ]}
          />
        </div>

        {(labelList.data?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by label">
            {labelList.data?.map((label) => {
              const selected = labels.includes(label.label_name);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleLabel(label.label_name)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors",
                    selected
                      ? "border-fg bg-fg text-bg"
                      : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                  )}
                >
                  <Bookmark className="size-3" /> {label.label_name}
                </button>
              );
            })}
            {isFiltering && (
              <button type="button" onClick={clearFilters} className="px-2 text-[13px] text-fg-subtle hover:text-fg">
                Clear all
              </button>
            )}
          </div>
        )}
      </section>

      {/* Results */}
      {library.isPending ? (
        <div className="divide-y divide-line">
          {Array.from({ length: 6 }, (_, index) => (
            <VideoCardSkeleton key={index} />
          ))}
        </div>
      ) : library.isError ? (
        <EmptyState
          icon={<Flame className="size-6" />}
          title="Couldn't load your library"
          description="Check your connection and try again."
          action={<Button onClick={() => void library.refetch()}>Try again</Button>}
        />
      ) : videos.length === 0 ? (
        isFiltering ? (
          <EmptyState
            icon={<Search className="size-6" />}
            title="No videos match"
            description="Try a different search, or clear your filters."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <FirstRun onAdd={() => setAddOpen(true)} />
        )
      ) : (
        <>
          <div className="divide-y divide-line">
            <AnimatePresence mode="popLayout">
              {videos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={index}
                  onToggleFavourite={(item) => toggleFav.mutate({ videoId: item.id, fav: !item.fav })}
                  onRemove={setRemoving}
                />
              ))}
            </AnimatePresence>
          </div>
          <div ref={sentinel} className="flex justify-center py-6">
            {library.isFetchingNextPage ? (
              <span className="text-sm text-fg-subtle">Loading more…</span>
            ) : library.hasNextPage ? (
              <Button onClick={() => void library.fetchNextPage()}>Load more</Button>
            ) : (
              <span className="text-xs text-fg-subtle">That's everything.</span>
            )}
          </div>
        </>
      )}

      <AddVideoDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        loading={remove.isPending}
        title="Remove this video?"
        description={`This deletes your ${removing?.note_count ?? 0} note(s) on “${removing?.video_title ?? ""}”. This can't be undone.`}
        confirmLabel="Remove"
      />
    </div>
  );
}

function DateRange({ range, onChange }: { range: { start: string; end: string }; onChange: (range: { start: string; end: string }) => void }) {
  const active = Boolean(range.start || range.end);
  return (
    <Popover
      className="w-72 p-4"
      trigger={({ toggle }) => (
        <Button variant="secondary" onClick={toggle} className={cn("h-11", active && "border-fg")} aria-label="Filter by date">
          <CalendarRange className="size-4" />
          <span className="hidden sm:inline">{active ? "Date set" : "Any time"}</span>
        </Button>
      )}
    >
      {({ close }) => (
        <div className="space-y-3">
          <label className="block text-[13px] font-medium text-fg-muted">
            From
            <Input type="date" value={range.start} onChange={(event) => onChange({ ...range, start: event.target.value })} className="mt-1.5" />
          </label>
          <label className="block text-[13px] font-medium text-fg-muted">
            To
            <Input type="date" value={range.end} onChange={(event) => onChange({ ...range, end: event.target.value })} className="mt-1.5" />
          </label>
          <div className="flex justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={() => onChange({ start: "", end: "" })}>
              Reset
            </Button>
            <Button variant="primary" size="sm" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

function FirstRun({ onAdd }: { onAdd: () => void }) {
  const steps = [
    { title: "Paste a video", body: "Open any YouTube link and write a note at the moment that matters." },
    { title: "Capture on the go", body: "Use the Chrome extension, or share from the YouTube app on your iPhone." },
    { title: "Let AI help", body: "Leave a note empty and Clipnote writes it from the transcript." },
  ];
  return (
    <div className="py-16">
      <h2 className="max-w-xl font-serif text-4xl font-medium leading-tight tracking-tight">Nothing here yet. Add the first video you want to remember.</h2>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={onAdd}>
          <Plus className="size-4" /> Add a video
        </Button>
        <Link to="/profile#capture" className={buttonStyles("secondary", "lg")}>
          Set up iPhone sharing
        </Link>
      </div>
      <ol className="mt-14 grid max-w-4xl gap-x-10 gap-y-6 border-t border-line pt-8 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="font-mono text-xs text-brand">0{index + 1}</span>
            <h3 className="mt-2 font-medium">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
