import type { NOTE_TYPES, SORT_OPTIONS } from "@/lib/constants";

export type NoteType = (typeof NOTE_TYPES)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];
export type NoteStatus = "pending" | "ready" | "failed";
export type NoteSource = "user" | "ai";

export interface Note {
  id: number;
  created_at: string;
  video_timestamp: string | null;
  timestamp_seconds: number | null;
  note: string | null;
  note_source: NoteSource;
  note_type: NoteType;
  status: NoteStatus;
}

export interface VideoSummary {
  id: string;
  url: string;
  title: string;
  summary: string | null;
}

export interface VideoDetail {
  video: VideoSummary;
  notes: Note[];
  fav: boolean;
  label: string | null;
}

export interface LibraryVideo {
  id: string;
  video_url: string;
  video_title: string;
  fav: boolean;
  note_count: number;
  last_note_at: string | null;
}

export interface LibraryPage {
  videos: LibraryVideo[];
  has_next: boolean;
}

export interface LibraryStats {
  videos: number;
  notes: number;
  notes_this_week: number;
  favourites: number;
  pending: number;
}

export interface Label {
  id: number;
  label_name: string;
}

export interface ApiTokenRecord {
  id: number;
  label: string;
  prefix: string;
  scope: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ClipchatContext {
  video_id: string;
  video_url: string;
  video_title: string;
  fav: boolean;
  video_summary: string | null;
  notes: Array<{
    id: number;
    video_timestamp: string | null;
    timestamp_seconds: number | null;
    note: string | null;
    note_source: NoteSource;
  }>;
  asset_status: { transcript?: string; summary?: string };
}

export interface LibraryFilters {
  search: string;
  sort: SortOption;
  labels: string[];
  start: string;
  end: string;
}
