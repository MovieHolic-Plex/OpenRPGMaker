import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ["--no-sandbox","--use-gl=swiftshader","--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const n of ["e-split","e-split-detail"]) {
  await page.goto("file://" + join(here, n + ".html")); await page.waitForTimeout(400);
  await page.screenshot({ path: join(here, n + ".png") }); console.log("shot", n);
}
await page.goto("file://" + join(here, "e-split.html")); await page.waitForTimeout(300);
await page.screenshot({ path: join(here, "e-split-panels.png"), clip: { x: 1060, y: 120, width: 380, height: 780 } });
await browser.close();
