// 기본 아이템·장비 카탈로그의 실사용 증거를 편집기 화면에서 직접 찍는다.
//
// 왜 이 스크립트인가: 카운터 스크립트는 "코드가 몇 개를 반환하는가"만 증명한다.
// 사용자가 실제로 보는 것은 편집기 데이터베이스 화면의 목록이므로, 그 화면을 찍어야
// "아이템이 늘었다"가 관찰 가능한 사실이 된다.
//
// 사용:
//   DEV_SERVER_PORT=9841 node scripts/capture-item-catalog-evidence.mjs
//   (dev 서버가 이미 그 포트에 떠 있어야 한다)
//
// 출력: verify-shots/item-catalog/<이름>.png + manifest.json
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = process.env.DEV_SERVER_PORT ?? "9841";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = resolve(process.cwd(), process.env.SHOT_OUT ?? "verify-shots/item-catalog");

const ITEM_TYPE_LABELS = {
  normalGoods: "일반 물품",
  medicine: "약",
  book: "기술서",
  seed: "씨앗",
  special: "특수",
  switch: "스위치",
};

mkdirSync(OUT, { recursive: true });

const manifest = { base: BASE, capturedAt: new Date().toISOString(), shots: [] };

async function shot(target, name, note) {
  const path = resolve(OUT, `${name}.png`);
  await target.screenshot({ path });
  manifest.shots.push({ name, file: path, note });
  console.log(`[shot] ${name} → ${path}`);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("console", (message) => {
  if (message.type() === "error") console.log(`[page-error] ${message.text().slice(0, 200)}`);
});

try {
  // DB 툴바는 expert chrome 에서만 노출된다(test/e2e/oprn-database-items.spec.ts 와 동일 전제).
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded" });

  await page.getByTestId("toolbar-database").click({ timeout: 60_000 });
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-items-oprn-workbench").waitFor({ state: "visible", timeout: 30_000 });

  const modal = page.getByTestId("database-modal");
  await shot(modal, "01-items-tab-overview", "데이터베이스 → 아이템 탭. 왼쪽 목록이 기본 아이템 전체다.");

  // 실행 중인 편집기가 들고 있는 프로젝트를 그대로 읽는다(디버그 export 노드).
  // 코드 카운터와 교차 검증되는 값이라 화면과 코드가 어긋나면 바로 드러난다.
  const liveProject = async () => {
    const text = await page.getByTestId("project-export-json").textContent();
    if (!text) throw new Error("project-export-json 이 비어 있다");
    return JSON.parse(text).project;
  };
  const project = await liveProject();
  const countBy = (rows, key) => rows.reduce((acc, row) => {
    acc[row[key]] = (acc[row[key]] ?? 0) + 1;
    return acc;
  }, {});
  const perType = {
    itemTotal: project.database.items.length,
    byType: countBy(project.database.items, "type"),
    equipmentTotal: project.database.equipment.length,
    bySlot: countBy(project.database.equipment, "slot"),
  };
  manifest.perType = perType;
  console.log("[counts]", JSON.stringify(perType));

  const search = page.getByPlaceholder("레코드 검색");

  // 종류별 대표 레코드 한 장씩. 목록 행의 data-record-name 으로 실제 이름을 뽑아 검색한다.
  for (const [type, label] of Object.entries(ITEM_TYPE_LABELS)) {
    const rows = project.database.items.filter((row) => row.type === type);
    const name = rows.length > 0 ? rows[rows.length - 1].name : null;
    if (!name) {
      console.log(`[skip] ${type}: 레코드를 못 찾음`);
      continue;
    }
    await search.fill(name);
    const row = page.locator(`[data-testid^='db-record-row-'][data-record-name='${name.replace(/'/g, "\\'")}']`).first();
    await row.waitFor({ state: "visible", timeout: 15_000 });
    await row.click();
    await page.waitForTimeout(150);
    await shot(modal, `02-item-${type}`, `아이템 종류 "${label}" 의 레코드 예시: ${name}`);
  }
  await search.fill("");

  // 장비 탭
  await page.getByTestId("db-tab-equipment").click();
  await page.waitForTimeout(300);
  await shot(modal, "03-equipment-tab-overview", "데이터베이스 → 장비 탭. 무기·방패·갑옷·투구·장식 전체 목록.");

  for (const slot of ["shield", "armor", "helmet"]) {
    const rows = project.database.equipment.filter((row) => row.slot === slot);
    const name = rows.length > 0 ? rows[rows.length - 1].name : null;
    if (!name) {
      console.log(`[skip] ${slot}: 레코드를 못 찾음`);
      continue;
    }
    const equipSearch = page.getByPlaceholder("레코드 검색");
    await equipSearch.fill(name);
    const row = page.locator(`[data-testid^='db-record-row-'][data-record-name='${name.replace(/'/g, "\\'")}']`).first();
    await row.waitFor({ state: "visible", timeout: 15_000 });
    await row.click();
    await page.waitForTimeout(150);
    await shot(modal, `04-equipment-${slot}`, `장비 슬롯 "${slot}" 의 레코드 예시: ${name}`);
    await equipSearch.fill("");
  }

  // 아이템 추가 → 목록에 남는지
  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-items-oprn-workbench").waitFor({ state: "visible", timeout: 30_000 });
  const before = await page.locator("[data-testid^='db-record-row-']").count();
  await page.getByTestId("db-add-record").click();
  await page.waitForTimeout(400);
  const after = await page.locator("[data-testid^='db-record-row-']").count();
  manifest.addRecord = { before, after };
  console.log(`[add] rows ${before} → ${after}`);
  await shot(modal, "05-item-added", `+추가 직후. 목록 행 ${before} → ${after}, 새 레코드가 선택된 상태.`);

  // 이 세션은 원겍 저장이 꿬진 자리다. 그 사실을 화면이 말하는가를 찍는다.
  // 상태 칩은 모달 밖 톱바에 리상드되므로 패이지 전역을 받는다.
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, "06-session-not-persisted-page", "아이템 추가 후 화면 전역. 톱바에 저장 상태 칩이 뜼는지 본다.");
  const chip = page.getByTestId("db-autosave-state");
  const chipText = (await chip.count()) > 0 ? await chip.first().innerText().catch(() => null) : null;
  manifest.autoSaveChipText = chipText;
  console.log(`[chip] ${JSON.stringify(chipText)}`);
  if (chipText) await shot(chip.first(), "07-session-not-persisted-chip", `저장 상태 칩 본문: ${chipText}`);

  writeFileSync(resolve(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[done] ${manifest.shots.length} shots → ${OUT}`);
} finally {
  await browser.close();
}
