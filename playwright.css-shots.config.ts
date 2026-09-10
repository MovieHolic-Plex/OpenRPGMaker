import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// CSS 표면 격리 픽셀 기준선. 갱신: npm run shots:css:update (스펙 §3.5 예외 4건 외 갱신 금지)
export default defineConfig(base, {
  testMatch: "**/css-surface-shots.spec.ts",
  retries: 0,
  workers: 1,
  timeout: 180_000,
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled", caret: "hide", scale: "css" } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" } }],
});
