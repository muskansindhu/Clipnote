import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Join class names, resolving Tailwind conflicts (later classes win). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
