// 도크 × 뷰 9개 상태에서 대화 로그(`.ai-chat-log`)가 어느 마운트에 붙고 화면에 보이는지 실측한다.
// 3단계(도크·로그 마운트 단일화)의 기준선이자 회귀 대조표다.
//
// 왜 필요한가: log 엘리먼트 하나를 glassLogMount / historyLogMount / volatileLogMount 세 곳
// 사이로 재부모화하는 코드가 applyComposerViewPolicy·applyHistoryOpen·applyStudio 세 곳에
// 흩어져 있어, 어떤 상태에서 로그가 어디에 있는지 코드만 보고는 알 수 없다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE_URL ?? "http://127.0.0.1:9802";
const LABEL = process.env.PROBE_LABEL ?? "before";
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
  localStorage.setItem("rpg-zzu:ai-studio-mode", "0");
});
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForSelector("[data-testid='ai-panel']", { timeout: 60_000 });
await page.waitForTimeout(3000);

// 도크 토글·기록·스튜디오 버튼은 메뉴 안(또는 숨은 테스트 훅)이라 DOM 클릭으로 태운다.
// 도키 연산은 `chat-dock-toggle`, 전잴 기록은 `ai-dock-toggle`(이름과 역할이 어긋나 있다),
// 스튜디오는 `ai-studio-toggle`. 세 버튼 모두 숨은 테스트 훅이라 DOM 클릭으로 태운다.
const hookClick = async (testid) => {
  await page.locator(`[data-testid='${testid}']`).first().evaluate((node) => node.click());
  await page.waitForTimeout(600);
};

const setDock = async (want) => {
  for (let i = 0; i < 4; i += 1) {
    const now = await page.getAttribute("[data-testid='ai-panel']", "data-chat-dock");
    if (now === want) return;
    await hookClick("chat-dock-toggle");
  }
  throw new Error(`dock ${want} 로 못 갔다`);
};

const readState = async () => page.evaluate(() => {
  const panel = document.querySelector("[data-testid='ai-panel']");
  const logEl = document.querySelector("[data-testid='ai-chat-log']");
  const box = logEl?.getBoundingClientRect();
  return {
    dock: panel?.dataset.chatDock ?? null,
    classes: ["is-history-open", "is-studio", "is-docked", "is-glass-idle", "is-collapsed"]
      .filter((name) => panel?.classList.contains(name)),
    parent: logEl?.parentElement?.className ?? "(detached)",
    connected: logEl ? logEl.isConnected : null,
    // 부모 체인이 문서에서 떨어져 있으면 isConnected 는 false 다 — 재부모화 누락의 지표.
    boxH: box ? Math.round(box.height) : null,
    boxW: box ? Math.round(box.width) : null,
  };
});

const rows = [];
for (const dock of ["glass", "side", "float"]) {
  await setDock(dock);
  // 기본 뷰
  rows.push({ view: "default", ...(await readState()) });
  // 기록 열기
  await hookClick("ai-dock-toggle");
  rows.push({ view: "history", ...(await readState()) });
  await hookClick("ai-dock-toggle");
  // 스튜디오
  await hookClick("ai-studio-toggle");
  rows.push({ view: "studio", ...(await readState()) });
  await hookClick("ai-studio-toggle");
}

say(`[${LABEL}] dock  | view    | log parent                | connected | boxH | panel classes`);
for (const row of rows) {
  say(`[${LABEL}] ${String(row.dock).padEnd(5)} | ${row.view.padEnd(7)} | ${String(row.parent).padEnd(25)} | ${String(row.connected).padEnd(9)} | ${String(row.boxH).padEnd(4)} | ${row.classes.join(",")}`);
}

writeFileSync(join(OUT, `matrix-${LABEL}.txt`), `${log.join("\n")}\n`, "utf8");
writeFileSync(join(OUT, `matrix-${LABEL}.json`), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
await browser.close();
