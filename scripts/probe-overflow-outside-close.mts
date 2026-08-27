/**
 * ⋯ 메뉴가 바깥 클릭으로 닫히는지 실제 포인터로 확인한다.
 *
 * 왜 별도인가: probe-sidebar-contract 는 Escape 가 실패했을 때만 바깥 클릭을 시험한다.
 * Escape 를 고친 뒤에는 그 분기에 도달하지 않으므로, 바깥 클릭 경로가 실측에서 빈다.
 *
 * 사용: npx tsx scripts/probe-overflow-outside-close.mts [--port 9814] [--mode standard]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argPort = process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1]! : "9814";
const argMode = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1]! : "standard";
const OUT = ".omo/evidence/left-sidebar-repair";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((mode) => {
  localStorage.setItem("oprn:editor-ui-mode", mode as string);
  localStorage.setItem("rpg-zzu:editor-ui-mode", mode as string);
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
}, argMode);
await page.goto(`http://127.0.0.1:${argPort}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
// 고정 대기(900ms)는 느린 머신에서 트리거가 아직 붙지 않은 채로 클릭해 경주에 진다.
// 조건으로 기다린다.
await page.locator('[data-testid="oprn-tool-overflow"]').waitFor({ state: "visible", timeout: 30_000 });

const steps: Record<string, unknown> = {};

const isOpen = () => page.evaluate(() => Boolean(document.querySelector('[data-testid="toolbar-overflow-dropdown"]')));
const open = async () => {
  // 클릭이 막히면 왜 막혔는지 남긴다: Playwright 의 actionability 실패는 "무엇이 대신
  // 이벤트를 받는가"를 말해 주지 않으므로, 실패 시 히트테스트 결과를 직접 찍는다.
  try {
    await page.getByTestId("oprn-tool-overflow").click({ timeout: 5000 });
  } catch (error) {
    steps.openBlockedBy = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="oprn-tool-overflow"]') as HTMLElement | null;
      if (!t) return "trigger-absent";
      const r = t.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) as HTMLElement | null;
      return `rect=${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} hit=${hit?.tagName}.${(hit?.className || "").split(" ")[0]} isTrigger=${hit === t || Boolean(t.contains(hit))}`;
    });
    steps.openError = String(error).split("\n")[0];
    throw error;
  }
  await page.waitForTimeout(250);
};
const rectOf = (sel: string) => page.evaluate((s) => {
  const el = document.querySelector(s) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}, sel);

await open();
steps.openedByTriggerClick = await isOpen();

/* 메뉴 안쪽 클릭은 닫지 않아야 한다 — 항목을 쓰려면 열려 있어야 하니까. */
const inspector = await rectOf('[data-testid="oprn-tool-inspector"]');
if (inspector) await page.mouse.click(inspector.x + inspector.width / 2, inspector.y + inspector.height / 2);
await page.waitForTimeout(250);
steps.stillOpenAfterInsideClick = await isOpen();

if (!(await isOpen())) await open();
const canvas = await rectOf('[data-testid="edit-canvas"]');
if (canvas) await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
await page.waitForTimeout(300);
steps.closedByCanvasClick = !(await isOpen());

await open();
const aiPanel = await rectOf('[data-testid="ai-panel"]');
if (aiPanel) await page.mouse.click(aiPanel.x + aiPanel.width / 2, aiPanel.y + 12);
await page.waitForTimeout(300);
steps.closedByAiPanelClick = !(await isOpen());
steps.aiPanelRect = aiPanel;

const file = join(OUT, `after-${argMode}-outside-close.json`);
mkdirSync(OUT, { recursive: true });
writeFileSync(file, JSON.stringify(steps, null, 2));
console.log(JSON.stringify(steps, null, 2));
const bad = ["openedByTriggerClick", "stillOpenAfterInsideClick", "closedByCanvasClick", "closedByAiPanelClick"].filter((k) => steps[k] !== true);
console.log(bad.length ? `\nFAIL: ${bad.join(", ")}` : "\nALL PASS");
await browser.close();
process.exit(bad.length ? 1 : 0);
