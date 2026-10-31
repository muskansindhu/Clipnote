import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { GithubIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { buttonStyles } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { GITHUB_URL } from "@/lib/constants";
import { useSession } from "@/lib/session";

const SAMPLE = [
  { at: "1:35", kind: "Key point", text: "The Instant Gratification Monkey always wins when the deadline is far away." },
  { at: "6:52", kind: "Idea", text: "Panic Monster is the only thing the monkey fears. Build artificial deadlines." },
  { at: "12:11", kind: "Question", text: "What is the equivalent for goals with no deadline? Career, relationships." },
];

const PARTS = [
  {
    title: "Write it where you watch",
    body: "The Chrome extension stamps your note with the exact second of the video. On iPhone, share from the YouTube app and the note arrives in your library. You never leave the video.",
  },
  {
    title: "Let the transcript write it for you",
    body: "Mark a moment without typing. Clipnote reads the transcript around that second and drafts the note. Edit it, or replace it with your own words.",
  },
  {
    title: "Ask the video a question",
    body: "Clipchat answers from the transcript only, and every claim links to the second it came from. Click a timestamp and the player jumps there.",
  },
  {
    title: "Keep it yours",
    body: "Export any video's notes as Markdown. Bring your own AI key. The whole project is open source and you can host it yourself.",
  },
];

export function LandingPage() {
  const { user } = useSession();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link to="/" aria-label="Clipnote home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hidden px-2 text-sm text-fg-muted hover:text-fg sm:block">
              GitHub
            </a>
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard" className={buttonStyles("primary", "sm")}>
                Open app <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonStyles("ghost", "sm")}>
                  Sign in
                </Link>
                <Link to="/login?mode=signup" className={buttonStyles("primary", "sm")}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl gap-14 px-5 pb-24 pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h1 className="font-serif text-[52px] font-medium leading-[1.02] tracking-tight sm:text-[68px]">
              Notes that remember where they came from.
            </h1>
            <p className="mt-6 max-w-md text-[18px] leading-relaxed text-fg-muted">
              Clipnote saves what you write while watching YouTube, pinned to the second you wrote it. Search it later,
              or ask the video a question.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? "/dashboard" : "/login?mode=signup"} className={buttonStyles("primary", "lg")}>
                {user ? "Open your library" : "Start taking notes"}
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "lg")}>
                <GithubIcon className="size-4" /> View source
              </a>
            </div>
          </div>

          <figure aria-label="Example notes" className="rounded-lg border border-line-strong bg-surface-1 p-6">
            <figcaption className="border-b border-line pb-4 font-serif text-xl font-medium leading-snug">
              Inside the Mind of a Master Procrastinator
              <span className="mt-1 block font-sans text-xs font-normal text-fg-subtle">TED · 3 notes</span>
            </figcaption>
            <ul className="divide-y divide-line">
              {SAMPLE.map((note) => (
                <li key={note.at} className="grid grid-cols-[3.25rem_1fr] gap-x-3 py-4">
                  <span className="pt-0.5 font-mono text-[13px] font-medium text-brand">{note.at}</span>
                  <div>
                    <p className="text-xs font-medium text-fg-subtle">{note.kind}</p>
                    <p className="font-serif text-[18px] leading-snug">{note.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </figure>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <dl className="divide-y divide-line">
              {PARTS.map((part, index) => (
                <div key={part.title} className="grid gap-3 py-8 md:grid-cols-[4rem_1fr_1.4fr] md:gap-8">
                  <span className="font-mono text-xs text-brand">0{index + 1}</span>
                  <dt className="font-serif text-2xl font-medium leading-tight">{part.title}</dt>
                  <dd className="text-[16px] leading-relaxed text-fg-muted">{part.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-fg-subtle">
          <Logo />
          <p>Free and open source. Your notes stay yours.</p>
        </div>
      </footer>
    </div>
  );
}
