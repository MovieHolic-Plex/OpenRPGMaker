/**
 * 두 제공자의 **로그인 개시**를 실제 브라우저에서 확인한다.
 *
 * 단위 테스트는 경로 선택 로직만 본다. 사용자가 겪는 것은 "로그인을 눌렀을 때 화면이
 * 무엇을 시키는가" 이므로, 여기서는 실제 패널을 열어 안내 문구·코드 줄·주소를 읽는다.
 * Codex 는 1455 점유 여부에 따라 코드 입력(device) 또는 자동 완료(browser) 로 갈린다.
 *
 * 실행: RPG_ZZU_URL=http://127.0.0.1:9833 node scripts/qa-codex-login-paths.mjs <출력디렉터리>
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9833";
const OUT = process.argv[2] ?? "output/evidence/codex-login-paths";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 980 } });
const page = await context.newPage();
page.on("dialog", (d) => d.accept());
// 로그인은 window.open 으로 동의 화면을 띄운다 — 팝업은 즉시 닫아 QA 흐름을 막지 않게 한다.
context.on("page", (popup) => {
  if (popup !== page) popup.close().catch(() => {});
});
await mkdir(OUT, { recursive: true });

const failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
  if (!ok) failures.push(label);
}
function checkMatch(label, actual, pattern) {
  const ok = pattern.test(String(actual ?? ""));
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${JSON.stringify(String(actual ?? "").slice(0, 160))}`);
  if (!ok) failures.push(label);
}

async function openSettings() {
  let booted = false;
  for (let attempt = 1; attempt <= 4 && !booted; attempt += 1) {
    try {
      await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
      booted = true;
    } catch (error) {
      console.log(`INFO boot attempt ${attempt} failed: ${String(error).split("\n")[0].slice(0, 120)}`);
    }
  }
  if (!booted) throw new Error("editor did not boot");
  await page.getByTestId("topbar-ai-settings").click();
  await page.getByTestId("ai-oh-my-pi-provider").waitFor({ state: "visible", timeout: 30_000 });
}

// 상태 배지의 tone 이 checking 을 벗어날 때까지 기다린다 — 시간이 아니라 상태를 기다린다.
async function settledTone() {
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ai-oauth-status"]')?.dataset.tone !== "checking",
    null,
    { timeout: 60_000 },
  );
  return page.getByTestId("ai-oauth-status").getAttribute("data-tone");
}

async function startLogin(provider) {
  await page.getByTestId("ai-oh-my-pi-provider").selectOption(provider);
  // 이 머신에는 이미 자격이 있어(런타임이 Codex CLI 자격도 채택한다) 로그인 버튼이
  // "연결 확인" 으로 동작한다. 로그인 경로를 보려면 먼저 연결을 끊어야 한다.
  await settledTone();
globalThis.disconnect = page.getByTestId("ai-auth-disconnect");
  if (await disconnect.isVisible()) {
    await disconnect.click();
    await settledTone();
  }
  await page.getByTestId("ai-oauth-login").click();
  // 시간을 기다리지 않는다: 로그인 응답이 도착하면 device 블록이 보이게 된다.
  await page.getByTestId("ai-oauth-device-code").waitFor({ state: "visible", timeout: 60_000 });
  return {
    url: await page.getByTestId("ai-oauth-device-url").getAttribute("href"),
    code: (await page.getByTestId("ai-oauth-device-usercode").textContent())?.trim() ?? "",
    step2: (await page.getByTestId("ai-oauth-device-step2").textContent())?.trim() ?? "",
    codeRowVisible: await page.getByTestId("ai-oauth-device-code-row").isVisible(),
    hint: (await page.getByTestId("ai-auth-hint").textContent())?.trim() ?? "",
  };
}

await openSettings();

const codex = await startLogin("openai-codex");
console.log(`INFO codex login: ${JSON.stringify(codex)}`);
checkMatch("Codex 로그인이 실제 OpenAI 주소를 준다", codex.url, /^https:\/\/auth\.openai\.com\/(codex\/device|oauth\/authorize)/);
await page.screenshot({ path: path.join(OUT, "01-codex-login.png") });
if (codex.url?.includes("/codex/device")) {
  checkMatch("device 경로면 실제 코드가 채워져 있다", codex.code, /^[A-Z0-9]{4}-[A-Z0-9]{4,6}$/);
  check("device 경로면 코드 줄이 보인다", codex.codeRowVisible, true);
  checkMatch("device 경로면 2단계가 코드 입력을 시킨다", codex.step2, /코드를 입력/);
} else {
  check("browser 경로면 코드 줄을 감춘다", codex.codeRowVisible, false);
  checkMatch("browser 경로면 자동 완료를 안내한다", codex.step2, /자동으로 연결/);
  checkMatch("browser 경로는 고정 콜백을 쓴다", codex.url, /redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback/);
}

await page.getByTestId("ai-oauth-device-cancel").click();

const anti = await startLogin("google-antigravity");
console.log(`INFO antigravity login: ${JSON.stringify(anti)}`);
checkMatch("Antigravity 로그인이 실제 Google 동의 주소를 준다", anti.url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
checkMatch("루프백 콜백이 인가 요청에 실린다", anti.url, /redirect_uri=http%3A%2F%2Flocalhost%3A\d+%2Foauth-callback/);
checkMatch("refresh token 을 받는 파라미터가 있다", anti.url, /access_type=offline/);
// 코드가 없는 로그인에서 빈 코드 줄과 "이 코드를 입력하세요" 가 남아 있으면 없는 코드를 찾게 된다.
check("코드가 없으므로 코드 줄을 감춘다", anti.codeRowVisible, false);
checkMatch("2단계가 자동 완료를 안내한다", anti.step2, /자동으로 연결/);
await page.screenshot({ path: path.join(OUT, "02-antigravity-login.png") });

await page.getByTestId("ai-oauth-device-cancel").click();
await browser.close();

console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : `\nFAILURES: ${JSON.stringify(failures)}`);
process.exit(failures.length === 0 ? 0 : 1);
