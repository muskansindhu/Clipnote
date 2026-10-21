/** Minimal typings for the parts of the YouTube IFrame Player API we use. */
declare namespace YT {
  interface PlayerOptions {
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: Player }) => void;
      onError?: (event: { data: number }) => void;
      onStateChange?: (event: { data: number; target: Player }) => void;
    };
  }
  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    getCurrentTime(): number;
    getDuration(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    getPlayerState(): number;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
