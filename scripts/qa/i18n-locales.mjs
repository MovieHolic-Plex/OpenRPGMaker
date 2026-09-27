#!/usr/bin/env node
// 편집기 다국어 브라우저 QA — 네 언어 첫 화면, 미지원 언어 폴백, 자동화 가드, 「보기 → 언어」 전환·유지.
// 사용: npm run dev:worktree 로 서버를 띄운 뒤  node scripts/qa/i18n-locales.mjs [--base http://127.0.0.1:<port>/]
// 결과: verify-shots/i18n/<locale>.png, switch-*.png, report.json
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const baseIndex = process.argv.indexOf("--base");
const BASE = baseIndex > 0 ? process.argv[baseIndex + 1] : `http://127.0.0.1:${process.env.DEV_SERVER_PORT ?? 9999}/`;
const OUT = "verify-shots/i18n";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader"] });
const report = {};

async function probe(page) {
  return page.evaluate(() => {
    const txt = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
    const hangul = [];
    const walker = document.createTreeWalker(document.querySelector(".topbar") ?? document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/[\uac00-\ud7a3]/.test(n.data) && n.parentElement?.offsetParent !== null) hangul.push(n.data.trim());
    return {
      htmlLang: document.documentElement.lang,
      dataLocale: document.documentElement.dataset.locale ?? null,
      viewMenu: txt(".workspace-panels-label"),
      saved: localStorage.getItem("oprn:locale"),
      topbarHangulLeft: hangul.slice(0, 15),
      topbarHangulCount: hangul.length,
    };
  });
}

async function boot(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="workspace-panels-button"]', { state: "attached", timeout: 300000 });
  await page.waitForFunction(() => document.documentElement.dataset.locale !== undefined || document.documentElement.lang === "ko", null, { timeout: 60000 });
}

for (const [name, locale] of [["en-US", "en-US"], ["ja-JP", "ja-JP"], ["zh-CN", "zh-CN"], ["ko-KR", "ko-KR"], ["fr-FR", "fr-FR"], ["zh-TW", "zh-TW"]]) {
  const context = await browser.newContext({ locale, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await boot(page, `${BASE}?localeDetect=1`);
  await page.locator('[data-testid="workspace-panels-button"]').first().click();
  await page.waitForSelector(".workspace-panels-menu.open");
  await page.screenshot({ path: `${OUT}/${name}.png` });
  report[name] = await probe(page);
  await context.close();
}

// 자동화 가드: 감지 강제 없이 en-US 로캘이면 한국어로 남는다.
{
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await boot(page, BASE);
  report["automation-guard-en-US"] = await probe(page);
  await context.close();
}

// 전환기: 한국어로 시작 → 보기 ▾ → 日本語 → 새로고침 후에도 일본어 → 한국어로 복귀.
{
  const context = await browser.newContext({ locale: "ko-KR", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await boot(page, `${BASE}?localeDetect=1`);
  const before = await probe(page);
  await page.locator('[data-testid="workspace-panels-button"]').first().click();
  await page.locator('[data-testid="workspace-locale-ja"]').click();
  await page.waitForFunction(() => document.documentElement.lang === "ja");
  await page.waitForFunction(() => !/[\uac00-\ud7a3]/.test(document.querySelector(".workspace-panels-label")?.textContent ?? "가"));
  const afterSwitch = await probe(page);
  await page.screenshot({ path: `${OUT}/switch-ja.png` });
  await boot(page, `${BASE}?localeDetect=1`);
  const afterReload = await probe(page);
  await page.screenshot({ path: `${OUT}/switch-ja-reload.png` });
  await page.locator('[data-testid="workspace-panels-button"]').first().click();
  await page.locator('[data-testid="workspace-locale-ko"]').click();
  await page.waitForFunction(() => document.documentElement.lang === "ko");
  await page.waitForFunction(() => document.querySelector(".workspace-panels-label")?.textContent === "보기");
  const backToKo = await probe(page);
  await page.screenshot({ path: `${OUT}/switch-back-ko.png` });
  report.switcher = { before, afterSwitch, afterReload, backToKo };
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
