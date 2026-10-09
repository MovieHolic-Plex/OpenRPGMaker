// CSS 정리 작업용 캡처 공용 모듈.
// 크로미움 플래그가 없으면 vite dev 모듈이 전부 ERR_NETWORK_CHANGED 로 끊겨 백지가 된다.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

export const PORT = process.env.OPRN_PORT || "9891";
export const BASE = `http://127.0.0.1:${PORT}`;
export const OUT = process.env.OPRN_OUT || ".playwright-mcp/shots-2026-09-17";

export async function launch() {
  return chromium.launch({
    args: [
      "--disable-background-networking",
      "--disable-features=NetworkChangeNotifier,NetworkQualityEstimator",
      "--disable-network-portal-detection",
      "--disable-ipc-flooding-protection",
      "--no-sandbox",
    ],
  });
}

export async function newPage(browser, { width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  return page;
}

export async function waitForApp(page, { attempts = 6, perAttemptMs = 15000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const started = Date.now();
    while (Date.now() - started < perAttemptMs) {
      const text = await page.evaluate(() => document.body?.innerText?.length || 0);
      if (text > 40) return true;
      await page.waitForTimeout(400);
    }
    if (i < attempts - 1) {
      console.log(`  [waitForApp] 백지 — 리로드 재시도 ${i + 1}/${attempts - 1}`);
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    }
  }
  throw new Error("앱이 뜨지 않았다 (백지).");
}

export function shot(page, name, opts = {}) {
  mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
}
