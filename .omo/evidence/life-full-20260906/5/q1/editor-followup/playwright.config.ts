import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "../../../../../../playwright.config";

export default defineConfig({
  ...base,
  testDir: resolve("test/e2e"),
  outputDir: resolve(".omo/evidence/life-full-20260906/5/q1/editor-followup/results"),
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: resolve(".omo/evidence/life-full-20260906/5/q1/editor-followup/report.json") }],
  ],
  webServer: undefined, // run.mjs owns a fresh strict-port Vite server, never a reused server.
});
