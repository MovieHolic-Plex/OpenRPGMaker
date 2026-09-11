// 카탈로그 HTML의 섹션을 PNG 시트로 찍는다(한글 라벨 포함).
// 사용: node scripts/_house-catalog-shots.mjs
import { chromium } from "/home/main/z-project/rpg-zzu/node_modules/playwright/index.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DIR = path.resolve("output/evidence/house-full-catalog");
const OUT = path.join(DIR, "sheets");
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1560, height: 1200 }, deviceScaleFactor: 1 })).newPage();
await page.goto(pathToFileURL(path.join(DIR, "catalog.html")).href, { waitUntil: "load" });
await page.waitForTimeout(1500);
const shots = await page.evaluate(() => [...document.querySelectorAll("section[data-sheet]")].map((n) => n.getAttribute("data-sheet")));
for (const label of shots) {
  const section = page.locator(`section[data-sheet="${label}"]`);
  const name = label.replace(/^([0-9]+)\.\s*/, "$1-").replace(/[\\/:*?"<>|\s]+/g, "_").replace(/_+/g, "_");
  await section.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("sheet", name);
}
await page.screenshot({ path: path.join(DIR, "full-report.png"), fullPage: true });
console.log("full-report done");
await browser.close();
