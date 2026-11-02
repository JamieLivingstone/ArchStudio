// @ts-expect-error type error without @types/node package
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;

// The hosted site's policy: scripts only from the site itself, and requests only to the providers.
// The desktop app's own is in tauri.conf.json; the dev server has none.
const webCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src https://api.anthropic.com https://api.openai.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

const webPolicy = {
  name: "web-content-security-policy",
  apply: "build" as const,
  transformIndexHtml: () =>
    process.env.TAURI_ENV_PLATFORM
      ? []
      : [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: webCsp },
            injectTo: "head-prepend" as const,
          },
        ],
};

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), webPolicy],

  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
