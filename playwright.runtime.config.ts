// 런타임 전용 QA 설정. 기본 e2e 설정(playwright.config.ts)과 분리한 이유:
//
//  1. 기본 설정의 webServer 는 `npm run dev` = 에디터 셸 + 메인 vite config 를 띄운다.
//     런타임 QA 는 자체 player-QA 서버를 전용 cacheDir 로 띄우므로 그 서버가 필요 없고,
//     켜면 VITE_CACHE_DIR 없는 메인 config 가 공유 node_modules/.vite 를 흔든다
//     (vite.config.ts:350-354 의 실측 사망 경로).
//  2. testDir 을 test/runtime 으로 분리해 기본 스위트와 서로 간섭하지 않게 한다.
//     기본 설정은 testDir=test/e2e 라서 이 파일들을 보지 않는다.
import { defineConfig, devices } from "@playwright/test";

const retriesRaw = Number.parseInt(process.env.E2E_RETRIES ?? "1", 10);
const retries = Number.isFinite(retriesRaw) && retriesRaw >= 0 ? retriesRaw : 1;

export default defineConfig({
  testDir: "test/runtime",
  retries,
  timeout: 300_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
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
});
