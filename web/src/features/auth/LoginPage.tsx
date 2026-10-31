import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lightbulb, MessageSquareQuote, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { GoogleIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ApiError } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { useSession } from "@/lib/session";

type Mode = "signin" | "signup";

export function LoginPage() {
  const { user, signIn, signUp } = useSession();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("mode") === "signup" ? "signup" : "signin";
  const next = params.get("next");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={next && next.startsWith("/") ? next : "/dashboard"} replace />;

  const switchMode = () => {
    setError(null);
    setParams(mode === "signin" ? { mode: "signup", ...(next ? { next } : {}) } : next ? { next } : {});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await signUp(username.trim(), email.trim().toLowerCase(), password);
      else await signIn(email.trim().toLowerCase(), password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <ShowcasePanel />

      <div className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Clipnote home" className="lg:invisible">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-[15px] text-fg-muted">
              {isSignup
                ? "Start turning what you watch into notes you reuse."
                : "Sign in to pick up where you left off."}
            </p>

            <a
              href="/login/google"
              className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface-1 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              <GoogleIcon className="size-[18px]" />
              Continue with Google
            </a>

            <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle">
              <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              {isSignup && (
                <Field label="Username">
                  {(props) => (
                    <Input
                      {...props}
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      placeholder="muskan"
                      required
                    />
                  )}
                </Field>
              )}
              <Field label="Email">
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete={isSignup ? "email" : "username"}
                    placeholder="you@example.com"
                    required
                  />
                )}
              </Field>
              <Field label="Password" hint={isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}>
                {(props) => (
                  <div className="relative">
                    <Input
                      {...props}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      placeholder="••••••••"
                      className="pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                )}
              </Field>

              <p role="alert" aria-live="polite" className="min-h-5 text-sm text-danger">
                {error}
              </p>

              <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                {isSignup ? "Create account" : "Sign in"} {!busy && <ArrowRight className="size-4" />}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-fg-muted">
              {isSignup ? "Already have an account?" : "New to Clipnote?"}{" "}
              <button type="button" onClick={switchMode} className="font-medium text-violet hover:underline">
                {isSignup ? "Sign in" : "Create an account"}
              </button>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const SAMPLE_NOTES = [
  { time: "1:02", icon: Star, tone: "text-warning", text: "Review right before you forget. That is the whole trick." },
  { time: "1:10", icon: MessageSquareQuote, tone: "text-violet", text: "Each successful review doubles the interval.", ai: true },
  { time: "3:32", icon: Lightbulb, tone: "text-brand", text: "Is there an app that schedules this for me?" },
];

function ShowcasePanel() {
  const reduce = useReducedMotion();
  return (
    <div className="relative hidden overflow-hidden border-r border-line bg-bg-elev lg:block">

      <div className="relative flex h-full flex-col justify-between p-12">
        <Link to="/" aria-label="Clipnote home">
          <Logo />
        </Link>

        <div>
          <h2 className="max-w-md text-[40px] font-semibold leading-[1.08] tracking-tight">
            Every video becomes a note <span className="text-brand">you can search.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-muted">
            Capture the moment in two taps. Let AI write what you don't have time to type. Export it all to Markdown.
          </p>

          <div className="mt-10 max-w-md space-y-3">
            {SAMPLE_NOTES.map((note, index) => (
              <motion.div
                key={note.time}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.18, duration: 0.5 }}
                className="flex items-start gap-3 rounded-2xl border border-line-strong bg-surface-1/80 p-4 shadow-card backdrop-blur"
              >
                <span className="mt-0.5 rounded-md bg-violet/14 px-2 py-0.5 font-mono text-xs font-medium text-violet">
                  {note.time}
                </span>
                <p className="flex-1 text-sm leading-relaxed">{note.text}</p>
                <note.icon className={`mt-0.5 size-4 shrink-0 ${note.tone}`} aria-hidden="true" />
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-xs text-fg-subtle">Open source · self-hostable · your notes stay yours.</p>
      </div>
    </div>
  );
}
