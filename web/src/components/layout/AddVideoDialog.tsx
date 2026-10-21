import { ArrowRight, Link2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { extractVideoId } from "@/lib/youtube";

interface AddVideoDialogProps {
  open: boolean;
  onClose: () => void;
  /** Where to send the user: the notes page or Clipchat. */
  destination?: "notes" | "clipchat";
}

/** Paste a YouTube link to open it for note taking. */
export function AddVideoDialog({ open, onClose, destination = "notes" }: AddVideoDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = extractVideoId(value);
    if (!id) {
      setError("That doesn't look like a YouTube video link.");
      return;
    }
    setValue("");
    setError(null);
    onClose();
    navigate(destination === "clipchat" ? `/clipchat/${id}` : `/${id}`);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a video"
      description="Paste a YouTube link to start taking notes. Nothing is saved until you add a note."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="YouTube link" error={error}>
          {(props) => (
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <Input
                {...props}
                autoFocus
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                placeholder="https://www.youtube.com/watch?v=…"
                className="pl-10"
                inputMode="url"
              />
            </div>
          )}
        </Field>
        <Button type="submit" variant="primary" className="w-full" size="lg">
          Open video <ArrowRight className="size-4" />
        </Button>
      </form>
    </Dialog>
  );
}
