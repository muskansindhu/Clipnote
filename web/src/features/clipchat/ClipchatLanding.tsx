import { ArrowRight, Link2, MessagesSquare, Quote, Sparkles, Timer } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useLibrary } from "@/lib/queries";
import { extractVideoId, thumbnailUrl } from "@/lib/youtube";

const NO_FILTERS = { search: "", sort: "recent", labels: [], start: "", end: "" } as const;

export function ClipchatLanding() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recent = useLibrary({ ...NO_FILTERS, labels: [] });
  const videos = recent.data?.pages[0]?.videos.slice(0, 6) ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = extractVideoId(value);
    if (!id) return setError("Paste a YouTube video link to get started.");
    navigate(`/clipchat/${id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-12 py-6 sm:py-12">
      <header className="text-center">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-violet/14 text-violet shadow-[0_12px_40px_-12px_var(--glow-violet)]">
          <MessagesSquare className="size-7" />
        </div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Chat with <span className="text-gradient">any video</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[17px] leading-relaxed text-fg-muted">
          Ask questions in plain English. Clipchat reads the transcript and answers with timestamps you can click.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex flex-col gap-2 rounded-2xl border border-line-strong bg-surface-1 p-2 shadow-card focus-within:border-violet/50 focus-within:ring-4 focus-within:ring-violet/10 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder="Paste a YouTube link…"
              aria-label="YouTube link"
              aria-invalid={Boolean(error)}
              className="h-12 border-0 bg-transparent pl-10 shadow-none focus:ring-0"
              inputMode="url"
            />
          </div>
          <Button type="submit" variant="violet" size="lg">
            Start chatting <ArrowRight className="size-4" />
          </Button>
        </div>
        {error && (
          <p role="alert" className="px-2 text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Quote, title: "Grounded answers", body: "Only what's in the transcript. No guessing." },
          { icon: Timer, title: "Click to jump", body: "Every citation seeks the player to that moment." },
          { icon: Sparkles, title: "Works on long videos", body: "Hours-long talks are searched, not truncated." },
        ].map((feature) => (
          <li key={feature.title} className="rounded-2xl border border-line bg-surface-1 p-5">
            <feature.icon className="size-5 text-violet" />
            <h2 className="mt-3 text-[15px] font-semibold">{feature.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{feature.body}</p>
          </li>
        ))}
      </ul>

      {videos.length > 0 && (
        <section aria-label="From your library">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-fg-subtle">From your library</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((video) => (
              <Link
                key={video.id}
                to={`/clipchat/${video.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-surface-1 p-2.5 transition-colors hover:border-violet/40"
              >
                <img src={thumbnailUrl(video.id, "mq")} alt="" loading="lazy" className="aspect-video w-28 shrink-0 rounded-xl object-cover" />
                <span className="line-clamp-2 flex-1 text-sm font-medium">{video.video_title}</span>
                <ArrowRight className="mr-2 size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-violet" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
