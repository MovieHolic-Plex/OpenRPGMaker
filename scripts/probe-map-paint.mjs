// 진단 스크립트 — 워크트리에서 편집기 맵 캔버스가 왜 비어 있는지 본다.
// 실행: node scripts/probe-map-paint.mjs [port]
import { chromium } from "@playwright/test";

const port = process.argv[2] ?? "9184";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage();
const errors = [];
const failed = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
page.on("requestfailed", (r) => failed.push(r.url().slice(-90) + " :: " + (r.failure()?.errorText ?? "")));
page.on("response", (r) => { if (r.status() >= 400) failed.push(r.status() + " " + r.url().slice(-90)); });

await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto(`http://127.0.0.1:${port}/?freshProject=1`);
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ timeout: 60_000 }).catch(() => {});
await page.waitForTimeout(8000);

const info = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll("canvas")].map((c) => {
    let distinct = -1;
    try {
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx && c.width > 0) {
        const d = ctx.getImageData(0, 0, Math.min(c.width, 300), Math.min(c.height, 300)).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4 * 53) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
        distinct = seen.size;
      }
    } catch (e) { distinct = -2; }
    return {
      cls: String(c.className ?? "").slice(0, 60),
      parentTestid: c.parentElement?.getAttribute?.("data-testid") ?? null,
      parentCls: String(c.parentElement?.className ?? "").slice(0, 60),
      w: c.width, h: c.height,
      cssW: Math.round(c.getBoundingClientRect().width),
      cssH: Math.round(c.getBoundingClientRect().height),
      distinct,
    };
  });
  const editCanvas = document.querySelector("[data-testid='edit-canvas']");
  return {
    canvases,
    editCanvasTag: editCanvas?.tagName ?? null,
    editCanvasChildren: editCanvas ? [...editCanvas.children].map((n) => n.tagName + "." + String(n.className).slice(0, 40)) : null,
    imgCount: document.querySelectorAll("img").length,
  };
});

console.log(JSON.stringify({ info, errors: errors.slice(0, 12), failed: failed.slice(0, 20) }, null, 2));
await browser.close();
