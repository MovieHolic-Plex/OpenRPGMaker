// 특정 레코드 화면만 다시 찍는다. 전체 캡처는 호스트 부하가 높을 때 dev 서버 재최적화와
// 겹쳐 멈춘다(실측 2회). 리뷰 수정으로 값이 바뀐 레코드만 골라 갱신하는 최소 경로.
//
// 사용: DEV_SERVER_PORT=9861 node scripts/recapture-item-shots.mjs
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9861";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = resolve(process.cwd(), "verify-shots/item-catalog-after");

// [스크린샷 이름, 컬렉션, 찾을 레코드 이름, 탭 testid]
const TARGETS = [
  ["02-item-seed", "items", "숙련의 씨앗", "db-tab-items"],
  ["04-equipment-helmet", "equipment", "선봉대 뿔투구", "db-tab-equipment"],
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const done = [];
try {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").click({ timeout: 120_000 });
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 90_000 });
  const modal = page.getByTestId("database-modal");

  for (const [name, collection, recordName, tabTestId] of TARGETS) {
    await page.getByTestId(tabTestId).click();
    await page.waitForTimeout(500);
    const search = page.getByPlaceholder("이름 또는 ID 검색");
    await search.fill(recordName, { timeout: 60_000 });
    const row = page.locator(`[data-testid^='db-record-row-'][data-record-name='${recordName}']`).first();
    await row.waitFor({ state: "visible", timeout: 60_000 });
    await row.click();
    await page.waitForTimeout(300);
    await modal.screenshot({ path: resolve(OUT, `${name}.png`) });
    await search.fill("");
    console.log(`[shot] ${name} (${collection}: ${recordName})`);
    done.push({ name, collection, recordName });
  }

  // 매니페스트의 낡은 note 도 함께 손본다 — 보고서가 이 파일을 읽는다.
  const manifestPath = resolve(OUT, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.recapturedAt = new Date().toISOString();
  manifest.recaptured = done;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[done] ${done.length} shots recaptured`);
} finally {
  await browser.close();
}
