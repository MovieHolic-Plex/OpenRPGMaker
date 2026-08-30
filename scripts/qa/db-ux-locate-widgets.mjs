// scripts/qa/db-ux-locate-widgets.mjs
// 보고서용 근접 캡처 좌표를 찾는 탐색 스크립트. 숫자칸/슬라이더/접기/제목의 위치를 찍어 준다.
import { chromium } from "playwright";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:9877/";
const TABS = (process.env.TABS ?? "actors,items,skills,enemies,overview,system,terrain").split(",");

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.waitForTimeout(800);

for (const slug of TABS) {
  const ok = await page.evaluate((id) => {
    const n = document.querySelector(`[data-testid="db-tab-${id}"]`);
    if (!(n instanceof HTMLElement)) return false;
    n.scrollIntoView({ block: "nearest" });
    n.click();
    return true;
  }, slug);
  if (!ok) { console.log(`skip ${slug}`); continue; }
  await page.waitForTimeout(700);

  const found = await page.evaluate(() => {
    const root = document.querySelector(".database-modal-backdrop");
    if (!root) return null;
    const box = (n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const vis = (n) => { const r = n.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    const pick = (sel, max = 3) => [...root.querySelectorAll(sel)].filter(vis).slice(0, max)
      .map((n) => ({ cls: String(n.className).slice(0, 60), ...box(n), txt: (n.textContent || "").trim().slice(0, 24) }));
    return {
      number: pick('input[type="number"]'),
      numberWrap: pick(".db-number-field, .db-num, [class*=number]", 3),
      range: pick('input[type="range"]'),
      summary: pick("details > summary"),
      select: pick("select"),
      hero: pick(".db-overview-hero, .db-ws-hero, [class*=hero]", 2),
    };
  });
  console.log(`\n== ${slug}`);
  for (const [k, v] of Object.entries(found ?? {})) {
    if (!v.length) continue;
    console.log(` ${k}:`);
    for (const e of v) console.log(`   ${e.x},${e.y} ${e.w}x${e.h}  ${e.cls} | ${e.txt}`);
  }
}
await browser.close();
