import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ["--no-sandbox","--use-gl=swiftshader","--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const n of ["f-stack","f-stack-open","f-stack-min"]) {
  await page.goto("file://" + join(here, n + ".html")); await page.waitForTimeout(400);
  await page.screenshot({ path: join(here, n + ".png") });
}
await page.goto("file://" + join(here, "f-stack.html")); await page.waitForTimeout(300);
await page.screenshot({ path: join(here, "f-chat-only.png"), clip: { x: 970, y: 480, width: 470, height: 420 } });
await page.screenshot({ path: join(here, "f-stack-folded.png"), clip: { x: 360, y: 640, width: 480, height: 260 } });
await page.goto("file://" + join(here, "f-stack-open.html")); await page.waitForTimeout(300);
await page.screenshot({ path: join(here, "f-stack-open-detail.png"), clip: { x: 360, y: 300, width: 510, height: 600 } });
await browser.close();
