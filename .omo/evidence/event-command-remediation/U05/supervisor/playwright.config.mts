import assert from "node:assert/strict";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const owned = process.env.U05_OWNED_ROOT;
assert.ok(owned);
export default defineConfig({
  testDir: join(process.cwd(), "test/e2e"),
  testMatch: "event-command-remediation-U05.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 360_000,
  outputDir: join(owned, "playwright-output"),
  use: {
    baseURL: process.env.U05_EDITOR_URL,
    browserName: "firefox",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
});
