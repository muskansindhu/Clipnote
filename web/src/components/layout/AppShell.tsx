import { motion } from "framer-motion";
import { Command, Library, LogOut, MessagesSquare, Plus, Search, Settings } from "lucide-react";
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
  { to: "/dashboard", label: "Library", icon: Library },
  { to: "/clipchat", label: "Clipchat", icon: MessagesSquare },
  { to: "/profile", label: "Settings", icon: Settings },
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
    <div className="bg-aurora min-h-dvh lg:pl-64">
      <a
        href="#main"
        className="sr-only z-[70] rounded-lg bg-surface-3 px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg-elev/60 px-4 py-5 backdrop-blur-xl lg:flex">
        <NavLink to="/dashboard" className="mb-7 px-2" aria-label="Clipnote library">
          <Logo />
        </NavLink>
        <nav aria-label="Main" className="space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "text-fg" : "text-fg-muted hover:bg-surface-2/70 hover:text-fg",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl border border-line-strong bg-surface-2"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon className={cn("relative size-[18px]", isActive && "text-violet")} />
                  <span className="relative">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 rounded-2xl border border-line bg-surface-1/70 p-4">
          <p className="text-[13px] font-semibold">Capture on your iPhone</p>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Share from the YouTube app and the note lands here. No app switching.
          </p>
          <NavLink to="/profile#capture" className="mt-3 inline-block text-xs font-medium text-violet hover:underline">
            Set up Share to Clipnote →
          </NavLink>
        </div>

        <div className="mt-auto">
          <Popover
            side="top"
            align="start"
            className="w-56"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2"
                aria-label="Account menu"
              >
                <Avatar name={user?.username ?? ""} picture={user?.picture} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{user?.username}</span>
                  <span className="block truncate text-xs text-fg-subtle">{user?.email}</span>
                </span>
              </button>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem icon={<Settings />} onClick={() => { close(); navigate("/profile"); }}>Settings</MenuItem>
                <MenuItem icon={<LogOut />} danger onClick={logout}>Sign out</MenuItem>
              </>
            )}
          </Popover>
        </div>
      </aside>

      {/* Top bar */}
      <header className="glass sticky top-0 z-20 border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <NavLink to="/dashboard" className="lg:hidden" aria-label="Clipnote library">
            <Logo showWordmark={false} />
          </NavLink>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface-1/70 px-3.5 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted sm:max-w-md"
            aria-label="Open command palette"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left">Search or jump to…</span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>
                <Command className="size-3" />
              </Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="primary" size="md" className="hidden sm:inline-flex" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add video
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:pb-16">
        <Outlet />
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="glass safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line pt-1.5 lg:hidden"
      >
        <TabLink to="/dashboard" label="Library" icon={Library} />
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-fg-muted"
        >
          <span className="grid size-9 place-items-center rounded-full bg-brand-gradient text-white shadow-[0_6px_20px_-6px_var(--glow-brand)]">
            <Plus className="size-5" />
          </span>
          Add
        </button>
        <TabLink to="/clipchat" label="Clipchat" icon={MessagesSquare} />
        <TabLink to="/profile" label="Settings" icon={Settings} />
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onAddVideo={() => setAddOpen(true)} />
      <AddVideoDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function TabLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Library }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn("flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium", isActive ? "text-violet" : "text-fg-muted")
      }
    >
      <span className="grid h-9 place-items-center">
        <Icon className="size-5" />
      </span>
      {label}
    </NavLink>
  );
}
