import { ArrowRight } from "lucide-react";
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
    <div className="max-w-3xl space-y-14">
      <header className="border-b border-line pb-8">
        <h1 className="font-serif text-[44px] font-medium leading-none tracking-tight">Clipchat</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-fg-muted">
          Ask a video a question. Answers come from the transcript, with timestamps you can click.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            aria-invalid={Boolean(error)}
            className="h-12 flex-1"
            inputMode="url"
          />
          <Button type="submit" variant="primary" size="lg">
            Start chatting <ArrowRight className="size-4" />
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      {videos.length > 0 && (
        <section aria-label="From your library">
          <h2 className="mb-2 font-serif text-2xl font-medium">Or pick one you've already noted</h2>
          <ul className="divide-y divide-line border-y border-line">
            {videos.map((video) => (
              <li key={video.id}>
                <Link to={`/clipchat/${video.id}`} className="group flex items-center gap-4 py-3">
                  <img src={thumbnailUrl(video.id, "mq")} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded object-cover" />
                  <span className="line-clamp-2 flex-1 font-serif text-lg leading-snug group-hover:underline group-hover:underline-offset-4">{video.video_title}</span>
                  <ArrowRight className="size-4 shrink-0 text-fg-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
