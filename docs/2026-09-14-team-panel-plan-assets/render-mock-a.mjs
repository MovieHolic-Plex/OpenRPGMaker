/**
 * A 안 목업 렌더 — mock/assistant-work-deck.html 을 실측 바탕 위에 얹어 PNG 로 굽는다.
 * 사용: node docs/2026-09-14-team-panel-plan-assets/render-mock-a.mjs
 * 출력: docs/2026-09-14-team-panel-plan-assets/proposed-a/*.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "proposed-a");
mkdirSync(OUT, { recursive: true });
const mockUrl = pathToFileURL(join(HERE, "mock", "assistant-work-deck.html")).href;

const shots = [
  ["a1-work-running-1440", "work-running", { w: 1440, h: 900 }, "1440x900-idle.png", "deckH=612&annot=1"],
  ["a2-chat-during-run-1440", "chat", { w: 1440, h: 900 }, "1440x900-idle.png", "deckH=430"],
  ["a3-single-run-1440", "single", { w: 1440, h: 900 }, "1440x900-idle.png", "deckH=540"],
  ["a4-work-review-1440", "work-review", { w: 1440, h: 900 }, "1440x900-idle.png", "deckH=612"],
  ["a5-work-running-1920", "work-running", { w: 1920, h: 1080 }, "1920x1080-idle.png", "deckH=700"],
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [name, state, vp, bgFile, extra] of shots) {
  const bgPath = join(HERE, "base", bgFile);
  if (!existsSync(bgPath)) { console.log("skip (no bg)", name); continue; }
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${mockUrl}?state=${state}&w=${vp.w}&h=${vp.h}&bg=${encodeURIComponent(pathToFileURL(bgPath).href)}&${extra}`);
  await page.waitForTimeout(500);
  await page.locator("#stage").screenshot({ path: join(OUT, `${name}.png`) });
  console.log("shot", name, errors.length ? `ERRORS: ${errors.join(" | ")}` : "");
  await context.close();
}
await browser.close();
console.log("done");
