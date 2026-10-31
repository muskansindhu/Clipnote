import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearToken, setToken, getToken } from "@/lib/api";
import { adoptGoogleCookie, notifyExtension, userFromToken, type SessionUser } from "@/lib/auth";
import { UNAUTHORIZED_EVENT } from "@/lib/constants";
import { applyTheme, readTheme, type ThemePreference } from "@/lib/theme";

interface SessionApi {
  user: SessionUser | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const SessionContext = createContext<SessionApi | null>(null);

interface TokenResponse {
  access_token: string;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => {
    adoptGoogleCookie();
    return getToken();
  });
  const [theme, setThemeState] = useState<ThemePreference>(readTheme);

  const accept = useCallback((value: string) => {
    setToken(value);
    setTokenState(value);
    notifyExtension(value);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const value = useMemo<SessionApi>(
    () => ({
      user: userFromToken(token),
      token,
      signIn: async (email, password) => {
        const data = await api<TokenResponse>("/login", { method: "POST", body: { email, password }, anonymous: true });
        accept(data.access_token);
      },
      signUp: async (username, email, password) => {
        const data = await api<TokenResponse>("/signup", {
          method: "POST",
          body: { username, email, password },
          anonymous: true,
        });
        accept(data.access_token);
      },
      signOut,
      theme,
      setTheme: (next) => {
        applyTheme(next);
        setThemeState(next);
      },
    }),
    [token, accept, signOut, theme],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>");
  return context;
}
