import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { LoginPage } from "@/features/auth/LoginPage";
import { ClipchatLanding } from "@/features/clipchat/ClipchatLanding";
import { ClipchatPage } from "@/features/clipchat/ClipchatPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { NotFound } from "@/features/NotFound";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { VideoPage } from "@/features/video/VideoPage";
import { SessionProvider } from "@/lib/session";
import { isVideoId } from "@/lib/youtube";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: (count, error) => count < 2 && (error as { status?: number }).status !== 404 },
  },
});

/** `/:videoId` only matches real 11-character YouTube ids; anything else is a 404. */
function VideoRoute() {
  const { videoId = "" } = useParams();
  return isVideoId(videoId) ? <VideoPage key={videoId} /> : <NotFound />;
}

function ClipchatRoute() {
  const { videoId = "" } = useParams();
  return isVideoId(videoId) ? <ClipchatPage key={videoId} /> : <NotFound />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<LibraryPage />} />
                <Route path="/library" element={<Navigate to="/dashboard" replace />} />
                <Route path="/clipchat" element={<ClipchatLanding />} />
                <Route path="/clipchat/:videoId" element={<ClipchatRoute />} />
                <Route path="/profile" element={<SettingsPage />} />
                <Route path="/settings" element={<Navigate to="/profile" replace />} />
                <Route path="/:videoId" element={<VideoRoute />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
