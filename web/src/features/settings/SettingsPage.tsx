import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Pencil,
  Plus,
  Share2,
  Shield,
  Smartphone,
  Sun,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Avatar, Badge, Skeleton } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { ApiError, api, downloadFile } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { MIN_PASSWORD_LENGTH, SHORTCUT_DOCS_URL } from "@/lib/constants";
import { useLabelActions, useLabels, useTokenActions, useTokens } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { shortDate } from "@/lib/time";
import type { ThemePreference } from "@/lib/theme";
import type { Label } from "@/lib/types";

export function SettingsPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div className="max-w-3xl space-y-10">
      <header className="border-b border-line pb-6">
        <h1 className="font-serif text-[44px] font-medium leading-none tracking-tight">Settings</h1>
      </header>

      <ProfileCard />
      <AppearanceSection />
      <CaptureSection />
      <LabelsSection />
      <SecuritySection />
      <DataSection />
    </div>
  );
}

function Section({ id, title, description, children }: { id?: string; icon?: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 grid gap-6 border-b border-line pb-10 md:grid-cols-[14rem_1fr]">
      <div>
        <h2 className="font-serif text-2xl font-medium tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ProfileCard() {
  const { user } = useSession();
  return (
    <div className="flex items-center gap-4 border-b border-line pb-10">
      <Avatar name={user?.username ?? ""} picture={user?.picture} className="size-16 text-lg" />
      <div className="min-w-0">
        <p className="truncate font-serif text-2xl font-medium tracking-tight">{user?.username}</p>
        <p className="truncate text-sm text-fg-muted">{user?.email}</p>
        <Badge tone="ai" className="mt-2">Bring your own key</Badge>
      </div>
    </div>
  );
}

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

function AppearanceSection() {
  const { theme, setTheme } = useSession();
  return (
    <Section icon={<Palette />} title="Appearance" description="Choose how Clipnote looks on this device.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm font-medium transition-colors",
              theme === value ? "border-fg text-fg" : "border-line text-fg-muted hover:border-line-strong",
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function CopyField({ value, label, secret }: { value: string; label: string; secret?: boolean }) {
  const toast = useToast();
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else toast.error("Couldn't copy. Select the text and copy it manually.");
  };
  return (
    <div className="flex items-center gap-2">
      <Input readOnly aria-label={label} value={value} type={shown ? "text" : "password"} className="font-mono text-[13px]" onFocus={(event) => event.target.select()} />
      {secret && (
        <Button variant="secondary" size="icon" onClick={() => setShown((visible) => !visible)} aria-label={shown ? `Hide ${label}` : `Show ${label}`}>
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      )}
      <Button variant="secondary" size="icon" onClick={() => void copy()} aria-label={`Copy ${label}`}>
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

function CaptureSection() {
  const { token } = useSession();
  const tokens = useTokens();
  const { create, revoke } = useTokenActions();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(label, {
      onSuccess: (result) => {
        setSecret(result.token);
        setLabel("");
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't create the token."),
    });
  };

  return (
    <Section
      id="capture"
      icon={<Smartphone />}
      title="Capture on your iPhone"
      description="Share from the YouTube app straight into Clipnote. You keep the app and your Premium features."
    >
      <ol className="space-y-5">
        <Step n={1} title="Create a token">
          <p className="mb-3 text-sm text-fg-muted">It can only save notes, and you can revoke it any time.</p>
          <form onSubmit={submit} className="flex gap-2">
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Token name, e.g. My iPhone" maxLength={60} aria-label="Token name" />
            <Button type="submit" variant="primary" loading={create.isPending} className="h-11">
              <Plus className="size-4" /> Create
            </Button>
          </form>
          {secret && (
            <div className="mt-4 rounded-lg border border-line-strong bg-surface-2 p-4">
              <p className="mb-3 text-sm font-semibold">Copy it now. It won't be shown again.</p>
              <CopyField value={secret} label="new token" />
              <button type="button" onClick={() => setSecret(null)} className="mt-3 text-xs text-fg-subtle hover:text-fg">
                I've saved it
              </button>
            </div>
          )}
        </Step>

        <Step n={2} title="Build the Shortcut">
          <p className="mb-3 text-sm text-fg-muted">
            In the Shortcuts app, add <em>Get Contents of URL</em> and point it at this endpoint with your token in the{" "}
            <code className="rounded bg-surface-3 px-1 font-mono text-xs">Authorization</code> header.
          </p>
          <CopyField value={`${window.location.origin}/api/capture`} label="capture endpoint" />
          <a href={SHORTCUT_DOCS_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-ai hover:underline">
            Step-by-step guide →
          </a>
        </Step>

        <Step n={3} title="Share from YouTube">
          <p className="text-sm text-fg-muted">
            Pause, tap Share, turn on <strong className="text-fg">Start at</strong>, choose <em>Send to Clipnote</em>. A link without a time is saved as a note
            on the whole video.
          </p>
        </Step>
      </ol>

      <div className="mt-7 border-t border-line pt-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Share2 className="size-4 text-fg-subtle" /> Your tokens
        </h3>
        {tokens.isPending ? (
          <Skeleton className="h-14" />
        ) : tokens.data?.length === 0 ? (
          <p className="text-sm text-fg-subtle">No tokens yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tokens.data?.map((item) => (
              <li key={item.id} className={cn("flex items-center justify-between gap-3 py-3", item.revoked_at && "opacity-50")}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="truncate font-mono text-xs text-fg-subtle">
                    {item.prefix}… · {item.revoked_at ? `revoked ${shortDate(item.revoked_at)}` : `used ${item.last_used_at ? shortDate(item.last_used_at) : "never"}`}
                  </p>
                </div>
                {!item.revoked_at && (
                  <Button variant="danger" size="sm" loading={revoke.isPending && revoke.variables === item.id} onClick={() => revoke.mutate(item.id)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-7 border-t border-line pt-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-fg-subtle" /> Browser extension
        </h3>
        <p className="mb-3 text-sm text-fg-muted">The Chrome extension signs in automatically. If it doesn't, paste this login token into it. Keep it secret.</p>
        <CopyField value={token ?? ""} label="login token" secret />
      </div>
    </Section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-xs font-semibold text-ai">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1.5 text-[15px] font-semibold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function LabelsSection() {
  const labels = useLabels();
  const { add, rename, remove } = useLabelActions();
  const toast = useToast();
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Label | null>(null);

  const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : "Something went wrong.");

  return (
    <Section icon={<Tag />} title="Labels" description="Group videos so they're easy to find again.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate(name, { onSuccess: () => setName(""), onError });
        }}
        className="flex gap-2"
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New label, e.g. Machine learning" maxLength={60} aria-label="New label name" />
        <Button type="submit" variant="primary" className="h-11" loading={add.isPending} disabled={!name.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>

      <ul className="mt-4 divide-y divide-line">
        {labels.isPending && <Skeleton className="h-12" />}
        {labels.data?.length === 0 && <li className="py-3 text-sm text-fg-subtle">No labels yet.</li>}
        {labels.data?.map((label) => (
          <LabelRow
            key={label.id}
            label={label}
            onRename={(next) => rename.mutateAsync({ id: label.id, name: next }).catch(onError)}
            onDelete={() => setDeleting(label)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError })}
        title={`Delete “${deleting?.label_name ?? ""}”?`}
        description="Videos keep their notes; they just lose this label."
      />
    </Section>
  );
}

function LabelRow({ label, onRename, onDelete }: { label: Label; onRename: (name: string) => Promise<unknown>; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label.label_name);
  const save = async () => {
    if (draft.trim() && draft.trim() !== label.label_name) await onRename(draft);
    setEditing(false);
  };
  return (
    <li className="flex items-center gap-2 py-2.5">
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") setEditing(false);
          }}
          aria-label="Label name"
          className="h-9"
        />
      ) : (
        <span className="flex-1 truncate text-sm font-medium">{label.label_name}</span>
      )}
      {editing ? (
        <>
          <Button variant="primary" size="icon-sm" onClick={() => void save()} aria-label="Save label"><Check className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(false)} aria-label="Cancel"><X className="size-4" /></Button>
        </>
      ) : (
        <>
          <Button variant="ghost" size="icon-sm" onClick={() => { setDraft(label.label_name); setEditing(true); }} aria-label={`Rename ${label.label_name}`}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" className="hover:text-danger" onClick={onDelete} aria-label={`Delete ${label.label_name}`}><Trash2 className="size-4" /></Button>
        </>
      )}
    </li>
  );
}

function SecuritySection() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      await api("/change-password", { method: "POST", body: { current_password: current, new_password: next } });
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Couldn't update the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={<Shield />} title="Security" description="Change your password. Accounts that use Google sign-in don't have one.">
      <form onSubmit={submit} className="max-w-sm space-y-4">
        <Field label="Current password">
          {(props) => <Input {...props} type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" />}
        </Field>
        <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          {(props) => <Input {...props} type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" />}
        </Field>
        <Field label="Confirm new password">
          {(props) => <Input {...props} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />}
        </Field>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-danger">{error}</p>
        <Button type="submit" variant="primary" loading={busy} disabled={!current || !next}>
          Update password
        </Button>
      </form>
    </Section>
  );
}

function DataSection() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const exportAll = async () => {
    setBusy(true);
    try {
      await downloadFile("/api/export", "clipnote-export.md");
      toast.success("Export downloaded");
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 404 ? "You have no notes to export yet." : "Export failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section icon={<UserRound />} title="Your data" description="Your notes are yours. Take them anywhere.">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Export everything as Markdown</p>
          <p className="text-sm text-fg-muted">One file with a seek link on every note. Works with Obsidian and Notion.</p>
        </div>
        <Button variant="secondary" loading={busy} onClick={() => void exportAll()}>
          <Download className="size-4" /> Export all
        </Button>
      </div>
    </Section>
  );
}
