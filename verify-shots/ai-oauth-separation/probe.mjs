// OAuth / API 키 분리 실측 프로브.
// 설정 모달을 열어 두 연결 종류의 화면을 각각 스샷으로 남기고, 제공자 옵션 수·키 칸 표시·
// 저장된 blob 에 비밀이 남지 않는지를 DOM/localStorage 레벨에서 확인한다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE_URL ?? "http://127.0.0.1:9802";
mkdirSync(OUT, { recursive: true });

const log = [];
const say = (line) => { log.push(line); console.log(line); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on("console", (msg) => {
  if (msg.type() === "error" && !/ERR_CONNECTION_REFUSED/.test(msg.text())) {
    say(`[console] ${msg.text().slice(0, 160)}`);
  }
});

await page.addInitScript(() => {
  localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  localStorage.removeItem("rpg-zzu:ai-config");
});
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6000);

// 설정 모달 열기 — 커맨드바 또는 헤더 토글.
for (const testid of ["ai-settings-command-bar", "ai-settings-toggle"]) {
  const button = page.getByTestId(testid);
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    break;
  }
}
await page.waitForSelector("[data-testid='ai-settings-modal']", { timeout: 15_000 });
await page.waitForTimeout(1200);

const readPanel = async () => page.evaluate(() => {
  const q = (id) => document.querySelector(`[data-testid='${id}']`);
  const select = q("ai-oh-my-pi-provider");
  return {
    options: select ? select.querySelectorAll("option").length : -1,
    optgroups: select
      ? Array.from(select.querySelectorAll("optgroup")).map((group) => group.getAttribute("label"))
      : [],
    optionTextSample: select
      ? Array.from(select.querySelectorAll("option")).slice(0, 3).map((o) => o.textContent)
      : [],
    keyRowHidden: q("ai-companion-key-row")?.hidden ?? null,
    // hidden 속성만 보면 안 된다 — author CSS 의 display 가 UA 의 [hidden] 을 이기면
    // DOM 은 숨겨졌는데 화면에는 그대로 보인다(2026-08-21 실측 결함). 실제 박스를 재어 확인한다.
    keyRowBoxHeight: q("ai-companion-key-row")?.getBoundingClientRect().height ?? null,
    deviceHidden: q("ai-oauth-device-code")?.hidden ?? null,
    deviceBoxHeight: q("ai-oauth-device-code")?.getBoundingClientRect().height ?? null,
    statusText: q("ai-oauth-status")?.textContent ?? null,
    statusTone: q("ai-oauth-status")?.dataset.tone ?? null,
    badge: q("ai-auth-kind-badge")?.textContent ?? null,
    hintHidden: q("ai-auth-hint")?.hidden ?? null,
    errorHidden: q("ai-oauth-server-error")?.hidden ?? null,
    oauthChecked: q("ai-auth-oauth")?.getAttribute("aria-checked") ?? null,
    apiKeyChecked: q("ai-auth-api-key")?.getAttribute("aria-checked") ?? null,
    // C4 에서 걷어낼 대상 — 지금은 아직 존재한다.
    legacyApiKeyField: Boolean(q("ai-config-apikey")),
    legacyBaseUrlField: Boolean(q("ai-config-baseurl")),
    storedBlob: localStorage.getItem("rpg-zzu:ai-config"),
  };
});

const oauth = await readPanel();
say(`[oauth] options=${oauth.options} optgroups=${JSON.stringify(oauth.optgroups)}`);
say(`[oauth] optionTextSample=${JSON.stringify(oauth.optionTextSample)}`);
say(`[oauth] keyRow hidden=${oauth.keyRowHidden} boxH=${oauth.keyRowBoxHeight} | device hidden=${oauth.deviceHidden} boxH=${oauth.deviceBoxHeight}`);
say(`[oauth] status="${oauth.statusText}" tone=${oauth.statusTone} badge="${oauth.badge}"`);
if (oauth.keyRowBoxHeight !== 0 || oauth.deviceBoxHeight !== 0) say("[FAIL] 구독 로그인 종류인데 키 칸/기기 블록이 화면에 보인다");
say(`[oauth] hintHidden=${oauth.hintHidden} errorHidden=${oauth.errorHidden} checked=${oauth.oauthChecked}/${oauth.apiKeyChecked}`);
await page.locator(".ai-settings-window").screenshot({ path: join(OUT, "kind-oauth.png") });

await page.getByTestId("ai-auth-api-key").click();
await page.waitForTimeout(1200);
const apiKey = await readPanel();
say(`[apiKey] options=${apiKey.options} optgroups=${JSON.stringify(apiKey.optgroups)}`);
say(`[apiKey] keyRow hidden=${apiKey.keyRowHidden} boxH=${apiKey.keyRowBoxHeight} | device hidden=${apiKey.deviceHidden} boxH=${apiKey.deviceBoxHeight}`);
say(`[apiKey] status="${apiKey.statusText}" tone=${apiKey.statusTone} badge="${apiKey.badge}"`);
if (!apiKey.keyRowBoxHeight) say("[FAIL] API 키 종류인데 키 칸이 보이지 않는다");
if (apiKey.deviceBoxHeight !== 0) say("[FAIL] 기기 로그인 블록이 시작 전에 보인다");
say(`[apiKey] checked=${apiKey.oauthChecked}/${apiKey.apiKeyChecked}`);
say(`[apiKey] storedBlob=${apiKey.storedBlob}`);
await page.locator(".ai-settings-window").screenshot({ path: join(OUT, "kind-apikey.png") });

say(`[legacy] ai-config-apikey=${apiKey.legacyApiKeyField} ai-config-baseurl=${apiKey.legacyBaseUrlField} (C4 에서 제거 예정)`);

// 저장된 blob 에 비밀이나 죽은 게이트웨이 주소가 없는지.
const blob = apiKey.storedBlob ? JSON.parse(apiKey.storedBlob) : {};
say(`[secrets] authMode=${blob.authMode} providerId=${blob.providerId} apiKey="${blob.apiKey ?? ""}" baseUrl="${blob.baseUrl ?? ""}"`);

writeFileSync(join(OUT, "probe-log.txt"), `${log.join("\n")}\n`, "utf8");
await browser.close();
