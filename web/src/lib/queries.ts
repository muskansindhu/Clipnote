import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LIBRARY_PAGE_SIZE, PENDING_POLL_MS } from "@/lib/constants";
import type {
  ApiTokenRecord,
  ClipchatContext,
  Label,
  LibraryFilters,
  LibraryPage,
  LibraryStats,
  Note,
  NoteType,
  VideoDetail,
} from "@/lib/types";

export const keys = {
  stats: ["stats"] as const,
  library: (filters: LibraryFilters) => ["library", filters] as const,
  video: (id: string) => ["video", id] as const,
  labels: ["labels"] as const,
  tokens: ["tokens"] as const,
  clipchat: (id: string) => ["clipchat", id] as const,
};

export const useStats = () =>
  useQuery({ queryKey: keys.stats, queryFn: () => api<LibraryStats>("/api/stats") });

export function useLibrary(filters: LibraryFilters) {
  return useInfiniteQuery({
    queryKey: keys.library(filters),
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), sort: filters.sort });
      if (filters.search) params.set("search", filters.search);
      if (filters.labels.length) params.set("labels", filters.labels.join(","));
      if (filters.start) params.set("start", filters.start);
      if (filters.end) params.set("end", filters.end);
      return api<LibraryPage>(`/all-video?${params}`);
    },
    getNextPageParam: (last, pages) => (last.has_next ? pages.length + 1 : undefined),
  });
}

export const LIBRARY_PAGE_LIMIT = LIBRARY_PAGE_SIZE;

/** A video and the user's notes; polls while any note is still being written. */
export function useVideo(videoId: string) {
  return useQuery({
    queryKey: keys.video(videoId),
    queryFn: () => api<VideoDetail>(`/api/videos/${videoId}`),
    refetchInterval: (query) =>
      query.state.data?.notes.some((note) => note.status === "pending") ? PENDING_POLL_MS : false,
  });
}

export const useLabels = () => useQuery({ queryKey: keys.labels, queryFn: () => api<Label[]>("/labels") });
export const useTokens = () =>
  useQuery({ queryKey: keys.tokens, queryFn: () => api<ApiTokenRecord[]>("/api/tokens") });

export const useClipchatContext = (videoId: string) =>
  useQuery({
    queryKey: keys.clipchat(videoId),
    queryFn: () => api<ClipchatContext>(`/clipchat/${videoId}/context`),
  });

/** Mutations that change one video; each refreshes the affected caches. */
export function useVideoActions(videoId: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.video(videoId) });
    void client.invalidateQueries({ queryKey: ["library"] });
    void client.invalidateQueries({ queryKey: keys.stats });
  };

  const createNote = useMutation({
    mutationFn: (input: { text: string; seconds: number | null; type: NoteType; title?: string }) =>
      api<{ note: Note; duplicate: boolean }>("/api/notes", {
        method: "POST",
        body: { video_id: videoId, seconds: input.seconds, text: input.text, type: input.type, title: input.title },
      }),
    onSuccess: refresh,
  });
  const updateNote = useMutation({
    mutationFn: (input: { noteId: number; text: string }) =>
      api(`/${videoId}`, { method: "PATCH", body: { note_id: input.noteId, notes: input.text } }),
    onSuccess: refresh,
  });
  const deleteNote = useMutation({
    mutationFn: (noteId: number) => api(`/${videoId}`, { method: "DELETE", body: { note_id: noteId } }),
    onSuccess: refresh,
  });
  const setFavourite = useMutation({
    mutationFn: (fav: boolean) =>
      api(fav ? "/fav-note" : "/unfav-note", { method: "POST", body: { video_id: videoId } }),
    onSuccess: refresh,
  });
  const setLabel = useMutation({
    mutationFn: async (label: string | null) => {
      await api("/video-label", { method: "DELETE", body: { video_id: videoId } });
      if (label) await api("/video-label", { method: "POST", body: { label_name: label, video_id: videoId } });
    },
    onSuccess: refresh,
  });
  const removeVideo = useMutation({
    mutationFn: () => api(`/api/videos/${videoId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  return { createNote, updateNote, deleteNote, setFavourite, setLabel, removeVideo };
}

/** Toggle a favourite from the library grid, where the video id varies per card. */
export function useToggleFavourite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { videoId: string; fav: boolean }) =>
      api(input.fav ? "/fav-note" : "/unfav-note", { method: "POST", body: { video_id: input.videoId } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["library"] });
      void client.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export function useLabelActions() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.labels });
    void client.invalidateQueries({ queryKey: ["video"] });
  };
  return {
    add: useMutation({
      mutationFn: (name: string) => api("/label", { method: "POST", body: { label_name: name } }),
      onSuccess: refresh,
    }),
    rename: useMutation({
      mutationFn: (input: { id: number; name: string }) =>
        api("/label", { method: "PATCH", body: { label_id: input.id, new_name: input.name } }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api("/label", { method: "DELETE", body: { label_id: id } }),
      onSuccess: refresh,
    }),
  };
}

export function useTokenActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: keys.tokens });
  return {
    create: useMutation({
      mutationFn: (label: string) =>
        api<{ token: string; record: ApiTokenRecord }>("/api/tokens", { method: "POST", body: { label } }),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (id: number) => api(`/api/tokens/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}

/** Remove a video from the library (the id is supplied per call, for grids and lists). */
export function useRemoveVideo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => api(`/api/videos/${videoId}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["library"] });
      void client.invalidateQueries({ queryKey: keys.stats });
    },
  });
}
