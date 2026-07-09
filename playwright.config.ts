import { defineConfig, devices } from "@playwright/test";

const devServerPort = process.env.DEV_SERVER_PORT ?? "9173";
const devServerUrl = `http://127.0.0.1:${devServerPort}`;

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: devServerUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
        },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${devServerPort} --strictPort`,
    url: devServerUrl,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
