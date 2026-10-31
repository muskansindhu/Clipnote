import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Misc";
import { SHORTCUTS, shortcutKeys, type ShortcutId } from "@/lib/shortcuts";

const IDS = Object.keys(SHORTCUTS) as ShortcutId[];

/** A reference list of every shortcut, grouped by where it works. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" description="Every shortcut uses ⌘ (Ctrl on Windows and Linux).">
      <div className="space-y-5">
        {(["Anywhere", "Video page"] as const).map((scope) => (
          <section key={scope}>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-fg-subtle">{scope}</h3>
            <ul className="divide-y divide-line">
              {IDS.filter((id) => SHORTCUTS[id].scope === scope).map((id) => (
                <li key={id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span>{SHORTCUTS[id].label}</span>
                  <span className="flex shrink-0 gap-1">
                    {shortcutKeys(id).map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="border-t border-line pt-4 text-sm text-fg-muted">
          Watching full screen on YouTube? The Chrome extension has its own shortcut that saves the moment and lets AI
          write the note. Set it at <span className="font-mono text-xs">chrome://extensions/shortcuts</span>.
        </p>
      </div>
    </Dialog>
  );
}
