import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import baseConfig from "./playwright.config";

const port = process.env.DEV_SERVER_PORT ?? "19847";
const url = `http://127.0.0.1:${port}`;
const cacheDir = process.env.VITE_CACHE_DIR
  ?? fileURLToPath(new URL("./.omo/audio-e2e-vite-cache", import.meta.url));

// The shared host cancels Chromium module requests with ERR_NETWORK_CHANGED.
// Keep this feature's real-browser evidence reproducible without retrying tests.
export default defineConfig({
  ...baseConfig,
  timeout: 120_000,
  retries: 0,
  testMatch: ["audio-descriptions.spec.ts", "audio-description-search.spec.ts"],
  use: { ...baseConfig.use, baseURL: url },
  webServer: {
    command: `npm run dev:worktree -- --port ${port}`,
    env: {
      DEV_SERVER_PORT: port,
      DEV_SERVER_NO_TLS: "1",
      E2E_FREEZE_DEV_SERVER: "1",
      VITE_CACHE_DIR: cacheDir,
    },
    url,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{
    name: "firefox",
    use: {
      ...devices["Desktop Firefox"],
      browserName: "firefox",
    },
  }],
});
