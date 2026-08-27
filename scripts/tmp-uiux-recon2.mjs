// 임시 정찰 2: 예제 프로젝트를 열어 실제 에디터 표면 구조를 실측한다.
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
const sample = page.locator("[data-testid='load-error-start-sample']");
if (await sample.count()) {
  await sample.click();
  await page.waitForTimeout(12000);
}
await page.screenshot({ path: `${OUT}/recon2-sample.png` });

const info = await page.evaluate(() => {
  const testids = [...document.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid"));
  const cls = (sel) => [...document.querySelectorAll(sel)].map((e) => e.className).slice(0, 12);
  return {
    bodyClass: document.body.className,
    testidCount: testids.length,
    testids: [...new Set(testids)].slice(0, 200),
    topLevel: [...document.querySelectorAll("#app > *")].map((e) => e.className || e.tagName),
    menubar: [...document.querySelectorAll("[class*=menubar] button, [class*=menu-] button")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 40),
    railButtons: [...document.querySelectorAll("[class*=rail] button")].map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim()).filter(Boolean).slice(0, 40),
    sections: cls("main > *"),
    canvasEls: cls("canvas"),
  };
});
console.log(JSON.stringify({ info, errors: [...new Set(errors)].slice(0, 8) }, null, 2));
await browser.close();
