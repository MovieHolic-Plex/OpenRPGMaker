// 임시 정찰: 에디터 표면 구조/testid 를 실측해 적대적 리뷰 캡처 계획을 세운다.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "verify-shots/uiux-adversarial";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 240)); });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 240)));

await page.goto("http://127.0.0.1:9999/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
await page.screenshot({ path: `${OUT}/recon-initial.png` });

const info = await page.evaluate(() => {
  const testids = [...document.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid"));
  const topLevel = [...document.querySelectorAll("#app > *")].map((e) => e.className || e.tagName);
  const menus = [...document.querySelectorAll(".editor-menubar button, [class*=menubar] button, [class*=topbar] button")]
    .map((e) => (e.textContent || "").trim()).filter(Boolean);
  const buttons = [...document.querySelectorAll("button")].map((e) => (e.getAttribute("aria-label") || e.title || e.textContent || "").trim().slice(0, 40)).filter(Boolean);
  return {
    bodyClass: document.body.className,
    testids: [...new Set(testids)],
    topLevel,
    menus: [...new Set(menus)],
    buttonCount: buttons.length,
    buttons: [...new Set(buttons)].slice(0, 120),
  };
});
console.log(JSON.stringify({ info, errors }, null, 2));
await browser.close();
