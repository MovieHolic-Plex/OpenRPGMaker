import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  testMatch: /electron.*\.spec\.ts$/,
  timeout: 180_000,
  workers: 1,
  expect: { timeout: 20_000 },
  reporter: [["line"]],
});
