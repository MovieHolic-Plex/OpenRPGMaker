import { defineConfig, devices } from "@playwright/test";

const devPort = process.env.PLAYWRIGHT_DEV_PORT ?? "5173";
const devUrl = `http://127.0.0.1:${devPort}`;

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: devUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${devPort}`,
    url: devUrl,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
