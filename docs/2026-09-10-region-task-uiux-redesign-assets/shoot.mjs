import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = "file://" + path.join(here, "..", "2026-09-10-region-task-uiux-redesign.html");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 2 });
await page.goto(page_url, { waitUntil: "load" });
await page.waitForTimeout(400);

const frames = await page.$$(".frame");
const names = ["a-current", "b-compose", "c-running", "d-result"];
for (let i = 0; i < frames.length; i += 1) {
  const out = path.join(here, `${names[i] ?? "frame-" + i}.png`);
  await frames[i].screenshot({ path: out });
  console.log("wrote", out);
}
await browser.close();
