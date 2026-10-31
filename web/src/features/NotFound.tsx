import { Link } from "react-router-dom";
import { buttonStyles } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-6">
      <div>
        <p className="font-mono text-sm text-brand">404</p>
        <h1 className="mt-2 font-serif text-5xl font-medium leading-none tracking-tight">Page not found</h1>
        <p className="mt-4 text-fg-muted">The link may be broken, or the page may have moved.</p>
        <Link to="/" className={buttonStyles("primary", "md", "mt-8")}>
          Back to Clipnote
        </Link>
      </div>
    </div>
  );
}
