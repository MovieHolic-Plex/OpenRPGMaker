// C7 연결 해제 실측 프로브.
// 키를 하나 저장해 "연결됨" 상태를 만든 뒤, 인증 패널의 연결 해제 버튼이 뜨는지 → 누르면
// 상태가 미연결로 돌아가고 버튼이 사라지는지 → 서버 자격이 실제로 지워졌는지를 재본다.
//
// 주의: 이 프로브는 동반 서비스의 실제 자격 파일을 지운다. 개발 서버를
// RPG_ZZU_OH_MY_PI_AUTH_PATH 로 임시 경로에 띄워 두고 돌려라.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE_URL ?? "http://127.0.0.1:9802";
const PROVIDER = "groq";
mkdirSync(OUT, { recursive: true });

const log = [];
const say = (line) => { log.push(line); console.log(line); };

const authStatus = async () => {
  const response = await fetch(`${BASE}/auth/status?provider=${PROVIDER}`);
  return await response.json();
};

// 1) 연결됨 상태를 만든다 — 키 저장이 곧 연결이다.
const saved = await (await fetch(`${BASE}/auth/key?provider=${PROVIDER}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ provider: PROVIDER, apiKey: "gsk-disconnect-probe" }),
})).json();
say(`[seed] /auth/key → ${JSON.stringify(saved)}`);

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

// 설정 진입점은 헤더 ☰ / 컴포저 ☰ 메뉴 **안**에 있다(2026-08-23 메뉴 통합 이후).
// 메뉴를 열고 눌러도 되지만 도크 모드에 따라 어느 쪽이 붙어 있는지가 갈리므로, 존재하는
// 항목을 DOM 클릭으로 직접 태운다 — 이 프로브가 재는 대상은 메뉴가 아니라 인증 패널이다.
await page.locator("[data-testid='ai-settings-toggle'], [data-testid='ai-settings-command-bar']")
  .first()
  .evaluate((node) => node.click());
await page.waitForSelector("[data-testid='ai-settings-modal']", { timeout: 15_000 });

// 2) API 키 종류 + 저장한 제공자로 맞춘다.
await page.getByTestId("ai-auth-api-key").click();
await page.getByTestId("ai-oh-my-pi-provider").selectOption(PROVIDER);
await page.waitForTimeout(1500);

const readPanel = async () => page.evaluate(() => {
  const q = (id) => document.querySelector(`[data-testid='${id}']`);
  const disconnect = q("ai-auth-disconnect");
  return {
    status: q("ai-oauth-status")?.textContent ?? null,
    tone: q("ai-oauth-status")?.dataset.tone ?? null,
    loginLabel: q("ai-oauth-login")?.textContent ?? null,
    disconnectExists: Boolean(disconnect),
    disconnectHidden: disconnect?.hidden ?? null,
    // hidden 속성만 믿지 않는다 — author CSS 가 UA [hidden] 을 이기면 화면에는 남는다.
    disconnectBoxHeight: disconnect?.getBoundingClientRect().height ?? null,
  };
});

const connected = await readPanel();
say(`[connected] status="${connected.status}" tone=${connected.tone} login="${connected.loginLabel}"`);
say(`[connected] disconnect exists=${connected.disconnectExists} hidden=${connected.disconnectHidden} boxH=${connected.disconnectBoxHeight}`);
if (!connected.disconnectBoxHeight) say("[FAIL] 저장된 자격이 있는데 연결 해제 버튼이 화면에 없다");
await page.locator(".ai-settings-window").screenshot({ path: join(OUT, "connected-with-disconnect.png") });

// 3) 눌러서 지운다.
await page.getByTestId("ai-auth-disconnect").click();
await page.waitForTimeout(2000);
const after = await readPanel();
say(`[after] status="${after.status}" tone=${after.tone} login="${after.loginLabel}"`);
say(`[after] disconnect hidden=${after.disconnectHidden} boxH=${after.disconnectBoxHeight}`);
if (after.tone !== "disconnected") say(`[FAIL] 해제 후 tone 이 ${after.tone} 이다`);
if (after.disconnectBoxHeight !== 0) say("[FAIL] 지울 자격이 없는데 해제 버튼이 남아 있다");
await page.locator(".ai-settings-window").screenshot({ path: join(OUT, "after-disconnect.png") });

// 4) 서버 자격이 실제로 사라졌는지 — UI 문구가 아니라 서버 상태로 확인한다.
const serverAfter = await authStatus();
say(`[server] /auth/status → ${JSON.stringify(serverAfter)}`);
if (serverAfter.connected !== false) say("[FAIL] 서버에 자격이 남아 있다");

writeFileSync(join(OUT, "probe-log.txt"), `${log.join("\n")}\n`, "utf8");
await browser.close();
