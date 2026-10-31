import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Keyboard, Library, LogOut, MessagesSquare, Moon, Plus, Search, Settings, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Misc";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { useSession } from "@/lib/session";
import { formatShortcut } from "@/lib/shortcuts";
import type { LibraryPage } from "@/lib/types";
import { extractVideoId, thumbnailUrl } from "@/lib/youtube";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
  thumb?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAddVideo: () => void;
  onShowShortcuts: () => void;
}

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** ⌘K: jump anywhere, search the library, open a pasted YouTube link. */
export function CommandPalette({ open, onClose, onAddVideo, onShowShortcuts }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { signOut, setTheme, theme } = useSession();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const pastedId = extractVideoId(query);

  const results = useQuery({
    queryKey: ["palette-search", debounced],
    queryFn: () => api<LibraryPage>(`/all-video?search=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length > 1 && !pastedId,
  });

  const go = (path: string) => () => {
    onClose();
    navigate(path);
  };

  const commands = useMemo<Command[]>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (label: string) => !needle || label.toLowerCase().includes(needle);
    const list: Command[] = [];
    if (pastedId) {
      list.push(
        { id: "open-video", label: "Open video and take notes", icon: <Video className="size-4" />, run: go(`/${pastedId}`), thumb: thumbnailUrl(pastedId, "mq") },
        { id: "chat-video", label: "Chat with this video", icon: <MessagesSquare className="size-4" />, run: go(`/clipchat/${pastedId}`) },
      );
      return list;
    }
    const base: Command[] = [
      { id: "library", label: "Go to Library", hint: formatShortcut("library"), icon: <Library className="size-4" />, run: go("/dashboard") },
      { id: "clipchat", label: "Go to Clipchat", hint: formatShortcut("clipchat"), icon: <MessagesSquare className="size-4" />, run: go("/clipchat") },
      { id: "settings", label: "Go to Settings", hint: formatShortcut("settings"), icon: <Settings className="size-4" />, run: go("/profile") },
      { id: "add", label: "Add a video…", hint: formatShortcut("addVideo"), icon: <Plus className="size-4" />, run: () => { onClose(); onAddVideo(); } },
      { id: "help", label: "Keyboard shortcuts", hint: formatShortcut("help"), icon: <Keyboard className="size-4" />, run: () => { onClose(); onShowShortcuts(); } },
      {
        id: "theme",
        label: `Switch theme (now ${theme})`,
        icon: <Moon className="size-4" />,
        run: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          onClose();
        },
      },
      { id: "signout", label: "Sign out", icon: <LogOut className="size-4" />, run: () => { onClose(); signOut(); navigate("/"); } },
    ];
    list.push(...base.filter((command) => matches(command.label)));
    for (const video of results.data?.videos ?? []) {
      list.push({
        id: `video-${video.id}`,
        label: video.video_title,
        hint: `${video.note_count} note${video.note_count === 1 ? "" : "s"}`,
        icon: <Video className="size-4" />,
        thumb: thumbnailUrl(video.id, "mq"),
        run: go(`/${video.id}`),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pastedId, results.data, theme]);

  useEffect(() => setActive(0), [query, results.data]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, commands.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commands[active]?.run();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Command palette" hideTitle align="top" className="max-w-xl p-0">
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your library, or paste a YouTube link…"
            aria-label="Search commands and videos"
            className="h-14 w-full bg-transparent text-[15px] placeholder:text-fg-subtle focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-fg-muted">
              {results.isFetching ? "Searching…" : "No matches. Try a different word."}
            </p>
          )}
          {commands.map((command, index) => (
            <button
              key={command.id}
              type="button"
              role="option"
              aria-selected={index === active}
              data-index={index}
              onMouseMove={() => setActive(index)}
              onClick={command.run}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                index === active ? "bg-surface-3 text-fg" : "text-fg-muted",
              )}
            >
              {command.thumb ? (
                <img src={command.thumb} alt="" className="h-8 w-14 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-muted">{command.icon}</span>
              )}
              <span className="min-w-0 flex-1 truncate">{command.label}</span>
              {command.hint && <span className="shrink-0 font-mono text-xs text-fg-subtle">{command.hint}</span>}
              {index === active && <ArrowRight className="size-4 shrink-0 text-fg-subtle" />}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
