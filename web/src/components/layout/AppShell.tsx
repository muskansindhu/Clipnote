import { Command, LogOut, Plus, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AddVideoDialog } from "@/components/layout/AddVideoDialog";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Avatar, Kbd } from "@/components/ui/Misc";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";

const NAV = [
  { to: "/dashboard", label: "Library" },
  { to: "/clipchat", label: "Clipchat" },
  { to: "/profile", label: "Settings" },
] as const;

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable));
}

export function AppShell() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (!isTyping(event.target) && !event.metaKey && !event.ctrlKey && event.key === "a") {
        event.preventDefault();
        setAddOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const logout = () => {
    signOut();
    navigate("/");
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-surface-3 px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <NavLink to="/dashboard" aria-label="Clipnote library">
            <Logo />
          </NavLink>

          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:text-fg",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
              aria-label="Open command palette"
            >
              <Search className="size-3.5" />
              <span className="hidden w-32 text-left md:inline">Search</span>
              <span className="hidden items-center gap-1 md:flex">
                <Kbd>
                  <Command className="size-3" />
                </Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <ThemeToggle />
            <Button variant="primary" size="sm" className="h-9" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add video</span>
            </Button>
            <Popover
              align="end"
              className="w-56"
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} aria-label="Account menu" className="rounded-full">
                  <Avatar name={user?.username ?? ""} picture={user?.picture} />
                </button>
              )}
            >
              {({ close }) => (
                <>
                  <div className="border-b border-line px-3 py-2">
                    <p className="truncate text-sm font-medium">{user?.username}</p>
                    <p className="truncate text-xs text-fg-subtle">{user?.email}</p>
                  </div>
                  <MenuItem icon={<Settings />} onClick={() => { close(); navigate("/profile"); }}>Settings</MenuItem>
                  <MenuItem icon={<LogOut />} danger onClick={logout}>Sign out</MenuItem>
                </>
              )}
            </Popover>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <Outlet />
      </main>

      {/* Mobile nav */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-bg pt-2 sm:hidden">
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn("py-2 text-center text-sm", isActive ? "font-medium text-fg" : "text-fg-muted")}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onAddVideo={() => setAddOpen(true)} />
      <AddVideoDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
