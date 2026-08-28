// 임시 진단 캡처 — DB 아이템 탭 UI 현황 스냅샷.
// 사용: node scripts/_capture-db-items.mjs [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const PORT = process.env.DEV_SERVER_PORT ?? "9832";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.argv[2] ?? "verify-shots/db-items";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await gotoWithRetry(page, `${BASE}/?freshProject=1`);
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-items-oprn-workbench").waitFor({ state: "visible" });
  const tag = `${vp.width}x${vp.height}`;
  const modal = page.getByTestId("database-modal");
  await modal.screenshot({ path: `${OUT}/items-${tag}-01-default.png` });

  // 종류별 패널: 약 / 책 / 장비형
  const rows = await page.locator("[data-testid^='db-record-row-']").allTextContents();
  console.log(tag, "rows", rows.length, rows.slice(0, 6));
  const typeSelect = page.getByTestId("db-field-item-type");
  for (const [type, label] of [["medicine", "02-medicine"], ["weapon", "03-weapon"], ["switch", "04-switch"]]) {
    await typeSelect.selectOption(type);
    await page.waitForTimeout(120);
    await modal.screenshot({ path: `${OUT}/items-${tag}-${label}.png` });
  }
  await context.close();
}
await browser.close();
console.log("done ->", OUT);
