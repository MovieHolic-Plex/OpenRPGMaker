// 세부 증거 촬영: 배우 목록 표 · 개요 카드 hover · 카드 계산값.
import { launch, newPage, waitForApp, shot, BASE, OUT } from "./lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const label = process.argv[2] || "x";
const browser = await launch();
const page = await newPage(browser, { width: 1440, height: 900 });
const click = async (t, w = 1400) => {
  const el = page.locator(`[data-testid="${t}"]`).first();
  if (!(await el.count())) return false;
  await el.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(w);
  return true;
};
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await waitForApp(page);
await page.waitForTimeout(2200);
await click("toolbar-database", 3000);

const out = {};
// 1) 배우 목록 표 — 열 정렬
const table = page.locator(".db-actor-studio-table").first();
if (await table.count()) await table.screenshot({ path: `${OUT}/actor-table-${label}.png` }).catch(() => {});
out.actorColumns = await page.evaluate(() => {
  const h = document.querySelector(".db-actor-table-header");
  const r = document.querySelector("button.db-actor-table-row");
  if (!h || !r) return null;
  const xs = (n) => [...n.children].map((c) => Math.round(c.getBoundingClientRect().left));
  return { display: getComputedStyle(r).display, header: xs(h), row: xs(r) };
});

// 2) 개요 탭 — 카드 계산값 + hover
await click("db-tab-overview", 2200);
out.cards = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const cs = getComputedStyle(el);
    return { borderRadius: cs.borderRadius, font: cs.fontFamily.split(",")[0] + " " + cs.fontSize,
             textAlign: cs.textAlign, cursor: cs.cursor, borderColor: cs.borderColor };
  };
  return { article: pick("article.db-overview-pulse-card"), button: pick("button.db-overview-pulse-card"),
           stat: pick(".db-overview-stat") };
});
const canon = page.locator(".db-overview-canon").first();
if (await canon.count()) {
  await canon.hover().catch(() => {});
  await page.waitForTimeout(500);
  await canon.screenshot({ path: `${OUT}/canon-hover-${label}.png` }).catch(() => {});
  out.hover = await page.evaluate(() => {
    const el = document.querySelector(".db-overview-canon"); if (!el) return null;
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, borderColor: cs.borderTopColor, cursor: cs.cursor };
  });
  await page.mouse.move(0, 0); await page.waitForTimeout(400);
  if (await canon.count()) await canon.screenshot({ path: `${OUT}/canon-rest-${label}.png` }).catch(() => {});
}
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/detail.${label}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
