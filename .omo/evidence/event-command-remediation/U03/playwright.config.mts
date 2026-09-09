import { defineConfig } from "@playwright/test";
import { join } from "node:path";
export default defineConfig({
  testDir: join(process.cwd(), "test/e2e"),
  testMatch: "event-command-remediation-U03.spec.ts",
  workers: 1, retries: 0, timeout: 240_000,
  outputDir: join(process.env.U03_OWNED_ROOT!, "playwright-output"),
  reporter: [["list"]],
  use: { baseURL: process.env.U03_EDITOR_URL, browserName: "firefox", viewport: { width: 1280, height: 800 }, headless: true },
});
