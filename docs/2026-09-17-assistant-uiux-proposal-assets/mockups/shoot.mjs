import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ["--no-sandbox","--use-gl=swiftshader","--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const n of ["a-result-first","b-canvas-anchored","c-task-board","d-content"]) {
  await page.goto("file://" + join(here, n + ".html"));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(here, n + ".png") });
  console.log("shot", n);
}
// crops
await page.goto("file://" + join(here, "a-result-first.html")); await page.waitForTimeout(300);
await page.locator(".deck").screenshot({ path: join(here, "a-deck.png") });
await page.goto("file://" + join(here, "c-task-board.html")); await page.waitForTimeout(300);
await page.locator(".deck").screenshot({ path: join(here, "c-deck.png") });
await browser.close();
