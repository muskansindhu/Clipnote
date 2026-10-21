import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "violet";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-gradient text-white shadow-[0_8px_24px_-8px_var(--glow-brand),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110",
  secondary:
    "border border-line-strong bg-surface-2 text-fg hover:bg-surface-3 hover:border-[color-mix(in_oklab,var(--fg)_22%,transparent)]",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
  violet:
    "bg-violet text-white shadow-[0_8px_24px_-8px_var(--glow-violet)] hover:brightness-110 dark:text-[#14102a]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "size-10",
  "icon-sm": "size-8",
};

/** Class names for anything that should look like a button (links included). */
export function buttonStyles(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles(variant, size, className)}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
