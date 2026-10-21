import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/** The Clipnote mark: a gradient-outlined note with timeline rows. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="clipnote-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a45" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" className="fill-surface-1" />
      <rect x="1.5" y="1.5" width="61" height="61" rx="14.5" fill="none" stroke="url(#clipnote-mark)" strokeWidth="3" />
      <path d="M20 22h24M20 32h24M20 42h14" stroke="url(#clipnote-mark)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark && <span className="text-[17px] font-semibold tracking-tight text-fg">Clipnote</span>}
    </span>
  );
}
