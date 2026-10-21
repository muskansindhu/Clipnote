import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

const API_ORIGIN = process.env.CLIPNOTE_API ?? "http://localhost:5001";

// In dev the SPA and the Flask API share paths (for example GET /login is a page and
// POST /login is the API). Browser navigations ask for HTML and get the SPA; everything
// else is proxied to Flask.
const proxy = {
  "^/(?!(@vite|@react-refresh|@id|@fs|src/|node_modules/|assets/|favicon)).*": {
    target: API_ORIGIN,
    changeOrigin: true,
    bypass(req: { headers: { accept?: string }; method?: string; url?: string }) {
      const wantsHtml = req.headers.accept?.includes("text/html");
      const isServerRedirect = /^\/(login\/google|auth\/|api\/)/.test(req.url ?? "");
      if (req.method === "GET" && wantsHtml && !isServerRedirect) return "/index.html";
      return undefined;
    },
  },
};

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/static/app/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173, proxy },
  build: {
    outDir: "../server/static/app",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
}));
