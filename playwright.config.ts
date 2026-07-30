import { defineConfig, devices } from "@playwright/test";

const devServerPort = process.env.DEV_SERVER_PORT ?? "9173";
const devServerUrl = `http://127.0.0.1:${devServerPort}`;

/* `_` 로 시작하는 스펙(`_vxace-shots`, `_quest-playthrough`,
 * `test.setTimeout(240_000)` 짜리 `_battle-turnbased-review` 등)은 임시·진단용이다.
 * 기본 스위트에 섞이면 CI 시간이 크게 늘어나므로 기본 실행에서는 제외한다.
 *
 * 방식 선택 근거(추측 아님 — 실측):
 *  - `testIgnore` 는 CLI 로 파일 경로를 **직접 준 경우에도 그대로 적용된다**.
 *    testIgnore 를 켠 상태에서 `npx playwright test test/e2e/_vxace-shots.spec.ts --list`
 *    → "Error: No tests found."; testIgnore 를 뺀 상태에서 같은 명령 → "Total: 1 test in 1 file".
 *    즉 testIgnore 만 쓰면 감독자가 이름을 줘도 돌릴 수 없다.
 *  - 별도 project 로 분리하는 방법은 안 된다. `npx playwright test` 는 프로젝트 필터가
 *    없으면 **모든 project 를 돌리므로** 진단 스펙이 다시 기본 스위트에 들어온다.
 *  - grep 태그(`grepInvert`)는 CLI `--grep` 이 `grepInvert` 를 덮지 않아 감독자가
 *    파일 이름만으로 돌리는 경로를 살릴 수 없다.
 * 그래서 CLI 인자를 보고 testIgnore 를 켜고 끈다. 진단 스펙을 **명시적으로 지목한 실행**
 * (경로 인자에 `_` 로 시작하는 파일 이름이 들어 있는 경우)에서만 제외를 해제한다.
 * `E2E_INCLUDE_DIAGNOSTICS=1` 로도 켤 수 있다.
 */
const diagnosticsRequested =
  process.env.E2E_INCLUDE_DIAGNOSTICS === "1" ||
  process.argv.slice(2).some((arg) => !arg.startsWith("-") && /(^|[\\/])_/.test(arg));
const testIgnore = diagnosticsRequested ? [] : ["**/_*.spec.ts"];

export default defineConfig({
  testDir: "test/e2e",
  testIgnore,
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
