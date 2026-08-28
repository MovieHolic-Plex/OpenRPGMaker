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

/* 재시도는 "실패를 감추는 장치"가 아니라 **호스트 네트워크 변동** 대응이다.
 * 크로미움은 OS 의 네트워크 변경 알림(리눅스 netlink)을 받으면 진행 중인 요청을
 * 전부 취소한다. VPN/Tailscale 인터페이스가 흔들리거나 Wi-Fi 가 로밍하거나
 * docker/WSL 가상 NIC 이 재생성되면 `net::ERR_NETWORK_CHANGED` 로 네비게이션이
 * 죽는다. 알림이 요청별이 아니라 프로세스 전역이라 **127.0.0.1 dev 서버 접속도
 * 같이 죽는다** — 로컬 전용 스위트에서 네트워크 에러가 나는 이유가 이것이다.
 * 재시도된 테스트는 리포터가 "flaky" 로 따로 찍으므로 진짜 불안정 테스트가
 * 조용히 묻히지는 않는다. `E2E_RETRIES=0` 으로 끌 수 있다.
 * 스펙 러너를 안 타는 `scripts/*.mjs` 캡처 스크립트는 이 설정이 안 걸리므로
 * `scripts/lib/goto-retry.mjs` 의 `gotoWithRetry` 를 쓴다. */
const retriesRaw = Number.parseInt(process.env.E2E_RETRIES ?? "1", 10);
const retries = Number.isFinite(retriesRaw) && retriesRaw >= 0 ? retriesRaw : 1;

export default defineConfig({
  testDir: "test/e2e",
  testIgnore,
  retries,
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
    env: { DEV_SERVER_NO_TLS: "1" },
    url: devServerUrl,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
