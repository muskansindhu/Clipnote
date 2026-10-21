import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
}

/** A small anchored menu that closes on outside click or Escape. */
export function Popover({ trigger, children, align = "end", side = "bottom", className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: side === "bottom" ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute z-40 min-w-56 rounded-2xl border border-line-strong bg-bg-elev p-1.5 shadow-pop",
              side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
              align === "end" ? "right-0" : "left-0",
              className,
            )}
          >
            {children({ close: () => setOpen(false) })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2",
        danger ? "text-danger" : "text-fg",
      )}
    >
      {icon && <span className="text-fg-muted [&_svg]:size-4">{icon}</span>}
      {children}
    </button>
  );
}
