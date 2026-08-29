// 진단용 — AI 채팅 패널 현 상태 실브라우저 캡처.
// 실행: PORT=9988 node scripts/_qa-chat-probe.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = process.env.PORT ?? "9988";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT ?? "verify-shots/chat-probe";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleErrors.push(`[${m.type()}] ${m.text()}`.slice(0, 400));
});
page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${String(e).slice(0, 400)}`));

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "basic");
});
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });

const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 }).catch(() => {});
for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
  const b = page.getByRole("button", { name: label }).first();
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
}
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) await restore.click().catch(() => {});
await page.waitForTimeout(1500);

async function metrics() {
  return await page.evaluate(() => {
    const box = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      return {
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        display: s.display,
        overflow: `${s.overflowX}/${s.overflowY}`,
        bg: s.backgroundColor,
        color: s.color,
        font: `${s.fontSize}/${s.lineHeight}`,
        z: s.zIndex,
        pos: s.position,
        scroll: n.scrollHeight ? [n.scrollWidth, n.scrollHeight, n.clientWidth, n.clientHeight] : null,
        text: (n.textContent ?? "").trim().slice(0, 160),
      };
    };
    const panel = document.querySelector("[data-testid='ai-panel']");
    return {
      url: location.href,
      dock: panel?.dataset.chatDock ?? null,
      conversation: panel?.dataset.aiConversation ?? null,
      panelClass: panel?.className ?? null,
      panel: box("[data-testid='ai-panel']"),
      header: box(".ai-chat-header"),
      main: box(".ai-chat-main"),
      log: box("[data-testid='ai-chat-log']") ?? box(".ai-chat-log"),
      welcome: box("[data-testid='ai-welcome']") ?? box(".ai-welcome"),
      nextSteps: box("[data-testid='ai-next-steps']"),
      commandBar: box(".ai-command-bar"),
      composer: box(".ai-composer"),
      input: box("[data-testid='ai-input']"),
      send: box(".ai-chat-send"),
      chips: box("[data-testid='ai-composer-chips']"),
      ctxChips: box("[data-testid='ai-context-chips']"),
      queue: box("[data-testid='ai-pending-queue']"),
      status: box("[data-testid='ai-status']") ?? box(".ai-chat-status"),
    };
  });
}

const report = { port: PORT, states: {} };
report.states.boot = await metrics();
await page.screenshot({ path: `${OUT}/01-boot-full.png` });
await page.getByTestId("ai-panel").screenshot({ path: `${OUT}/01-boot-panel.png` }).catch(() => {});

const input = page.getByTestId("ai-input");
if (await input.isVisible().catch(() => false)) {
  await input.click();
  await page.waitForTimeout(600);
  report.states.focus = await metrics();
  await page.screenshot({ path: `${OUT}/02-focus-full.png` });
  await page.getByTestId("ai-panel").screenshot({ path: `${OUT}/02-focus-panel.png` }).catch(() => {});

  await input.fill("마을 광장 북쪽에 대장간을 하나 지어줘");
  await page.waitForTimeout(600);
  report.states.typed = await metrics();
  await page.screenshot({ path: `${OUT}/03-typed-full.png` });
  await page.getByTestId("ai-panel").screenshot({ path: `${OUT}/03-typed-panel.png` }).catch(() => {});

  // 긴 여러 줄 입력 — 자동 성장/스크롤 전환 확인
  await input.fill(Array.from({ length: 12 }, (_, i) => `${i + 1}번째 줄 지시문 테스트`).join("\n"));
  await page.waitForTimeout(600);
  report.states.multiline = await metrics();
  await page.screenshot({ path: `${OUT}/04-multiline-full.png` });
  await page.getByTestId("ai-panel").screenshot({ path: `${OUT}/04-multiline-panel.png` }).catch(() => {});
  await input.fill("");
  await page.waitForTimeout(300);
} else {
  report.states.focus = "ai-input not visible";
}

// 실제 전송 시도 — 설정 미비 시 어떤 UI 가 뜨는지 본다(LLM 왕복 없음).
if (await input.isVisible().catch(() => false)) {
  await input.fill("테스트 지시");
  await input.press("Enter");
  await page.waitForTimeout(2500);
  report.states.afterSend = await metrics();
  await page.screenshot({ path: `${OUT}/05-after-send-full.png` });
  await page.getByTestId("ai-panel").screenshot({ path: `${OUT}/05-after-send-panel.png` }).catch(() => {});
  report.bodyText = await page.evaluate(() => {
    const p = document.querySelector("[data-testid='ai-panel']");
    return (p?.innerText ?? "").slice(0, 2500);
  });
}

report.consoleErrors = consoleErrors.slice(0, 40);
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ dock: report.states.boot?.dock, conversation: report.states.boot?.conversation, errors: consoleErrors.length }, null, 2));
await browser.close();
