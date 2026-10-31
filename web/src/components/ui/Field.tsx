import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-line-strong bg-surface-1 px-3.5 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:border-[color-mix(in_oklab,var(--fg)_24%,transparent)] focus:border-ai focus:outline-none focus:ring-4 focus:ring-ai/15 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-24 resize-none py-3 leading-relaxed", className)} {...rest} />;
  },
);

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-describedby": string | undefined; "aria-invalid": boolean }) => ReactNode;
}

/** A labelled form control with optional hint and error text. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg-muted">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {(error || hint) && (
        <p id={describedBy} className={cn("text-xs", error ? "text-danger" : "text-fg-subtle")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
