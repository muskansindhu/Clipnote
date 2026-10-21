import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, NotebookText, Sparkles, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Segmented, Skeleton } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { Answer } from "@/features/clipchat/Answer";
import { Player, type PlayerHandle } from "@/features/video/Player";
import { ApiError, api, streamClipchat } from "@/lib/api";
import { cn } from "@/lib/cn";
import { SUGGESTED_QUESTIONS } from "@/lib/constants";
import { keys, useClipchatContext } from "@/lib/queries";
import { formatClock } from "@/lib/time";
import type { ClipchatContext } from "@/lib/types";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  state: "streaming" | "done" | "error";
}

let nextMessageId = 1;

export function ClipchatPage() {
  const { videoId = "" } = useParams();
  const toast = useToast();
  const client = useQueryClient();
  const context = useClipchatContext(videoId);
  const playerRef = useRef<PlayerHandle>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [tab, setTab] = useState<"video" | "chat">("chat");

  const data = context.data;
  const ready = data?.asset_status.transcript === "ready" && data.asset_status.summary !== "pending";

  // Fetch the transcript and summary the first time a video is opened in Clipchat.
  useEffect(() => {
    if (!data || ready || preparing || prepareFailed) return;
    setPreparing(true);
    api<ClipchatContext>(`/clipchat/${videoId}/prepare`, { method: "POST" })
      .then((prepared) => client.setQueryData(keys.clipchat(videoId), prepared))
      .catch(() => setPrepareFailed(true))
      .finally(() => setPreparing(false));
  }, [data, ready, preparing, prepareFailed, videoId, client]);

  useEffect(() => {
    setMessages([]);
    setPrepareFailed(false);
    return () => abortRef.current?.abort();
  }, [videoId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const seek = useCallback((seconds: number) => {
    setTab("video");
    window.setTimeout(() => playerRef.current?.seek(seconds), 150);
  }, []);

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || busy || !ready) return;
    const reply: Message = { id: nextMessageId++, role: "assistant", text: "", state: "streaming" };
    setMessages((current) => [...current, { id: nextMessageId++, role: "user", text: question, state: "done" }, reply]);
    setDraft("");
    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const answer = await streamClipchat(
        videoId,
        question,
        (delta) =>
          setMessages((current) => current.map((m) => (m.id === reply.id ? { ...m, text: m.text + delta } : m))),
        abortRef.current.signal,
      );
      setMessages((current) => current.map((m) => (m.id === reply.id ? { ...m, text: answer, state: "done" } : m)));
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      const message = error instanceof ApiError ? error.message : "Clipchat hit a temporary problem. Try again.";
      setMessages((current) => current.map((m) => (m.id === reply.id ? { ...m, text: message, state: "error" } : m)));
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const notes = useMemo(() => data?.notes.filter((note) => note.note) ?? [], [data]);

  if (context.isError) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold">We couldn't open Clipchat for that video</h1>
        <p className="mt-2 text-fg-muted">{context.error instanceof ApiError ? context.error.message : "Please try again."}</p>
        <Link to="/clipchat" className={buttonStyles("secondary", "md", "mt-6")}>
          Back to Clipchat
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="lg:hidden">
        <Segmented
          label="Panel"
          value={tab}
          onChange={setTab}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          options={[
            { value: "chat", label: "Chat" },
            { value: "video", label: "Video & notes" },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Video column */}
        <section className={cn("space-y-5 lg:sticky lg:top-24 lg:block lg:self-start", tab !== "video" && "hidden")}>
          <Player ref={playerRef} videoId={videoId} />
          {data ? (
            <div>
              <h1 className="text-xl font-semibold leading-snug tracking-tight">{data.video_title}</h1>
              <Link to={`/${videoId}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-violet hover:underline">
                <NotebookText className="size-3.5" /> Open notes ({data.notes.length})
              </Link>
            </div>
          ) : (
            <Skeleton className="h-8 w-2/3" />
          )}

          {data?.video_summary && (
            <div className="rounded-2xl border border-line bg-surface-1 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-violet" /> Summary
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-fg-muted">{data.video_summary}</p>
            </div>
          )}

          {notes.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface-1 p-4">
              <p className="mb-3 text-sm font-semibold">Your notes</p>
              <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {notes.map((note) => (
                  <li key={note.id} className="flex gap-3 text-sm">
                    {note.timestamp_seconds !== null ? (
                      <button
                        type="button"
                        onClick={() => seek(note.timestamp_seconds ?? 0)}
                        className="h-fit rounded-md bg-violet/14 px-1.5 py-0.5 font-mono text-xs font-semibold text-violet hover:bg-violet/28"
                      >
                        {formatClock(note.timestamp_seconds)}
                      </button>
                    ) : (
                      <span className="h-fit rounded-md bg-surface-3 px-1.5 py-0.5 text-xs text-fg-muted">Video</span>
                    )}
                    <span className="text-fg-muted">{note.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Chat column */}
        <section
          aria-label="Chat"
          className={cn(
            "flex min-h-[70dvh] flex-col overflow-hidden rounded-3xl border border-line-strong bg-surface-1 shadow-card lg:h-[calc(100dvh-8.5rem)]",
            tab !== "chat" && "hidden lg:flex",
          )}
        >
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <span className="grid size-9 place-items-center rounded-xl bg-violet/14 text-violet">
              <Sparkles className="size-[18px]" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold leading-tight">Clipchat</h2>
              <p className="text-xs text-fg-subtle">Answers come only from this video's transcript</p>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5" aria-live="polite">
            {!data || (!ready && !prepareFailed) ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-violet/30 border-t-violet" />
                  <p className="font-medium">Reading the transcript…</p>
                  <p className="mt-1 text-sm text-fg-muted">This takes a few seconds the first time.</p>
                </div>
              </div>
            ) : prepareFailed ? (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-xs">
                  <p className="font-medium">No transcript for this video</p>
                  <p className="mt-1 text-sm text-fg-muted">
                    Clipchat needs captions to work. Try a video that has them, or take notes manually.
                  </p>
                  <Link to={`/${videoId}`} className={buttonStyles("secondary", "md", "mt-5")}>
                    Take notes instead
                  </Link>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="grid h-full place-items-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-violet/14 text-violet">
                    <Sparkles className="size-6" />
                  </div>
                  <p className="text-lg font-semibold tracking-tight">Ask anything about this video</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-fg-muted">
                    Every answer cites exact moments. Tap a timestamp to jump there.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void ask(question)}
                        className="rounded-full border border-line-strong bg-surface-2 px-3.5 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:border-violet/40 hover:text-fg"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                        message.role === "user" ? "bg-surface-3 text-fg-muted" : "bg-violet/14 text-violet",
                      )}
                    >
                      {message.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                    </span>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "rounded-tr-md bg-brand-gradient text-white"
                          : message.state === "error"
                            ? "rounded-tl-md border border-danger/30 bg-danger/8"
                            : "rounded-tl-md border border-line bg-surface-2",
                      )}
                    >
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.text}</p>
                      ) : message.text ? (
                        <Answer text={message.text} onSeek={seek} />
                      ) : (
                        <span className="flex h-6 items-center gap-1" aria-label="Clipchat is thinking">
                          {[0, 1, 2].map((dot) => (
                            <span
                              key={dot}
                              className="size-1.5 animate-bounce rounded-full bg-fg-subtle"
                              style={{ animationDelay: `${dot * 120}ms` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
            className="border-t border-line p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface-2 p-2 focus-within:border-violet/50 focus-within:ring-4 focus-within:ring-violet/10">
              <textarea
                value={draft}
                rows={1}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask(draft);
                  }
                }}
                disabled={!ready}
                placeholder={ready ? "Ask about key ideas, moments, or exact timestamps…" : "Preparing the transcript…"}
                aria-label="Your question"
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] placeholder:text-fg-subtle focus:outline-none disabled:opacity-60"
              />
              <Button type="submit" variant="violet" size="icon" disabled={!ready || !draft.trim()} loading={busy} aria-label="Send question">
                {!busy && <ArrowUp className="size-[18px]" />}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
