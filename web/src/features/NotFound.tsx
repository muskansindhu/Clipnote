import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { buttonStyles } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-violet">
          <Compass className="size-7" />
        </div>
        <p className="font-mono text-sm text-violet">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page wandered off</h1>
        <p className="mx-auto mt-3 max-w-sm text-fg-muted">The link may be broken, or the page may have moved.</p>
        <Link to="/" className={buttonStyles("primary", "lg", "mt-8")}>
          Back to Clipnote
        </Link>
      </div>
    </div>
  );
}
