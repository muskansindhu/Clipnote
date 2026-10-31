import { ExternalLink, WifiOff } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { PLAYER_TICK_MS } from "@/lib/constants";
import { loadYouTubeApi, thumbnailUrl, watchUrl } from "@/lib/youtube";

export interface PlayerHandle {
  /** Current playback position in whole seconds, or `null` before the player is ready. */
  currentTime: () => number | null;
  seek: (seconds: number) => void;
}

interface PlayerProps {
  videoId: string;
  onTick?: (seconds: number) => void;
  onReadyChange?: (ready: boolean) => void;
}

// Error codes 101/150 mean the uploader disabled embedding.
const EMBED_BLOCKED = new Set([101, 150]);

export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player({ videoId, onTick, onReadyChange }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const readyRef = useRef(false);
  const tickRef = useRef(onTick);
  const readyChangeRef = useRef(onReadyChange);
  const [failure, setFailure] = useState<"offline" | "blocked" | null>(null);

  useEffect(() => {
    tickRef.current = onTick;
    readyChangeRef.current = onReadyChange;
  });

  useImperativeHandle(ref, () => ({
    currentTime: () => (readyRef.current && playerRef.current ? Math.floor(playerRef.current.getCurrentTime()) : null),
    seek: (seconds) => {
      const player = playerRef.current;
      if (!readyRef.current || !player) return;
      player.seekTo(seconds, true);
      player.playVideo();
    },
  }));

  // Clicking the embedded player moves keyboard focus into the cross-origin iframe, where the
  // page can no longer see key presses. Hand focus straight back so shortcuts keep working.
  useEffect(() => {
    const reclaimFocus = () =>
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLIFrameElement) active.blur();
      }, 0);
    window.addEventListener("blur", reclaimFocus);
    return () => window.removeEventListener("blur", reclaimFocus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    setFailure(null);
    readyRef.current = false;
    readyChangeRef.current?.(false);

    loadYouTubeApi()
      .then((api) => {
        if (cancelled || !mountRef.current) return;
        const target = document.createElement("div");
        mountRef.current.replaceChildren(target);
        playerRef.current = new api.Player(target, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
          events: {
            onReady: () => {
              readyRef.current = true;
              readyChangeRef.current?.(true);
              timer = window.setInterval(() => {
                const player = playerRef.current;
                if (player && readyRef.current) tickRef.current?.(Math.floor(player.getCurrentTime()));
              }, PLAYER_TICK_MS);
            },
            onError: (event) => EMBED_BLOCKED.has(event.data) && setFailure("blocked"),
          },
        });
      })
      .catch(() => !cancelled && setFailure("offline"));

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      readyRef.current = false;
      readyChangeRef.current?.(false);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  if (failure) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-surface-2">
        <img src={thumbnailUrl(videoId, "hq")} alt="" className="absolute inset-0 size-full object-cover opacity-30 blur-sm" />
        <div className="relative flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
          <WifiOff className="size-6 text-fg-muted" />
          <p className="max-w-xs text-sm text-fg-muted">
            {failure === "blocked"
              ? "The uploader doesn't allow this video to play outside YouTube. You can still take notes here."
              : "The player couldn't load. Check your connection. You can still take notes here."}
          </p>
          <a href={watchUrl(videoId)} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "sm")}>
            Watch on YouTube <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black [&_iframe]:size-full">
      <div ref={mountRef} className="size-full" />
    </div>
  );
});
