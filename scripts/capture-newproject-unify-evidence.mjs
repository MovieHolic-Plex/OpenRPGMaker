// 2026-09-11: 새 프로젝트 통합 증거 캡처 — 첫 화면 브리핑 포스터와 「새 프로젝트」 다이얼로그가
// 같은 이름·설명·그림을 쓰는지 사진과 DOM 텍스트로 함께 남긴다.
// 결과: verify-shots/newproject-unify-2026-09-11/
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:9872";
const OUT = "/home/main/z-project/rpg-zzu-welcome-newproject-unify/verify-shots/newproject-unify-2026-09-11";
mkdirSync(OUT, { recursive: true });
const errors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript(() => {
  try { Object.defineProperty(navigator, "webdriver", { get: () => false, configurable: true }); } catch { /* noop */ }
  try { localStorage.removeItem("oprn:editor-welcome-dismissed"); } catch { /* noop */ }
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));

// 1) 첫 화면 브리핑 — featured 3장 + 접힘 5장의 라벨/설명/그림 수집
await page.goto(`${BASE}/?forceWelcome=1`, { waitUntil: "domcontentloaded" });
await page.getByTestId("editor-welcome").waitFor({ state: "visible", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-briefing-featured.png` });
await page.getByTestId("editor-welcome-more-toggle").click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/02-briefing-all.png` });

const posters = await page.evaluate(() =>
  [...document.querySelectorAll("[data-preset-id]")].map((node) => {
    const card = node.querySelector(".editor-welcome-template-card");
    const img = card?.querySelector("img");
    return {
      choiceId: node.dataset.presetId,
      label: card?.getAttribute("aria-label")?.split(" — ")[0] ?? "",
      blurb: card?.getAttribute("aria-label")?.split(" — ")[1] ?? "",
      title: card?.querySelector(".editor-welcome-poster-title")?.textContent ?? "",
      art: img?.getAttribute("src") ?? "",
    };
  }),
);
writeFileSync(`${OUT}/posters.json`, JSON.stringify(posters, null, 2));

// 2) 브리핑을 닫고 「새 프로젝트」 다이얼로그 — 행 라벨/설명/그림 수집
await page.getByTestId("editor-welcome-skip").click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 45000 });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /새 프로젝트/ }).first().click();
await page.waitForTimeout(600);
await page.getByTestId("menu-project-new").click();
await page.getByTestId("new-project-dialog").waitFor({ state: "visible", timeout: 20000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/03-new-project-dialog.png` });

const rows = await page.evaluate(() =>
  [...document.querySelectorAll("[data-testid^='new-project-genre-option-']")].map((radio) => {
    const row = radio.closest(".new-project-genre-row");
    const img = row?.querySelector("img");
    return {
      choiceId: radio.dataset.testid.replace("new-project-genre-option-", ""),
      label: row?.querySelector(".new-project-genre-label")?.textContent ?? "",
      blurb: row?.querySelector(".new-project-genre-blurb")?.textContent ?? "",
      art: img?.getAttribute("src") ?? null,
    };
  }),
);
writeFileSync(`${OUT}/dialog-rows.json`, JSON.stringify(rows, null, 2));

// 3) 통합 대조 — 같은 선택지 id 의 이름·설명이 두 표면에서 같은가
const byId = new Map(posters.map((poster) => [poster.choiceId, poster]));
const mismatches = [];
for (const row of rows) {
  const poster = byId.get(row.choiceId);
  if (!poster) { mismatches.push({ choiceId: row.choiceId, reason: "첫 화면에 같은 선택지 없음" }); continue; }
  if (poster.label !== row.label) mismatches.push({ choiceId: row.choiceId, field: "label", poster: poster.label, row: row.label });
  if (poster.blurb !== row.blurb) mismatches.push({ choiceId: row.choiceId, field: "blurb", poster: poster.blurb, row: row.blurb });
}
const report = { base: BASE, posterCount: posters.length, rowCount: rows.length, mismatches, errors: errors.slice(0, 10) };
writeFileSync(`${OUT}/compare.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
process.exit(mismatches.length === 0 ? 0 : 1);

