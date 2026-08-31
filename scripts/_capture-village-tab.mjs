// 임시 캡처 — 데이터베이스 「마을」탭 저작 흐름 스냅샷.
// 사용: DEV_SERVER_PORT=9433 node scripts/_capture-village-tab.mjs [outDir]
import { chromium } from "/home/main/z-project/rpg-zzu/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const PORT = process.env.DEV_SERVER_PORT ?? "9433";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.argv[2] ?? "reports/village-db-plan/img";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await gotoWithRetry(page, `${BASE}/?freshProject=1`);

await page.getByTestId("toolbar-database").click();
const modal = page.getByTestId("database-modal");
await modal.waitFor({ state: "visible" });

async function shot(name, loc) {
  await page.waitForTimeout(400);
  await (loc ?? modal).screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
}

async function openTab(slug, testid) {
  const header = page.getByTestId(`db-tab-group-${slug}`);
  if (await header.count()) {
    const tab = page.getByTestId(testid);
    if (!(await tab.isVisible().catch(() => false))) await header.click();
    await page.waitForTimeout(250);
  }
  await page.getByTestId(testid).click();
  await page.waitForTimeout(400);
}

async function fill(testid, value) {
  const node = page.getByTestId(testid);
  await node.fill(String(value));
  await node.blur().catch(() => {});
  await page.waitForTimeout(250);
}

async function select(testid, value) {
  await page.getByTestId(testid).selectOption(String(value));
  await page.waitForTimeout(250);
}

// 1. 레일에서 마을 탭이 세계 그룹에 보인다
await openTab("world", "db-tab-villages");
await shot("vt-01-empty");
const rail = modal.locator(".db-tabs").first();
if (await rail.count()) await shot("vt-02-rail", rail);

// 2. 형태 추가 — 규약 통과 상태로 시작
await page.getByTestId("db-village-create").click();
await shot("vt-03-template-new");

// 3. 이름·크기·재료 편집
await fill("db-village-template-name", "내 장옥");
await fill("db-village-template-w", "8");
await fill("db-village-template-h", "9");
await select("db-village-template-kit", "timber-hall");
await fill("db-village-template-note", "촌장 집으로 쓰는 넓은 장옥");
await shot("vt-04-template-edited");

// 4. 날개를 붙여 L 자로 만든다 — 격자 미리보기가 모양을 보여준다
await fill("db-village-wing-0-w", "8");
await fill("db-village-wing-0-h", "5");
await page.getByTestId("db-village-wing-add").click();
await page.waitForTimeout(300);
await fill("db-village-wing-1-x", "0");
await fill("db-village-wing-1-y", "5");
await fill("db-village-wing-1-w", "4");
await fill("db-village-wing-1-h", "4");
await shot("vt-05-wings-l-shape");
const wingCard = page.getByTestId("db-village-template-wings");
if (await wingCard.count()) await shot("vt-06-wing-card", wingCard);

// 5. 규약 위반은 화면이 말해 준다 (날개를 박스 밖으로)
await fill("db-village-wing-1-x", "6");
await shot("vt-07-template-invalid");
await fill("db-village-wing-1-x", "0");
await page.waitForTimeout(300);

// 5-1. 열이 짧아 지붕이 안 들어가는 형태 — 전에는 "통과" 라고 거짓말했다
await fill("db-village-wing-0-h", "4");
await fill("db-village-wing-1-y", "4");
await shot("vt-16-short-column");
await fill("db-village-wing-0-h", "5");
await fill("db-village-wing-1-y", "5");
await page.waitForTimeout(300);

// 6. 내장 형태 복제
await page.getByTestId("db-village-duplicate").click();
await page.waitForTimeout(300);
await fill("db-village-template-name", "내 오두막");
await select("db-village-import-source", "porch-cottage");
await page.getByTestId("db-village-import-apply").click();
await shot("vt-08-import-builtin");

// 7. 프리셋 만들기
await page.getByTestId("db-village-kind-preset").click();
await page.waitForTimeout(300);
await page.getByTestId("db-village-create").click();
await shot("vt-09-preset-new");

await fill("db-village-preset-name", "내 산골 마을");
await fill("db-village-preset-note", "산골 분위기, 넓은 흙길");
await fill("db-village-preset-house-count", "6");
await fill("db-village-preset-npc-count", "4");
await select("db-village-preset-path-style", "dirt");
await fill("db-village-preset-road-width", "3");
await fill("db-village-preset-road-naturalness", "0.9");
await select("db-village-preset-layout", "street-grid");
await select("db-village-preset-plaza-style", "garden");
await select("db-village-preset-plaza-layout", "north");
await select("db-village-preset-yard", "workshop");
await select("db-village-preset-edge-trees", "dense");
await shot("vt-10-preset-filled");

// 8. 형태 화이트리스트
await page.getByTestId("db-village-preset-pick-user").click();
await page.waitForTimeout(300);
await page.getByTestId("db-village-preset-template-rect-small").check().catch(() => {});
await page.waitForTimeout(300);
await shot("vt-11-preset-whitelist");
const picker = page.getByTestId("db-village-preset-templates");
if (await picker.count()) await shot("vt-12-whitelist-card", picker);

// 9. 목록 창 — 두 분류 칩과 개수
const listPane = page.getByTestId("db-village-list-pane");
if (await listPane.count()) await shot("vt-13-list-pane", listPane);
await page.getByTestId("db-village-kind-template").click();
await page.waitForTimeout(300);
if (await listPane.count()) await shot("vt-14-list-templates", listPane);

// 10. 통계 스트립 (시공 후보 수가 화이트리스트를 반영한다)
await page.getByTestId("db-village-kind-preset").click();
await page.waitForTimeout(300);
const stats = page.getByTestId("db-village-preset-stats");
if (await stats.count()) await shot("vt-15-preset-stats", stats);

await browser.close();
console.log("done");
