/** Every keyboard shortcut in the app. All of them are chords with ⌘ (Ctrl on Windows and Linux). */
export type ShortcutId =
  | "palette"
  | "help"
  | "library"
  | "clipchat"
  | "settings"
  | "addVideo"
  | "newNote"
  | "saveNote"
  | "markMoment";

interface Shortcut {
  /** `KeyboardEvent.code`, so Option or layout changes never alter the match. */
  code: string;
  shift: boolean;
  /** Glyph shown to the user. */
  key: string;
  label: string;
  scope: "Anywhere" | "Video page";
}

export const SHORTCUTS: Record<ShortcutId, Shortcut> = {
  palette: { code: "KeyK", shift: false, key: "K", label: "Open the command palette", scope: "Anywhere" },
  help: { code: "Slash", shift: false, key: "/", label: "Show keyboard shortcuts", scope: "Anywhere" },
  library: { code: "KeyL", shift: true, key: "L", label: "Go to Library", scope: "Anywhere" },
  clipchat: { code: "KeyH", shift: true, key: "H", label: "Go to Clipchat", scope: "Anywhere" },
  settings: { code: "KeyP", shift: true, key: "P", label: "Go to Settings", scope: "Anywhere" },
  addVideo: { code: "KeyU", shift: true, key: "U", label: "Add a video", scope: "Anywhere" },
  newNote: { code: "KeyE", shift: true, key: "E", label: "Write a new note", scope: "Video page" },
  saveNote: { code: "KeyS", shift: false, key: "S", label: "Save the note you are writing", scope: "Video page" },
  markMoment: { code: "Enter", shift: true, key: "↵", label: "Mark this moment and let AI write the note", scope: "Video page" },
};

export const isMac = (): boolean => /Mac|iPhone|iPad/.test(navigator.platform);

/** True when the event is exactly this ⌘ chord. */
export function matchesShortcut(event: KeyboardEvent, id: ShortcutId): boolean {
  const shortcut = SHORTCUTS[id];
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    event.shiftKey === shortcut.shift &&
    event.code === shortcut.code
  );
}

/** Keys to render, e.g. `["⌘", "⇧", "L"]`. */
export function shortcutKeys(id: ShortcutId): string[] {
  const shortcut = SHORTCUTS[id];
  const mac = isMac();
  return [mac ? "⌘" : "Ctrl", ...(shortcut.shift ? [mac ? "⇧" : "Shift"] : []), shortcut.key];
}

export const formatShortcut = (id: ShortcutId): string => {
  const keys = shortcutKeys(id);
  return isMac() ? keys.join("") : keys.join("+");
};
