// scripts/qa/db-ux-narrow-number-trace.mjs
// 눌린 숫자칸 한 곳의 조상 체인 폭을 추적해, 폭을 좁히는 진짜 규칙을 찾는다.
import { chromium } from "playwright";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:9877/";
const TAB = process.env.TAB ?? "enemies";

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.waitForTimeout(800);
await page.evaluate((id) => document.querySelector(`[data-testid="db-tab-${id}"]`)?.click(), TAB);
await page.waitForTimeout(700);

const trace = await page.evaluate(() => {
  const root = document.querySelector(".database-modal-backdrop");
  const bad = [...root.querySelectorAll('input[type="number"]')].find((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 0 && r.width < 24;
  });
  if (!bad) return null;
  const chain = [];
  let cur = bad;
  for (let i = 0; i < 9 && cur; i += 1) {
    const r = cur.getBoundingClientRect();
    const cs = getComputedStyle(cur);
    chain.push({
      tag: cur.tagName.toLowerCase(),
      cls: String(cur.className).slice(0, 62),
      w: Math.round(r.width * 10) / 10,
      display: cs.display,
      gridCols: cs.gridTemplateColumns,
      flex: cs.flex,
      minW: cs.minWidth,
      maxW: cs.maxWidth,
      width: cs.width,
    });
    cur = cur.parentElement;
  }
  return chain;
});
for (const n of trace ?? []) {
  console.log(`${String(n.w).padStart(7)}px  ${n.tag}.${n.cls}`);
  console.log(`          display=${n.display} flex=${n.flex} width=${n.width} min=${n.minW} max=${n.maxW}`);
  if (n.gridCols && n.gridCols !== "none") console.log(`          grid-cols=${n.gridCols}`);
}
await browser.close();
