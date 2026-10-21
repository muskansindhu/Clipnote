import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/session";
import type { ThemePreference } from "@/lib/theme";

const ORDER: ThemePreference[] = ["dark", "light", "system"];
const ICONS = { dark: Moon, light: Sun, system: Monitor } as const;

/** Cycles dark → light → system. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useSession();
  const Icon = ICONS[theme];
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-[18px]" />
    </Button>
  );
}
