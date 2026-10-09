/**
 * 제안 목업(deck.html) 상태별 렌더 캡처. 사용: node scripts/capture-ai-assistant-mock.mjs
 * 출력: docs/2026-09-03-ai-assistant-modern-ui-assets/mock/<state>.png (+ 데크 크롭)
 */
import { chromium } from "@playwright/test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const DIR = join(process.cwd(), "docs", "2026-09-03-ai-assistant-modern-ui-assets", "mock");
const url = pathToFileURL(join(DIR, "deck.html")).href;
const states = [
  ["idle", 1440, 900], ["focused", 1440, 900], ["selection", 1440, 900], ["running", 1440, 900], ["review", 1440, 900],
  ["done", 1440, 900], ["plan", 1440, 900], ["ask", 1440, 900], ["menu", 1440, 900],
  ["collapsed", 1440, 900], ["collapsed-run", 1440, 900], ["collapsed-attn", 1440, 900], ["done@narrow", 1280, 800],
];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [state, w, h] of states) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(`${url}#${state}`);
  await page.waitForTimeout(400);
  const name = state.replace("@", "-");
  await page.screenshot({ path: join(DIR, `${name}.png`) });
  const deck = page.locator(".deck, .pill").first();
  if (await deck.count()) {
    const box = await deck.boundingBox();
    await deck.screenshot({ path: join(DIR, `${name}-crop.png`) });
    console.log("shot", name, box ? `${Math.round(box.width)}x${Math.round(box.height)} @${Math.round(box.x)},${Math.round(box.y)}` : "");
  }
  await page.close();
}
// 스튜디오(P3) 목업
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(DIR, "studio.html")).href);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(DIR, "studio.png") });
  console.log("shot studio");
  await page.close();
}
await browser.close();
