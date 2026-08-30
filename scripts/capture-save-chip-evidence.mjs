// 저장 상태 칩 하나만 찍는다. 전체 카탈로그 캡처는 무거워서 dev 서버 재최적화와 겹치면 멈춘다.
// 사용: DEV_SERVER_PORT=9871 node scripts/capture-save-chip-evidence.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9861";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = resolve(process.cwd(), "verify-shots/item-catalog-after");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
try {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").click({ timeout: 90_000 });
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-items-oprn-workbench").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByTestId("db-add-record").click();
  await page.keyboard.press("Escape").catch(() => {});

  const chip = page.getByTestId("db-autosave-state");
  await chip.first().waitFor({ state: "visible", timeout: 30_000 });
  const text = await chip.first().innerText();
  const title = await chip.first().getAttribute("title");
  console.log(`[chip] text=${JSON.stringify(text)}`);
  console.log(`[chip] title=${JSON.stringify(title)}`);

  // 칩은 톱바 리페인트마다 다시 부참기므로 locator.screenshot 은 detached 로 깨진다.
  // 상자를 한 번 읽어 페이지 스크린샷을 그 상자로 자른다 — 요소 부착 상태에 의지하지 않는다.
  const box = await chip.first().boundingBox();
  await page.screenshot({ path: resolve(OUT, "06-session-not-persisted-page.png") });
  if (box) {
    const pad = 8;
    await page.screenshot({
      path: resolve(OUT, "07-session-not-persisted-chip.png"),
      clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 },
    });
  }
  writeFileSync(
    resolve(OUT, "save-chip.json"),
    `${JSON.stringify({ capturedAt: new Date().toISOString(), base: BASE, text, title }, null, 2)}\n`,
    "utf8",
  );
  console.log("[done] 2 shots + save-chip.json");
} finally {
  await browser.close();
}
