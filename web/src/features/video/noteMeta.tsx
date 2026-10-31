import { CircleHelp, ListChecks, Lightbulb, NotebookText, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { NoteType } from "@/lib/types";

export const NOTE_META: Record<NoteType, { label: string; icon: ReactNode; tone: string }> = {
  note: { label: "Note", icon: <NotebookText className="size-3.5" />, tone: "text-fg-muted" },
  idea: { label: "Idea", icon: <Lightbulb className="size-3.5" />, tone: "text-brand" },
  question: { label: "Question", icon: <CircleHelp className="size-3.5" />, tone: "text-ai" },
  key_point: { label: "Key point", icon: <Star className="size-3.5" />, tone: "text-warning" },
  todo: { label: "To do", icon: <ListChecks className="size-3.5" />, tone: "text-success" },
};
