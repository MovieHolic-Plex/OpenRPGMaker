// W3 task 7 manual QA — 카테고리 필터 칩 (아이템/장비).
// DB 모달 → 아이템 탭 → '무기' 칩 클릭 → 보이는 카드/행 수 감소, '전체' 클릭 → 복원.
// stale_state: 하드 리프레시 후에도 칩 상태가 유지되는지 브라우저 프로브로 확인.
// Usage: node scripts/qa-filter-chips.mjs  (dev server on 9173)
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:9175";
const SHOT = ".superpowers/sdd/qa-shots/filter-chips-items.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleLines = [];
page.on("console", (msg) => consoleLines.push(`[console.${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));

// expert 모드에서만 클래식 툴바(toolbar-database 포함)가 렌더된다.
await page.addInitScript(() => {
  try {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  } catch {}
});

async function openDatabaseModal() {
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 20_000 });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 10_000 });
}

async function goToItemsTab() {
  await page.getByTestId("db-tab-items").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("db-tab-items").click();
  // 칩 행이 렌더될 때까지 대기.
  await page.getByTestId("db-filter-chip-all").waitFor({ state: "visible", timeout: 10_000 });
}

async function visibleRecordCount() {
  return page.evaluate(() => {
    const list = document.querySelector(".db-list");
    if (!list) return -1;
    // 활성 렌더 경로(갤러리 카드 또는 리스트 행)를 모두 센다.
    return list.querySelectorAll(".db-gallery-card, .db-list-row").length;
  });
}

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
  await openDatabaseModal();
  await goToItemsTab();

  const before = await visibleRecordCount();
  console.log(`VISIBLE_BEFORE=${before}`);

  // '무기' 칩 클릭 → 즉시 재렌더, 보이는 항목 수가 줄어야 한다.
  await page.getByTestId("db-filter-chip-weapon").click();
  const weaponActive = await page
    .getByTestId("db-filter-chip-weapon")
    .evaluate((el) => el.classList.contains("active"));
  const afterWeapon = await visibleRecordCount();
  console.log(`VISIBLE_AFTER_WEAPON=${afterWeapon}`);
  console.log(`WEAPON_CHIP_ACTIVE=${weaponActive}`);
  if (!weaponActive) throw new Error("QA FAIL: weapon chip not active after click");
  if (!(afterWeapon < before)) throw new Error(`QA FAIL: expected count drop ${before} -> ${afterWeapon}`);

  // '전체' 칩 클릭 → 전체 복원.
  await page.getByTestId("db-filter-chip-all").click();
  const allActive = await page
    .getByTestId("db-filter-chip-all")
    .evaluate((el) => el.classList.contains("active"));
  const afterAll = await visibleRecordCount();
  console.log(`VISIBLE_AFTER_ALL=${afterAll}`);
  console.log(`ALL_CHIP_ACTIVE=${allActive}`);
  if (!allActive) throw new Error("QA FAIL: all chip not active after click");
  if (afterAll !== before) throw new Error(`QA FAIL: expected restore to ${before}, got ${afterAll}`);

  // stale_state: '무기' 선택을 하드 리프레시(모달 재오픈) 후에도 유지해야 한다.
  await page.getByTestId("db-filter-chip-weapon").click();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await openDatabaseModal();
  await goToItemsTab();
  const persistedActive = await page
    .getByTestId("db-filter-chip-weapon")
    .evaluate((el) => el.classList.contains("active"));
  const persistedCount = await visibleRecordCount();
  console.log(`PERSISTED_WEAPON_ACTIVE=${persistedActive}`);
  console.log(`VISIBLE_AFTER_RELOAD=${persistedCount}`);
  if (!persistedActive) throw new Error("QA FAIL: weapon filter did not survive hard reload");
  if (!(persistedCount < before)) throw new Error(`QA FAIL: persisted filter count ${persistedCount} !< ${before}`);

  await page.screenshot({ path: SHOT, fullPage: false });
  console.log(`SHOT_SAVED=${SHOT}`);
  console.log("QA_PASS");
} finally {
  await browser.close();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(".omo/evidence/start-work/task-7/playwright-console.txt", consoleLines.join("\n") + "\n");
}
