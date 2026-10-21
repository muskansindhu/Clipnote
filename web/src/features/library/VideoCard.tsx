import { motion } from "framer-motion";
import { MessagesSquare, NotebookText, Star, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";
import type { LibraryVideo } from "@/lib/types";
import { thumbnailUrl } from "@/lib/youtube";

interface VideoCardProps {
  video: LibraryVideo;
  layout: "grid" | "list";
  index: number;
  onToggleFavourite: (video: LibraryVideo) => void;
  onRemove: (video: LibraryVideo) => void;
}

export function VideoCard({ video, layout, index, onToggleFavourite, onRemove }: VideoCardProps) {
  const isList = layout === "list";
  const notes = `${video.note_count} note${video.note_count === 1 ? "" : "s"}`;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.35 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong",
        isList && "flex items-center gap-4 p-3 hover:translate-y-0",
      )}
    >
      <Link
        to={`/${video.id}`}
        className="absolute inset-0 z-10 rounded-2xl"
        aria-label={`Open notes for ${video.video_title}`}
      />

      <div className={cn("relative overflow-hidden bg-surface-3", isList ? "aspect-video w-36 shrink-0 rounded-xl sm:w-44" : "aspect-video")}>
        <img
          src={thumbnailUrl(video.id, "mq")}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          <NotebookText className="size-3" /> {notes}
        </span>
      </div>

      <div className={cn("min-w-0", isList ? "flex-1" : "p-4")}>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">{video.video_title}</h3>
        <p className="mt-1.5 text-xs text-fg-subtle">Updated {relativeTime(video.last_note_at)}</p>
      </div>

      <div
        className={cn(
          "relative z-20 flex items-center gap-1",
          isList ? "pr-1" : "absolute right-2 top-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
          video.fav && !isList && "opacity-100",
        )}
      >
        <Button
          variant="secondary"
          size="icon-sm"
          className="bg-black/55 text-white backdrop-blur hover:bg-black/70 hover:text-white [&]:border-white/15 sm:data-[list=true]:bg-surface-2"
          data-list={isList}
          onClick={() => onToggleFavourite(video)}
          aria-label={video.fav ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={video.fav}
        >
          <Star className={cn("size-4", video.fav && "fill-warning text-warning")} />
        </Button>
        {!isList && (
          <Link
            to={`/clipchat/${video.id}`}
            aria-label="Chat with this video"
            className="grid size-8 place-items-center rounded-xl border border-white/15 bg-black/55 text-white backdrop-blur hover:bg-black/70"
          >
            <MessagesSquare className="size-4" />
          </Link>
        )}
        <Button
          variant="secondary"
          size="icon-sm"
          className={cn(!isList && "bg-black/55 text-white backdrop-blur hover:bg-black/70 hover:text-danger [&]:border-white/15")}
          onClick={() => onRemove(video)}
          aria-label="Remove from library"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </motion.article>
  );
}

export function VideoCardSkeleton({ layout }: { layout: "grid" | "list" }) {
  return layout === "grid" ? (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-1">
      <div className="aspect-video animate-pulse bg-surface-3/70" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-11/12 animate-pulse rounded bg-surface-3/70" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-3/70" />
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface-1 p-3">
      <div className="aspect-video w-44 animate-pulse rounded-xl bg-surface-3/70" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-3/70" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-surface-3/70" />
      </div>
    </div>
  );
}
