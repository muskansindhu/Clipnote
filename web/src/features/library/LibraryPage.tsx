import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, CalendarRange, Film, Flame, Grid2x2, Library, Plus, Rows3, Search, Sparkles, Star, X } from "lucide-react";
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
import { useSession } from "@/lib/session";
import type { LibraryFilters, LibraryVideo, SortOption } from "@/lib/types";

type Layout = "grid" | "list";
const LAYOUT_KEY = "clipnote:library-layout";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function LibraryPage() {
  const { user } = useSession();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [labels, setLabels] = useState<string[]>([]);
  const [range, setRange] = useState({ start: "", end: "" });
  const [layout, setLayout] = useState<Layout>(() => (localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid"));
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

  const changeLayout = (next: Layout) => {
    setLayout(next);
    localStorage.setItem(LAYOUT_KEY, next);
  };
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet">{greeting()}, {user?.username}</p>
          <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight">Your library</h1>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)} className="sm:hidden">
          <Plus className="size-4" /> Add video
        </Button>
      </header>

      <StatsStrip stats={stats.data} loading={stats.isPending} />

      {stats.data && stats.data.pending > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-violet/25 bg-violet/8 px-4 py-3 text-sm"
        >
          <Sparkles className="size-4 shrink-0 text-violet" />
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
          <Segmented
            label="Layout"
            value={layout}
            onChange={changeLayout}
            options={[
              { value: "grid", label: <Grid2x2 className="size-4" />, ariaLabel: "Grid view" },
              { value: "list", label: <Rows3 className="size-4" />, ariaLabel: "List view" },
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
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    selected
                      ? "border-violet/40 bg-violet/14 text-violet"
                      : "border-line bg-surface-1 text-fg-muted hover:border-line-strong hover:text-fg",
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
        <div className={cn("grid gap-5", layout === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
          {Array.from({ length: 6 }, (_, index) => (
            <VideoCardSkeleton key={index} layout={layout} />
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
          <motion.div
            layout
            className={cn("grid gap-5", layout === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 gap-3")}
          >
            <AnimatePresence mode="popLayout">
              {videos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  layout={layout}
                  index={index}
                  onToggleFavourite={(item) => toggleFav.mutate({ videoId: item.id, fav: !item.fav })}
                  onRemove={setRemoving}
                />
              ))}
            </AnimatePresence>
          </motion.div>
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

function StatsStrip({ stats, loading }: { stats: ReturnType<typeof useStats>["data"]; loading: boolean }) {
  const items = [
    { label: "Videos", value: stats?.videos, icon: Film, tone: "text-violet" },
    { label: "Notes", value: stats?.notes, icon: Library, tone: "text-brand" },
    { label: "This week", value: stats?.notes_this_week, icon: Flame, tone: "text-warning" },
    { label: "Favourites", value: stats?.favourites, icon: Star, tone: "text-warning" },
  ];
  return (
    <section aria-label="Library stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="rounded-2xl border border-line bg-surface-1 p-4 shadow-card"
        >
          <div className="flex items-center justify-between text-fg-subtle">
            <span className="text-[13px] font-medium">{item.label}</span>
            <item.icon className={cn("size-4", item.tone)} aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight">
            {loading ? <span className="inline-block h-8 w-10 animate-pulse rounded bg-surface-3/70" /> : item.value ?? 0}
          </p>
        </motion.div>
      ))}
    </section>
  );
}

function DateRange({ range, onChange }: { range: { start: string; end: string }; onChange: (range: { start: string; end: string }) => void }) {
  const active = Boolean(range.start || range.end);
  return (
    <Popover
      className="w-72 p-4"
      trigger={({ toggle }) => (
        <Button variant="secondary" onClick={toggle} className={cn("h-11", active && "border-violet/40 text-violet")} aria-label="Filter by date">
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
    { title: "Paste a video", body: "Open any YouTube link and add your first note at the moment that matters." },
    { title: "Capture on the go", body: "Use the Chrome extension, or share from the YouTube app on your iPhone." },
    { title: "Let AI help", body: "Leave a note empty and Clipnote writes it from the transcript." },
  ];
  return (
    <div className="rounded-3xl border border-dashed border-line-strong bg-surface-1/50 px-6 py-14 text-center">
      <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-[0_12px_32px_-10px_var(--glow-brand)]">
        <Sparkles className="size-6" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">Your library is empty. Let's fix that.</h2>
      <p className="mx-auto mt-2 max-w-md text-fg-muted">Add your first video and Clipnote starts remembering for you.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" size="lg" onClick={onAdd}>
          <Plus className="size-4" /> Add a video
        </Button>
        <Link to="/profile#capture" className={buttonStyles("secondary", "lg")}>
          Set up iPhone sharing
        </Link>
      </div>
      <ol className="mx-auto mt-12 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-line bg-surface-1 p-5">
            <span className="font-mono text-xs text-violet">0{index + 1}</span>
            <h3 className="mt-2 font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
