// 임시 정찰 3: 코치마크를 닫은 뒤 맵 표면이 실제로 마운트되는지 실측한다.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "verify-shots/uiux-adversarial";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

await page.goto("http://127.0.0.1:9999/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
if (await page.locator("[data-testid='load-error-start-sample']").count()) {
  await page.locator("[data-testid='load-error-start-sample']").click();
  await page.waitForTimeout(12000);
}
// 코치마크 전부 건너뛰기
for (let i = 0; i < 4; i += 1) {
  const skip = page.locator("[data-testid='coach-mark-skip']");
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(600); } else break;
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/recon3-after-coach.png` });

const probe = await page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const mainKids = [...document.querySelectorAll("main > *")].map((e) => ({ cls: String(e.className).slice(0, 60), rect: r(e), display: getComputedStyle(e).display }));
  const canvases = [...document.querySelectorAll("canvas")].map((e) => ({ cls: String(e.className).slice(0, 50), rect: r(e), w: e.width, h: e.height }));
  const suspects = ["#app", "main", ".editor-canvas", ".map-canvas", ".editor-canvas-host", ".editor-workspace", "[data-testid='map-canvas']", ".canvas-toolbar", ".palette", ".tile-palette", ".map-tree", ".ai-panel", "[data-testid='chat-side-panel']"];
  const found = {};
  for (const s of suspects) found[s] = r(document.querySelector(s));
  return {
    bodyClass: document.body.className,
    mainKids, canvases, found,
    mainHTML: document.querySelector("main")?.outerHTML.slice(0, 1200) ?? null,
  };
});
console.log(JSON.stringify({ probe, errors: [...new Set(errors)].slice(0, 10) }, null, 2));
await browser.close();
