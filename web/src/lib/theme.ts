import { THEME_STORAGE_KEY } from "@/lib/constants";

export type ThemePreference = "light" | "dark" | "system";

export function readTheme(): ThemePreference {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "system" ? saved : "light";
}

export function resolveDark(preference: ThemePreference): boolean {
  return preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}

export function applyTheme(preference: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
  document.documentElement.classList.toggle("dark", resolveDark(preference));
}
