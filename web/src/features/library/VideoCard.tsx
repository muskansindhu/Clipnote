import { motion } from "framer-motion";
import { MessagesSquare, Star, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";
import type { LibraryVideo } from "@/lib/types";
import { thumbnailUrl } from "@/lib/youtube";

interface VideoCardProps {
  video: LibraryVideo;
  index: number;
  onToggleFavourite: (video: LibraryVideo) => void;
  onRemove: (video: LibraryVideo) => void;
}

const iconButton =
  "grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg";

/** One row of the library: thumbnail, title, and a quiet line of facts. */
export function VideoCard({ video, index, onToggleFavourite, onRemove }: VideoCardProps) {
  const notes = `${video.note_count} note${video.note_count === 1 ? "" : "s"}`;

  return (
    <motion.article
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.25 }}
      className="group relative flex items-center gap-5 py-4"
    >
      <Link to={`/${video.id}`} className="absolute inset-0 z-10" aria-label={`Open notes for ${video.video_title}`} />

      <img
        src={thumbnailUrl(video.id, "mq")}
        alt=""
        loading="lazy"
        className="aspect-video w-32 shrink-0 rounded-md bg-surface-3 object-cover sm:w-44"
      />

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-serif text-xl font-medium leading-snug tracking-tight group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
          {video.video_title}
        </h3>
        <p className="mt-1.5 text-[13px] text-fg-subtle">
          <span className="font-mono text-brand">{video.note_count}</span> {notes.replace(/^\d+ /, "")} · updated{" "}
          {relativeTime(video.last_note_at)}
        </p>
      </div>

      <div className="relative z-20 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          className={iconButton}
          onClick={() => onToggleFavourite(video)}
          aria-label={video.fav ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={video.fav}
        >
          <Star className={cn("size-4", video.fav && "fill-warning text-warning")} />
        </button>
        <Link to={`/clipchat/${video.id}`} aria-label="Chat with this video" className={iconButton}>
          <MessagesSquare className="size-4" />
        </Link>
        <button type="button" className={cn(iconButton, "hover:text-danger")} onClick={() => onRemove(video)} aria-label="Remove from library">
          <Trash2 className="size-4" />
        </button>
      </div>
    </motion.article>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="flex items-center gap-5 py-4">
      <div className="aspect-video w-44 animate-pulse rounded-md bg-surface-3/70" />
      <div className="flex-1 space-y-2">
        <div className="h-5 w-2/3 animate-pulse rounded bg-surface-3/70" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-surface-3/70" />
      </div>
    </div>
  );
}
