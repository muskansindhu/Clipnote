import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-surface-3/70", className)} {...rest} />;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface-2 px-1.5 font-mono text-[11px] font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type BadgeTone = "neutral" | "brand" | "violet" | "success" | "danger" | "warning";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-fg-muted",
  brand: "bg-brand/12 text-brand",
  violet: "bg-violet/14 text-violet",
  success: "bg-success/14 text-success",
  danger: "bg-danger/14 text-danger",
  warning: "bg-warning/16 text-warning",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Avatar({ name, picture, className }: { name: string; picture?: string | null; className?: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "U";
  return picture ? (
    <img src={picture} alt="" referrerPolicy="no-referrer" className={cn("size-8 rounded-full object-cover", className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand to-violet text-[11px] font-bold text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      <div className="mb-5 grid size-14 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-violet shadow-card">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; ariaLabel?: string }>;
  className?: string;
  label: string;
}

/** A compact radio-style toggle (theme, view mode). */
export function Segmented<T extends string>({ value, onChange, options, className, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl border border-line bg-surface-1 p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.ariaLabel}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium transition-colors",
            option.value === value ? "bg-surface-3 text-fg shadow-sm" : "text-fg-subtle hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
