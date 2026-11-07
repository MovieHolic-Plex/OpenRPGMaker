#!/usr/bin/env node
// 보고서 페이지 실측 — 1440(데스크톱)과 390(휴대폰) 폭에서 열어 캡처하고, 넘침·빈 그림·CDN 참조를 잰다.
//   node scripts/qa/broad/shot-report.mjs --url http://mdc-server:18301/fs-broad-qa.html --out verify-shots/fs-broad-qa
// 판정: 두 폭 모두 페이지 가로 넘침 없음, 그림 0장 실패 없음, 외부(CDN) 요청 0건.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { url: { type: "string" }, out: { type: "string", default: "verify-shots/fs-broad-qa" }, full: { type: "boolean", default: true } } });
if (!values.url) throw new Error("usage: shot-report.mjs --url <page> [--out dir]");
const OUT = path.resolve(values.out);
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME ?? ["/home/main/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", "/home/main/.cache/ms-playwright/chromium-1248/chrome-linux/chrome"].find((file) => fs.existsSync(file));

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader", "--disable-gpu"] });
const results = [];
for (const [name, viewport] of [["desktop-1440", { width: 1440, height: 900 }], ["mobile-390", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 500, isMobile: viewport.width < 500 });
  const page = await context.newPage();
  const external = [];
  const failed = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith("http://mdc-server:18301/") && !url.startsWith("data:")) { external.push(url); return route.abort(); }
    return route.continue();
  });
  page.on("requestfailed", (request) => failed.push(request.url()));
  const response = await page.goto(values.url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(2500);
  const stats = await page.evaluate(async () => {
    // Lazy images only decode once near the viewport; scroll the whole page so every <img> is fetched and measured.
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 600));
    const imgs = [...document.images];
    return {
      docWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      images: imgs.length,
      brokenImages: imgs.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src).slice(0, 20),
      notLoaded: imgs.filter((img) => !img.complete).length,
      sections: document.querySelectorAll("h2").length,
      height: document.body.scrollHeight,
    };
  });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: values.full });
  // Narrow-width sections that push the page sideways are the classic report defect; record which elements do it.
  const wideElements = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("main *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width > window.innerWidth + 2 && rect.height > 4) out.push({ el: el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""), width: Math.round(rect.width) });
      if (out.length >= 6) break;
    }
    return out;
  });
  results.push({ name, viewport, status: response?.status() ?? null, file, external: [...new Set(external)].slice(0, 10), failed: failed.slice(0, 10), wideElements, ...stats });
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "check.json"), `${JSON.stringify(results, null, 1)}\n`);
const pass = results.every((r) => r.status === 200 && !r.horizontalOverflow && r.brokenImages.length === 0 && r.external.length === 0);
console.log(JSON.stringify({ pass, results: results.map((r) => ({ name: r.name, status: r.status, images: r.images, broken: r.brokenImages.length, overflow: r.horizontalOverflow, external: r.external.length, sections: r.sections, height: r.height, file: r.file })) }, null, 1));
process.exit(pass ? 0 : 1);
