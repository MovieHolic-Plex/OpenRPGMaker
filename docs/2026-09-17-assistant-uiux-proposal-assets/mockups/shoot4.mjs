import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ["--no-sandbox","--use-gl=swiftshader","--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const n of ["g-strip","g-strip-open","g-strip-min","g-strip-wide"]) { await page.goto("file://" + join(here, n + ".html")); await page.waitForTimeout(400); await page.screenshot({ path: join(here, n + ".png") }); }
await page.goto("file://" + join(here, "g-strip.html")); await page.waitForTimeout(300);
await page.screenshot({ path: join(here, "g-strip-detail.png"), clip: { x: 340, y: 700, width: 660, height: 200 } });
await page.goto("file://" + join(here, "g-strip-open.html")); await page.waitForTimeout(300);
await page.screenshot({ path: join(here, "g-strip-open-detail.png"), clip: { x: 340, y: 560, width: 660, height: 340 } });
await browser.close();
