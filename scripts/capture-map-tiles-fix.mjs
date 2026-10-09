import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:9842";
const outDir = process.argv[3] ?? "verify-shots/map-tiles-fix";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, animations: "disabled" });
const log = (line) => console.log(`[fix] ${line}`);

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:editor-ui-mode", "expert");
});

await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120000 });

let ok = false;
for (let attempt = 1; attempt <= 8 && !ok; attempt++) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    ok = await page.getByTestId("toolbar-database").isVisible().catch(() => false);
    if (ok) break;
    await page.waitForTimeout(1500);
  }
  if (!ok) await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  log(`boot attempt ${attempt}: ${ok ? "ok" : "retry"}`);
}
if (!ok) throw new Error("editor never booted");

await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 30000 });
const mapGroup = page.getByTestId("db-tab-group-world");
await mapGroup.evaluate((n) => n.scrollIntoView({ block: "center" }));
if ((await mapGroup.getAttribute("aria-expanded")) !== "true") await mapGroup.click();
const tilesTab = page.getByTestId("db-tab-spatial-tiles");
await tilesTab.evaluate((n) => n.scrollIntoView({ block: "center" }));
await tilesTab.click();
await page.getByTestId("tileset-db-preview").waitFor({ state: "visible", timeout: 15000 });
await page.waitForTimeout(800);
await shot("01-passage-1440");

// 타일 설명 탭 — 시트가 넓은 열에 있어야 한다
await page.getByTestId("tileset-section-tab-knowledge").click();
await page.waitForTimeout(600);
await shot("02-knowledge-1440");

// 생성 감사 레일 펼치기
const rail = page.getByTestId("tileset-side-pane-toggle");
if (await rail.count()) {
  await rail.click();
  await page.waitForTimeout(400);
  await shot("03-knowledge-sidepane-open");
  await rail.click();
  await page.waitForTimeout(300);
}

// 자동 연결 탭
await page.getByTestId("tileset-section-tab-compose").click();
await page.waitForTimeout(600);
await shot("04-compose-1440");

// 통행·지형으로 돌아와 1x 배율
await page.getByTestId("tileset-section-tab-rules").click();
await page.waitForTimeout(400);
const scale1 = page.getByTestId("tileset-preview-scale-1");
if (await scale1.count()) {
  await scale1.click();
  await page.waitForTimeout(400);
  await shot("05-scale-1x");
}

// 1024×768 — 작업대 붕괴 회귀 확인
await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(600);
await shot("06-passage-1024");

const probe = await page.evaluate(() => {
  const pick = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    stage: pick(".spatial-stage"),
    editArea: pick(".tileset-db-edit-area"),
    preview: pick(".tileset-db-preview"),
    toggleHidden: getComputedStyle(document.querySelector(".spatial-inspector-toggle") ?? document.body).display,
  };
});
log(`1024 probe: ${JSON.stringify(probe)}`);

await page.setViewportSize({ width: 768, height: 900 });
await page.waitForTimeout(600);
await shot("07-passage-768");

await browser.close();
log("done");
