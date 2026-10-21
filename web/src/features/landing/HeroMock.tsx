import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, Check, Lightbulb, Play, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";

const NOTES = [
  { time: "1:02", type: "key", text: "Review right before you forget. That's the whole trick.", ai: false },
  { time: "1:10", type: "ai", text: "Each successful review doubles the interval before the next one.", ai: true },
  { time: "3:32", type: "idea", text: "Build a tiny app that schedules this for me.", ai: false },
  { time: "5:48", type: "ai", text: "Reviewing too often early on wastes the effect.", ai: true },
] as const;

const ICONS = { key: Star, ai: Bot, idea: Lightbulb } as const;
const TONES = { key: "text-warning", ai: "text-violet", idea: "text-brand" } as const;

/** An animated, self-contained preview of the video page. No network, no images. */
export function HeroMock() {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? NOTES.length : 0);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setCount((value) => (value >= NOTES.length + 2 ? 0 : value + 1)), 1700);
    return () => window.clearInterval(timer);
  }, [reduce]);

  const shown = NOTES.slice(0, Math.min(count, NOTES.length));
  const progress = Math.min(count, NOTES.length) / NOTES.length;

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[4rem] bg-gradient-to-b from-violet/20 via-brand/10 to-transparent blur-3xl" aria-hidden="true" />

      <div className="overflow-hidden rounded-3xl border border-line-strong bg-bg-elev shadow-pop">
        <div className="flex items-center gap-2 border-b border-line bg-surface-1 px-4 py-3">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <div className="mx-auto flex h-7 w-full max-w-sm items-center justify-center rounded-lg bg-surface-2 text-xs text-fg-subtle">
            clipnote.app/spaced-repetition
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1.15fr_1fr]">
          {/* Fake player */}
          <div>
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#1b1340] via-[#2a1a52] to-[#4a1d3a]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.18),transparent_50%)]" />
              <p className="absolute left-5 top-5 max-w-[70%] text-lg font-semibold leading-tight text-white/90 sm:text-2xl">
                How Spaced Repetition Really Works
              </p>
              <span className="absolute inset-0 m-auto grid size-14 place-items-center rounded-full bg-white/90 text-black shadow-xl">
                <Play className="ml-0.5 size-6 fill-current" />
              </span>
              <div className="absolute inset-x-4 bottom-4">
                <div className="relative h-1.5 rounded-full bg-white/25">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-violet" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.8 }} />
                  {shown.map((note, index) => (
                    <motion.span
                      key={note.time}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-white bg-violet"
                      style={{ left: `${((index + 1) / (NOTES.length + 1)) * 100}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {count > NOTES.length && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3.5 py-1.5 text-sm font-medium text-success"
                >
                  <Check className="size-4" /> Saved at 5:48 · 4 notes
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes */}
          <div className="min-h-64 space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-sm font-semibold">Notes</span>
              <span className="rounded-full bg-violet/14 px-2 py-0.5 font-mono text-xs text-violet">{shown.length}</span>
            </div>
            <AnimatePresence initial={false}>
              {shown.map((note) => {
                const Icon = ICONS[note.type];
                return (
                  <motion.div
                    key={note.time}
                    layout
                    initial={{ opacity: 0, x: 24, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="rounded-xl border border-line bg-surface-1 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-violet/14 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet">{note.time}</span>
                      <Icon className={`size-3.5 ${TONES[note.type]}`} />
                      {note.ai && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-violet">
                          <Sparkles className="size-3" /> AI
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{note.text}</p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
