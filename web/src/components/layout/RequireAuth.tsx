import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useSession } from "@/lib/session";

/** Redirects signed-out visitors to the login page, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}
