import { motion } from "framer-motion";
import { Check, Mic, NotebookText, Share, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";

/** A CSS-only iPhone showing the share sheet and the "Saved" confirmation. */
export function PhoneMock() {
  return (
    <div className="relative mx-auto w-[17rem] sm:w-72">
      <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-violet/30 to-brand/25 blur-3xl" aria-hidden="true" />
      <div className="rounded-[3rem] border-[10px] border-[#1c1c24] bg-black p-0 shadow-pop">
        <div className="relative aspect-[9/19] overflow-hidden rounded-[2.2rem] bg-gradient-to-b from-[#150f2e] to-[#0a0a10]">
          <div className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          <div className="px-4 pt-12">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-[#2a1a52] to-[#4a1d3a]" />
            <p className="mt-3 text-[13px] font-semibold text-white/90">How Spaced Repetition Really Works</p>
            <p className="text-[11px] text-white/45">Paused at 1:02</p>
          </div>

          <motion.div
            initial={{ y: "100%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ type: "spring", stiffness: 140, damping: 22, delay: 0.3 }}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-[#1d1d27] p-4 pb-6"
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />
            <div className="flex items-center justify-between rounded-xl bg-white/6 px-3 py-2 text-[11px] text-white/80">
              <span>Start at</span>
              <span className="font-mono text-violet">1:02 ◉</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] text-white/70">
              <div>
                <div className="mx-auto mb-1 grid size-11 place-items-center rounded-xl bg-white/8"><Share className="size-4" /></div>
                Copy
              </div>
              <div>
                <div className="mx-auto mb-1 grid size-11 place-items-center rounded-xl bg-white/8"><NotebookText className="size-4" /></div>
                Notes
              </div>
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
              >
                <div className="mx-auto mb-1 grid size-11 place-items-center rounded-xl bg-white/10 ring-2 ring-violet">
                  <LogoMark className="size-7" />
                </div>
                <span className="font-semibold text-white">Clipnote</span>
              </motion.div>
              <div>
                <div className="mx-auto mb-1 grid size-11 place-items-center rounded-xl bg-white/8"><Mic className="size-4" /></div>
                Dictate
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 1.4 }}
              className="mt-4 flex items-center gap-2 rounded-xl bg-success/15 px-3 py-2 text-[11px] font-medium text-success"
            >
              <Check className="size-3.5" /> Saved at 1:02
              <span className="ml-auto inline-flex items-center gap-1 text-violet"><Sparkles className="size-3" /> AI writing…</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
