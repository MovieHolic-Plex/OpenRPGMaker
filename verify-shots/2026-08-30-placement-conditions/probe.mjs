// 배치 조건(placement condition) 기능 실측 스크린샷.
// 사용법: node /tmp/shot-placement/probe.mjs   (dev 서버는 9247 에 이미 떠 있어야 한다)
import { chromium } from "/home/main/.herdr/worktrees/rpg-zzu/2/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:9247";
const OUT = "/tmp/shot-placement/shots";
mkdirSync(OUT, { recursive: true });

const log = (...args) => console.log("[probe]", ...args);

async function shot(page, name, target) {
  const path = `${OUT}/${name}.png`;
  if (target) await target.screenshot({ path });
  else await page.screenshot({ path });
  log("shot", name);
}


/** 사이드바는 아코디언 — 접힌 그룹의 탭은 그룹을 먼저 펼쳐야 눌린다. */
async function switchTab(page, testid) {
  const button = page.getByTestId(testid);
  if (!(await button.isVisible().catch(() => false))) {
    const groups = page.locator('[data-testid^="db-tab-group-"]');
    const total = await groups.count();
    for (let index = 0; index < total; index += 1) {
      await groups.nth(index).click();
      if (await button.isVisible().catch(() => false)) break;
    }
  }
  await button.click({ force: true });
}


/** 모달을 확실히 닫는다 — 더티 확인줄까지 처리하고, 닫힐 때까지 최대 3번 시도한다. */
async function closeDatabase(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await page.getByTestId("database-modal").count()) === 0) return;
    const close = page.getByTestId("database-close");
    if ((await close.count()) > 0) await close.click({ force: true }).catch(() => {});
    else await page.keyboard.press("Escape");
    const dirtySave = page.getByTestId("database-dirty-save");
    if (await dirtySave.isVisible().catch(() => false)) await dirtySave.click({ force: true });
    await page.getByTestId("database-modal").waitFor({ state: "detached", timeout: 8_000 }).catch(() => {});
  }
  log("모달이 안 닫힌다:", await page.getByTestId("database-modal").count());
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (message) => {
  if (message.type() === "error") log("console.error:", message.text().slice(0, 200));
});
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await page.goto(`${BASE}/?freshProject=1`);
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
const skip = page.getByTestId("coach-mark-skip");
if (await skip.isVisible().catch(() => false)) await skip.click();
log("app booted");

// ── 1. 타일셋 지식 인스펙터의 «배치 면» ──────────────────────────────────────
await page.getByTestId("menu-tools").click();
await page.getByTestId("menu-tools-database").click();
await switchTab(page, "db-tab-tilesets");
await page.getByTestId("tileset-section-tab-knowledge").click();
await page.getByTestId("tileset-edit-mode-group").click();
if (await skip.isVisible().catch(() => false)) await skip.click();
await page.getByTestId("tileset-knowledge-inspector").waitFor({ state: "visible" });

// 타일 두 칸을 세로로 끌어 선택한다(화덕처럼 1×2 인 물건).
const columns = await page.getByTestId("project-export-json").evaluate((element) => {
  const parsed = JSON.parse(element.textContent ?? "{}");
  const tilesets = parsed.project?.tilesets ?? {};
  const first = Object.values(tilesets)[0] ?? {};
  return first.tilesPerRow ?? 0;
});
log("tilesPerRow", columns);
const topCell = page.getByTestId("tileset-db-cell-21");
const bottomCell = page.getByTestId(`tileset-db-cell-${21 + columns}`);
// 칸을 먼저 화면 안으로 넣어야 boundingBox 가 실제 클릭 좌표와 같아진다.
await topCell.scrollIntoViewIfNeeded();
await bottomCell.scrollIntoViewIfNeeded();
const from = await topCell.boundingBox();
const to = await bottomCell.boundingBox();
await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
await page.mouse.down();
await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
await page.mouse.up();
log("selection:", await page.getByTestId("tileset-knowledge-selection-summary").textContent().catch(() => "(없음)"));
await page.getByTestId("tileset-knowledge-name").fill("화덕 오븐");
await page.getByTestId("tileset-knowledge-surface").scrollIntoViewIfNeeded();
await shot(page, "10-knowledge-surface-default", page.getByTestId("tileset-knowledge-inspector"));

await page.getByTestId("tileset-knowledge-surface-zone").selectOption("againstWall");
await page.getByTestId("tileset-knowledge-surface-facing").selectOption("north");
await page.getByTestId("tileset-knowledge-surface-strength").selectOption("hard");
await page.getByTestId("tileset-knowledge-surface").scrollIntoViewIfNeeded();
{
  const box = await page.getByTestId("tileset-knowledge-surface").boundingBox();
  await page.screenshot({
    path: `${OUT}/11-knowledge-surface-against-wall.png`,
    clip: { x: box.x - 12, y: box.y - 12, width: box.width + 24, height: box.height + 24 },
  });
}
await shot(page, "12-knowledge-surface-zoom", page.getByTestId("tileset-knowledge-surface"));
log("surface preview:", await page.getByTestId("tileset-knowledge-surface-preview").textContent());

await page.getByTestId("tileset-group-save").click();
const savedRule = await page.getByTestId("project-export-json").evaluate((element) => {
  const parsed = JSON.parse(element.textContent ?? "{}");
  const tilesets = Object.values(parsed.project?.tilesets ?? {});
  for (const tileset of tilesets) {
    for (const group of tileset.tileGroups ?? []) {
      const rule = (group.rules ?? []).find((entry) => entry.kind === "surface");
      if (rule) return { group: group.name, rule };
    }
  }
  return null;
});
log("saved surface rule:", JSON.stringify(savedRule));
await shot(page, "13-knowledge-saved", page.getByTestId("tileset-knowledge-inspector"));

// ── 2. 구조물 편집기의 «배치 조건» ───────────────────────────────────────────
await switchTab(page, "db-tab-structure-kits");
await page.getByTestId("structure-kit-heading").waitFor({ state: "visible" });
await shot(page, "20-structure-tab", null);

await page.getByTestId("structure-kit-new").click();
const blank = page.getByTestId("structure-kit-new-blank");
if (await blank.isVisible().catch(() => false)) await blank.click();
await page.getByTestId("structure-kit-editor").waitFor({ state: "visible", timeout: 20_000 });

// 타일 한 칸을 칠해 빈 구조물이 아니게 한다.
await page.getByTestId("structure-kit-editor-tile-240").click();
const canvas = await page.getByTestId("structure-kit-editor-canvas").boundingBox();
await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
await shot(page, "21-editor-shape", null);

await page.getByTestId("structure-kit-editor-tab-ai").click();
await page.getByTestId("structure-kit-editor-conditions").scrollIntoViewIfNeeded();
await shot(page, "22-editor-ai-tab-no-condition", null);
await shot(page, "23-conditions-empty", page.getByTestId("structure-kit-editor-conditions"));

await page.getByTestId("structure-kit-editor-condition-add").click();
await page.getByTestId("structure-kit-editor-condition-row").first().waitFor({ state: "visible" });
await shot(page, "24-conditions-added", page.getByTestId("structure-kit-editor-conditions"));
await shot(page, "25-editor-ai-tab-with-condition", null);

// 배치 면을 바꾸면 방향 드롭다운이 사라진다(방향은 «벽에 붙은 바닥»에서만 뜻이 있다).
await page.getByTestId("structure-kit-editor-condition-zone").first().selectOption("wallFace");
await shot(page, "26-conditions-wallface-no-facing", page.getByTestId("structure-kit-editor-conditions"));
await page.getByTestId("structure-kit-editor-condition-zone").first().selectOption("againstWall");
await page.getByTestId("structure-kit-editor-condition-facing").first().selectOption("north");

await page.getByTestId("structure-kit-editor-ai-accept").click();
await shot(page, "27-conditions-accepted", null);
const kitJson = await page.getByTestId("project-export-json").evaluate((element) => {
  const parsed = JSON.parse(element.textContent ?? "{}");
  for (const tileset of Object.values(parsed.project?.tilesets ?? {})) {
    for (const kit of tileset.structureKits ?? []) {
      if ((kit.ai?.placement ?? []).length > 0) return { id: kit.id, name: kit.name, placement: kit.ai.placement };
    }
  }
  return null;
});
log("saved kit placement:", JSON.stringify(kitJson));

await page.getByTestId("structure-kit-editor-close").click();
await page.getByTestId("structure-kit-editor").waitFor({ state: "detached" }).catch(() => {});
await shot(page, "28-inspector-after-accept", null);

// ── 3. 맵에서 실제로 막히는지 ────────────────────────────────────────────────
if (kitJson) {
  const useButton = page.getByTestId(`structure-kit-db-use-${kitJson.id}`);
  if ((await useButton.count()) > 0) await useButton.click();
  else await page.getByRole("button", { name: "팔레트에서 쓰기" }).first().click();
}
// DB 모달을 닫는다. 바뀐 내용이 있으면 «저장하고 닫기» 확인줄이 먼저 뜬다 —
// 이걸 안 누르면 모달이 그대로 남아 이어지는 맵 클릭이 전부 모달에 먹힌다.
await closeDatabase(page);
log("모달 남아 있나:", await page.getByTestId("database-modal").count());
await page.getByTestId("edit-canvas").waitFor({ state: "visible" });
await shot(page, "30-palette-armed", null);


/** 현재 맵의 타일 배열 지문 — 클릭이 실제로 칸을 바꿨는지 센다. */
async function mapTiles(page) {
  return page.getByTestId("project-export-json").evaluate((element) => {
    const parsed = JSON.parse(element.textContent ?? "{}");
    const project = parsed.project ?? {};
    const map = project.maps?.[project.startMapId] ?? Object.values(project.maps ?? {})[0];
    return { lower: map?.lowerTiles ?? [], upper: map?.upperTiles ?? [], width: map?.width ?? 0 };
  });
}

function changedCells(before, after) {
  const width = after.width ?? before.width ?? 0;
  const hits = [];
  for (let index = 0; index < before.lower.length; index += 1) {
    if (before.lower[index] !== after.lower[index] || before.upper[index] !== after.upper[index]) {
      if (hits.length < 12 && width > 0) hits.push(`${index % width},${Math.floor(index / width)}`);
    }
  }
  let changed = 0;
  for (let index = 0; index < before.lower.length; index += 1) {
    if (before.lower[index] !== after.lower[index] || before.upper[index] !== after.upper[index]) changed += 1;
  }
  return `${changed}칸 ${hits.length > 0 ? `(${hits.join(" ")})` : ""}`;
}

// AI 어시스턴트 패널이 캔버스를 덮으면 스크린샷에서 클릭 자리가 안 보인다 — 접는다.
const collapse = page.getByTestId("ai-collapse");
if (await collapse.isVisible().catch(() => false)) await collapse.click().catch(() => {});
await page.waitForTimeout(400);
const canvasBox = await page.getByTestId("edit-canvas").boundingBox();
const stack = page.getByTestId("toast");

// 팔레트 선택 토스트가 사라질 때까지 기다린다 — 그러지 않으면 거부 토스트와 헷갈린다.
await page.waitForTimeout(2600);

// (A) 방 가운데 — 위쪽이 벽이 아닌 자리 → hard 조건 위반이라 **거부**되어야 한다.
const beforeMiddle = await mapTiles(page);
await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
// 토스트에는 페이드인이 있다 — 클릭 직후 120ms 에 찍으면 상자는 있는데 화면에는 아무것도
// 없다(실측: 상자 440,828 560×56 인데 그 자리에 맵만 찍혔다). 0.5초 기다린 뒤 찍는다.
// 토스트는 2초 뒤 사라진다. mapTiles(프로젝트 JSON 파싱)를 먼저 부르면 그 사이에 꺼져서
// 스크린샷에 남지 않는다 — 찍기부터 하고 데이터 대조는 뒤로 미룬다.
// 전체 화면 촬영은 이 앱에서 1~3초가 걸린다(1440×900 + Phaser 캔버스). error 토스트 수명이
// 4초라 전체를 먼저 찍으면 잘라 찍을 때는 이미 꺼져 있다 — 잘라 찍기를 먼저 한다.
await page.getByTestId("toast").screenshot({ path: `${OUT}/32b-toast-element.png` }).catch((error) => log("요소 촬영 실패:", error.message));
log("스크롤:", JSON.stringify(await page.evaluate(() => ({
  scrollY: window.scrollY, docH: document.documentElement.scrollHeight, innerH: window.innerHeight,
  bodyH: document.body.scrollHeight, dpr: window.devicePixelRatio,
}))));
{
  const box = await page.getByTestId("toast").boundingBox().catch(() => null);
  log("토스트 상자:", JSON.stringify(box));
  log("토스트 진단:", JSON.stringify(await page.getByTestId("toast").evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      opacity: style.opacity, animation: style.animationName, transform: style.transform,
      zIndex: style.zIndex, position: style.position, visibility: style.visibility,
      parentOpacity: node.parentElement ? getComputedStyle(node.parentElement).opacity : null,
      hit: hit ? `${hit.tagName}.${hit.className}`.slice(0, 60) : null,
      text: (node.textContent ?? "").slice(0, 30),
    };
  })));
  if (box) {
    await page.screenshot({
      path: `${OUT}/32-refused-toast.png`,
      clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(1440, box.width + 20), height: box.height + 20 },
    });
    log("shot 32-refused-toast");
  }
}
await shot(page, "31-refused-full", null);
log("가운데 클릭 토스트:", await page.getByTestId("toast").textContent().catch(() => "(없음)"));
const afterMiddle = await mapTiles(page);
log("가운데 클릭 — 바뀐 칸:", changedCells(beforeMiddle, afterMiddle));

// (B) 같은 자리, 조건만 «권장(soft)» 으로 바꾼다 → 막지 않고 경고만 남기고 찍힌다.
// 자리를 바꾸지 않으므로 "막은 것은 조건이지 다른 무엇이 아니다" 가 증명된다.
await page.getByTestId("menu-tools").click();
await page.getByTestId("menu-tools-database").click();
await switchTab(page, "db-tab-structure-kits");
await page.getByTestId(`structure-kit-row-edit-${kitJson.id}`).click({ force: true });
await page.getByTestId("structure-kit-editor").waitFor({ state: "visible", timeout: 20_000 });
await page.getByTestId("structure-kit-editor-tab-ai").click();
await page.getByTestId("structure-kit-editor-condition-strength").first().selectOption("soft");
await shot(page, "40-condition-soft", page.getByTestId("structure-kit-editor-conditions"));
await page.getByTestId("structure-kit-editor-ai-accept").click();
await page.getByTestId("structure-kit-editor-close").click();
await page.getByTestId("structure-kit-editor").waitFor({ state: "detached" }).catch(() => {});
// 인스펙터가 내 킷을 보고 있어야 [팔레트에서 쓰기] 버튼이 그 킷 것이다.
await page.getByTestId(`structure-kit-db-${kitJson.id}`).click({ force: true });
await page.getByTestId(`structure-kit-db-use-${kitJson.id}`).click({ force: true });
await closeDatabase(page);
log("모달 남아 있나(2):", await page.getByTestId("database-modal").count());
await page.getByTestId("edit-canvas").waitFor({ state: "visible" });
await page.waitForTimeout(2600);

const cx = canvasBox.x + canvasBox.width / 2;
const cy = canvasBox.y + canvasBox.height / 2;
const clip = { x: cx - 160, y: cy - 160, width: 320, height: 320 };
await page.screenshot({ path: `${OUT}/43-spot-before.png`, clip });
const beforeSoft = await mapTiles(page);
await page.mouse.click(cx, cy);
await page.waitForTimeout(500);
await page.getByTestId("toast").screenshot({ path: `${OUT}/42b-toast-element.png` }).catch((error) => log("요소 촬영 실패:", error.message));
{
  const box = await page.getByTestId("toast").boundingBox().catch(() => null);
  if (box) {
    await page.screenshot({
      path: `${OUT}/42-soft-painted-toast.png`,
      clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: Math.min(1440, box.width + 20), height: box.height + 20 },
    });
    log("shot 42-soft-painted-toast");
  }
}
await shot(page, "41-soft-painted-full", null);
log("soft 토스트:", await page.getByTestId("toast").textContent().catch(() => "(없음)"));
const afterSoft = await mapTiles(page);
log("soft 클릭 — 바뀐 칸:", changedCells(beforeSoft, afterSoft));
await page.screenshot({ path: `${OUT}/44-spot-after.png`, clip });
log("바뀐 타일 예:", JSON.stringify({
  before: beforeSoft.lower.slice(50 * beforeSoft.width + 49, 50 * beforeSoft.width + 52),
  after: afterSoft.lower.slice(50 * afterSoft.width + 49, 50 * afterSoft.width + 52),
}));

await browser.close();
log("done");
