import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/** The Clipnote mark: a ruled note line ending in a coral timestamp tick. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" className="fill-fg" />
      <path d="M8 12h16M8 20h9" className="stroke-bg" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="23" cy="20" r="2.4" className="fill-brand" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark && <span className="font-serif text-[21px] font-semibold tracking-tight text-fg">Clipnote</span>}
    </span>
  );
}
