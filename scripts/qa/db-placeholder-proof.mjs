#!/usr/bin/env node
// 이미지 실패 자리표시자의 실표면 증명.
//
// 왜 필요한가: 시드 프로젝트에서는 자산이 전부 정상 로드되므로(HTTP 200, imgBroken 0)
// "실패했을 때 보이는가" 를 관찰할 기회가 없다. 그래서 사용자가 실제로 겪는 상황을
// 그대로 만든다 — 살아 있는 썸네일의 src 를 깨뜨려 error 경로를 태우고, 그 결과가
// 눈에 보이는 자리표시자인지 찍는다. 이것이 C2 의 실표면 근거다.
//
// 사용: PROOF_BASE=http://127.0.0.1:9873/ PROOF_OUT=verify-shots/db-ux/placeholder \
//         node scripts/qa/db-placeholder-proof.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { gotoWithRetry } from "../lib/goto-retry.mjs";

const BASE = process.env.PROOF_BASE ?? "http://127.0.0.1:9873/";
const OUT = process.env.PROOF_OUT ?? "verify-shots/db-ux/placeholder";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(60_000);
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
for (let a = 1; a <= 5; a += 1) {
  try {
    await gotoWithRetry(page, `${BASE}?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000, attempts: 3 });
    await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45_000 });
    break;
  } catch (e) { if (a === 5) throw e; await page.waitForTimeout(1500); }
}
await page.getByTestId("toolbar-database").click();
await page.waitForSelector('[data-testid="database-modal"]', { state: "visible", timeout: 30_000 });
await page.evaluate(() => {
  const n = document.querySelector('[data-testid="db-tab-items"]');
  if (n instanceof HTMLElement) n.click();
});
await page.waitForTimeout(900);

const report = {};

// 1. 정상 상태 기록 — 자리표시자가 없어야 한다.
report.before = await page.evaluate(() => {
  const thumbs = [...document.querySelectorAll(".db-list-thumb")];
  return {
    thumbs: thumbs.length,
    placeholders: document.querySelectorAll(".db-image-placeholder").length,
    failed: document.querySelectorAll(".db-image-load-failed").length,
  };
});
await page.screenshot({ path: `${OUT}/1-healthy.png`, animations: "disabled", timeout: 20_000 });

// 2. 살아 있는 썸네일들의 src 를 깨뜨린다 = 사용자가 겪는 실패 상황.
const broke = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll(".db-list-thumb img")].filter(
    (i) => i instanceof HTMLImageElement && i.naturalWidth > 0 && !i.classList.contains("db-list-thumb-probe")
  );
  const targets = imgs.slice(0, 8);
  for (const i of targets) i.src = `${location.origin}/assets/__does_not_exist__/${Math.random()}.png`;
  return targets.length;
});
await page.waitForTimeout(2500);

// 3. 실패 후 상태 — 자리표시자가 보이는 크기로 렌더돼야 한다.
report.after = await page.evaluate(() => {
  const ph = [...document.querySelectorAll(".db-image-placeholder")];
  const visible = ph.filter((p) => {
    const r = p.getBoundingClientRect();
    const cs = getComputedStyle(p);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05;
  });
  return {
    brokenImgs: [...document.querySelectorAll(".db-list-thumb img")].filter(
      (i) => i instanceof HTMLImageElement && i.complete && i.naturalWidth === 0
    ).length,
    placeholders: ph.length,
    visiblePlaceholders: visible.length,
    failedMarked: document.querySelectorAll(".db-image-load-failed").length,
    samples: visible.slice(0, 5).map((p) => {
      const r = p.getBoundingClientRect();
      return { cls: String(p.className).slice(0, 60), w: Math.round(r.width), h: Math.round(r.height),
        text: (p.textContent ?? "").trim().slice(0, 24), aria: p.getAttribute("aria-label") };
    }),
    // 상자가 0px 로 접히지 않았는지 = 예전 "빈 상자로 사라짐" 회귀 방지
    zeroSized: ph.filter((p) => { const r = p.getBoundingClientRect(); return r.width < 1 || r.height < 1; }).length,
  };
});
await page.screenshot({ path: `${OUT}/2-failed-placeholder.png`, animations: "disabled", timeout: 20_000 });

const listRect = await page.evaluate(() => {
  const pane = document.querySelector(".oprn-record-list-pane") ?? document.querySelector(".db-list-row")?.parentElement;
  if (!(pane instanceof HTMLElement)) return null;
  const r = pane.getBoundingClientRect();
  return { x: Math.max(0, Math.round(r.x) - 8), y: Math.max(0, Math.round(r.y) - 8), width: Math.round(r.width) + 16, height: Math.min(520, Math.round(r.height)) };
});
if (listRect) await page.screenshot({ path: `${OUT}/3-placeholder-closeup.png`, clip: listRect, animations: "disabled", timeout: 20_000 });

report.brokeCount = broke;
const pass = report.after.visiblePlaceholders > 0 && report.after.zeroSized === 0;
report.verdict = pass ? "PASS" : "FAIL";
writeFileSync(`${OUT}/proof.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\n${pass ? "PASS" : "FAIL"}: broke ${broke} images -> ${report.after.visiblePlaceholders} visible placeholders, ${report.after.zeroSized} zero-sized`);
console.log(`shots: ${OUT}/1-healthy.png  ${OUT}/2-failed-placeholder.png  ${OUT}/3-placeholder-closeup.png`);
await page.close();
await browser.close();
