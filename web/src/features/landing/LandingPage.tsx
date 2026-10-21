import { motion, type Variants } from "framer-motion";
import { ArrowRight, Bot, Download, Globe, Lock, MessagesSquare, MousePointerClick, Smartphone, Sparkles, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GithubIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { buttonStyles } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { HeroMock } from "@/features/landing/HeroMock";
import { PhoneMock } from "@/features/landing/PhoneMock";
import { cn } from "@/lib/cn";
import { GITHUB_URL } from "@/lib/constants";
import { useSession } from "@/lib/session";

const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (delay: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] } }),
};

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div variants={reveal} custom={delay} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className={className}>
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  const { user } = useSession();

  return (
    <div className="bg-aurora min-h-dvh overflow-x-clip">
      {/* Nav */}
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" aria-label="Clipnote home">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-8 text-sm text-fg-muted md:flex">
            <a href="#features" className="transition-colors hover:text-fg">Features</a>
            <a href="#iphone" className="transition-colors hover:text-fg">iPhone</a>
            <a href="#how" className="transition-colors hover:text-fg">How it works</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-fg">Open source</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard" className={buttonStyles("primary", "md")}>
                Open app <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonStyles("ghost", "md", "hidden sm:inline-flex")}>
                  Sign in
                </Link>
                <Link to="/login?mode=signup" className={buttonStyles("primary", "md")}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative px-5 pb-24 pt-16 sm:pt-24">
          <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[40rem]" aria-hidden="true" />
          <div className="relative mx-auto max-w-4xl text-center">
            <motion.a
              href="#iphone"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-1/80 py-1.5 pl-2 pr-4 text-[13px] font-medium text-fg-muted backdrop-blur transition-colors hover:text-fg"
            >
              <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
              Share to Clipnote from the YouTube app
              <ArrowRight className="size-3.5" />
            </motion.a>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.6 }}
              className="text-balance text-[44px] font-semibold leading-[1.02] tracking-tight sm:text-7xl"
            >
              Your second brain for <span className="text-gradient">everything you watch.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-fg-muted sm:text-xl"
            >
              Capture timestamped notes from any YouTube video in Chrome, on your iPhone, or right here. AI writes the notes you don't have time to type.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-3"
            >
              <Link to={user ? "/dashboard" : "/login?mode=signup"} className={buttonStyles("primary", "lg")}>
                {user ? "Open your library" : "Start for free"} <ArrowRight className="size-4" />
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "lg")}>
                <GithubIcon className="size-4" /> Star on GitHub
              </a>
            </motion.div>
            <p className="mt-5 text-[13px] text-fg-subtle">Free and open source · Bring your own AI key · Self-host in minutes</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative mt-16 sm:mt-20"
          >
            <HeroMock />
          </motion.div>
        </section>

        {/* Capture strip */}
        <section aria-label="Works with" className="border-y border-line bg-surface-1/40 px-5 py-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-fg-subtle">
            <span className="font-medium uppercase tracking-wider text-fg-muted">Capture from</span>
            <span className="inline-flex items-center gap-2"><Globe className="size-4" /> Chrome</span>
            <span className="inline-flex items-center gap-2"><Smartphone className="size-4" /> iPhone share sheet</span>
            <span className="inline-flex items-center gap-2"><MousePointerClick className="size-4" /> Any browser</span>
            <span className="hidden h-4 w-px bg-line-strong sm:block" />
            <span className="font-medium uppercase tracking-wider text-fg-muted">Export to</span>
            <span>Obsidian</span>
            <span>Notion</span>
            <span>Markdown</span>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Features</p>
            <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Built for the way you actually learn
            </h2>
            <p className="mt-4 text-lg text-fg-muted">Notes you capture in seconds and still use a year later.</p>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-6">
            <Tile className="md:col-span-4" icon={<Timer />} title="Click a timestamp, jump to the moment" body="Every note is pinned to the second. Open the video, tap the time, and you're back where the idea happened.">
              <div className="mt-6 space-y-2">
                {[
                  ["12:34", "The pricing model only works at scale"],
                  ["18:02", "Ask them about retention cohorts"],
                  ["41:15", "Counter-example: Notion's growth loop"],
                ].map(([time, text]) => (
                  <div key={time} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm">
                    <span className="rounded-md bg-violet/14 px-2 py-0.5 font-mono text-xs font-semibold text-violet">{time}</span>
                    <span className="text-fg-muted">{text}</span>
                  </div>
                ))}
              </div>
            </Tile>

            <Tile className="md:col-span-2" icon={<Sparkles />} title="AI writes it for you" body="Leave a note empty. Clipnote reads the transcript around that moment and writes it.">
              <div className="mt-6 rounded-xl border border-violet/30 bg-violet/8 p-3 text-sm">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet"><Bot className="size-3.5" /> AI note · 1:10</span>
                Each successful review doubles the interval before the next one.
              </div>
            </Tile>

            <Tile className="md:col-span-2" icon={<MessagesSquare />} title="Chat with the video" body="Ask questions and get answers that cite exact moments.">
              <div className="mt-6 space-y-2 text-sm">
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-brand-gradient px-3.5 py-2 text-white">What's the main idea?</div>
                <div className="w-fit max-w-[90%] rounded-2xl rounded-tl-md border border-line bg-surface-2 px-3.5 py-2 text-fg-muted">
                  <strong className="text-fg">Review right before you forget</strong>{" "}
                  <span className="rounded bg-violet/14 px-1 font-mono text-xs text-violet">1:02</span>
                </div>
              </div>
            </Tile>

            <Tile className="md:col-span-2" icon={<Download />} title="Export anywhere" body="One click to Markdown, with a seek link on every note.">
              <pre className="mt-6 overflow-hidden rounded-xl border border-line bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-fg-muted">
{`# How Spaced Repetition Works

- [1:02](https://youtu.be/…?t=62)
  ⭐ Review right before you forget`}
              </pre>
            </Tile>

            <Tile className="md:col-span-2" icon={<Lock />} title="Private by default" body="Self-host it. Your notes, your database, your AI key. Nothing is public unless you make it so.">
              <div className="mt-6 flex flex-wrap gap-2 text-xs">
                {["Open source", "Self-hostable", "Hashed tokens", "Revocable access"].map((tag) => (
                  <span key={tag} className="rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-fg-muted">{tag}</span>
                ))}
              </div>
            </Tile>
          </div>
        </section>

        {/* iPhone */}
        <section id="iphone" className="scroll-mt-20 border-y border-line bg-surface-1/40 px-5 py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-2">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand">iPhone</p>
              <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Take notes without leaving the YouTube app
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-fg-muted">
                Keep your YouTube Premium, background play and Picture in Picture. Share the moment to Clipnote and carry on watching.
              </p>
              <ol className="mt-8 space-y-5">
                {[
                  ["Pause and share", "Turn on “Start at” so the link carries the exact second."],
                  ["Pick Clipnote", "Quick mark, type, or dictate. Two taps."],
                  ["It's saved", "The note lands in your library, and AI fills in the rest."],
                ].map(([title, body], index) => (
                  <li key={title} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 font-mono text-sm font-semibold text-violet">{index + 1}</span>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-0.5 text-fg-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/login?mode=signup" className={buttonStyles("primary", "lg", "mt-9")}>
                Set it up in 3 minutes <ArrowRight className="size-4" />
              </Link>
            </Reveal>
            <Reveal delay={0.15}>
              <PhoneMock />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">How it works</p>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">From watching to knowing</h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Capture", "Mark a moment in Chrome, on your phone, or in the app. It takes two seconds."],
              ["Understand", "AI writes the notes you skipped and summarises the video. Ask it anything."],
              ["Reuse", "Search everything, filter by label, and export to the tools you already use."],
            ].map(([title, body], index) => (
              <Reveal key={title} delay={index * 0.08}>
                <div className="h-full rounded-3xl border border-line bg-surface-1 p-7 shadow-card">
                  <span className="font-mono text-sm text-violet">0{index + 1}</span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 leading-relaxed text-fg-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-28">
          <Reveal>
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-line-strong bg-surface-1 px-6 py-16 text-center shadow-pop sm:px-16 sm:py-20">
              <div className="absolute -left-20 -top-20 size-80 rounded-full bg-violet/25 blur-[100px]" aria-hidden="true" />
              <div className="absolute -bottom-24 -right-16 size-80 rounded-full bg-brand/25 blur-[100px]" aria-hidden="true" />
              <h2 className="relative text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Start remembering what you watch.
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-lg text-fg-muted">Free, open source, and yours to keep.</p>
              <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link to={user ? "/dashboard" : "/login?mode=signup"} className={buttonStyles("primary", "lg")}>
                  {user ? "Open your library" : "Create your account"} <ArrowRight className="size-4" />
                </Link>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "lg")}>
                  <GithubIcon className="size-4" /> View on GitHub
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-fg-subtle">
          <Logo />
          <p>© {new Date().getFullYear()} Clipnote. Built for better learning.</p>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-fg">
            <GithubIcon className="size-4" /> GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function Tile({ icon, title, body, children, className }: { icon: ReactNode; title: string; body: string; children?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn("rounded-3xl border border-line bg-surface-1 p-7 shadow-card transition-colors hover:border-line-strong", className)}>
      <span className="grid size-10 place-items-center rounded-xl bg-violet/12 text-violet [&_svg]:size-5">{icon}</span>
      <h3 className="mt-5 text-xl font-semibold leading-snug tracking-tight">{title}</h3>
      <p className="mt-2 leading-relaxed text-fg-muted">{body}</p>
      {children}
    </Reveal>
  );
}
