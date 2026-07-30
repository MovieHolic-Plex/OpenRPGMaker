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
    // dev 서버는 인증서가 있으면 https 로 뜨는데 이 설정의 url 은 http 다 —
    // 평문으로 고정해야 webServer 폴링이 붙는다.
    env: { DEV_SERVER_NO_TLS: "1" },
    url: devServerUrl,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
