/**
 * Author a small project "왕국의 유산" through the live editor UI only.
 * Usage: node scripts/author-kingdom-legacy.mjs
 * Expects: http://127.0.0.1:4173 (vite preview after build)
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:4173";
const OUT = "output/evidence/kingdom-legacy";
const TITLE = "왕국의 유산";
const MAP_NAME = "왕국 광장";
const MAP_W = 16;
const MAP_H = 12;

// EasyRPG combined-town indices used by the editor palette.
const TILE = {
  GRASS: 240,
  WATER: 120,
  PATH: 360,
  TREE: 290,
  FLOWERS: 288,
  WALL: 306,
  FLOOR: 342,
};

const NPCS = [
  {
    name: "기사 엘린",
    spriteId: "tex_easyrpg_charset_people1",
    speaker: "엘린",
    text: "왕국의 유산이 잠든 광장에 오신 걸 환영합니다. 남쪽 연못 쪽을 살펴보세요.",
    x: 5,
    y: 6,
  },
  {
    name: "학자 마르",
    spriteId: "tex_easyrpg_charset_people2",
    speaker: "마르",
    text: "옛 왕가의 문양이 길 한가운데에 새겨져 있어요. 타일을 따라가면 단서가 보입니다.",
    x: 10,
    y: 5,
  },
  {
    name: "상인 루나",
    spriteId: "tex_easyrpg_charset_people3",
    speaker: "루나",
    text: "여행자님, 이곳 물은 맑지만 밤에는 안개가 낀답니다. 조심히 거니세요.",
    x: 8,
    y: 8,
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  console.log("open editor…");
  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(800);
  // EditScene은 cursor-position 노드가 있으면 좌표를 갱신한다(상태바 프로브).
  await page.evaluate(() => {
    if (document.querySelector('[data-testid="cursor-position"]')) return;
    const span = document.createElement("span");
    span.dataset.testid = "cursor-position";
    span.hidden = true;
    document.body.appendChild(span);
  });

  // 프로젝트 > 새 프로젝트
  console.log("new project…");
  await page.getByTestId("menu-project").click();
  await page.getByTestId("menu-project-new").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "01-new-project.png") });

  // 새 맵 추가
  console.log("add map…");
  await page.getByTestId("map-add").click();
  await page.waitForTimeout(500);

  const mapId = await activeMapId(page);
  console.log("active map", mapId);

  // 맵 설정 모달 (컨텍스트 메뉴 → 맵 설정)
  // 맵 트리 행이 뷰 밖이면 메뉴가 scroll 이벤트로 즉시 닫히므로 먼저 스크롤한다.
  console.log("map props…");
  await openMapProperties(page, mapId);
  await page.getByTestId("map-name-input").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("map-name-input").fill(MAP_NAME);
  await page.getByTestId("map-name-input").dispatchEvent("change");
  await page.getByTestId("map-width-input").fill(String(MAP_W));
  await page.getByTestId("map-height-input").fill(String(MAP_H));
  await page.getByTestId("map-resize-apply").click();
  await page.waitForTimeout(300);
  // close properties subdialog (Escape on focused dialog or click close)
  const propsModal = page.getByTestId(`map-properties-modal-${mapId}`);
  if (await propsModal.isVisible().catch(() => false)) {
    await propsModal.locator(".event-subdialog-close").click().catch(async () => {
      await propsModal.click({ position: { x: 2, y: 2 } });
    });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);

  // 시작 맵으로 설정
  await page.getByTestId(`map-tree-node-${mapId}`).scrollIntoViewIfNeeded();
  await page.getByTestId(`map-set-start-${mapId}`).click({ force: true });
  await page.waitForTimeout(200);

  // 하위 레이어 + 잔디 채우기 (blank map already grass; re-fill for evidence)
  // 도구 그리드는 숨겨져 있고, 실제 보이는 도구는 rpg-maker-tile-toolbar.
  console.log("paint lower tiles…");
  await page.getByTestId("layer-lower").click();
  await page.getByTestId("rpg-maker-tool-fill").click();
  await selectChipsetTile(page, TILE.GRASS);
  const mapper = await buildTileMapper(page);
  await clickMappedTile(page, mapper, 8, 6);
  await page.waitForTimeout(200);

  // 길 타일 (가로·세로 십자)
  await page.getByTestId("rpg-maker-tool-pen").click();
  await selectChipsetTile(page, TILE.PATH);
  for (let x = 3; x <= 12; x += 1) await clickMappedTile(page, mapper, x, 6);
  for (let y = 3; y <= 9; y += 1) await clickMappedTile(page, mapper, 8, y);

  // 연못 (물)
  await selectChipsetTile(page, TILE.WATER);
  for (let y = 8; y <= 10; y += 1) {
    for (let x = 3; x <= 5; x += 1) await clickMappedTile(page, mapper, x, y);
  }

  // 작은 벽/바닥 단상
  await selectChipsetTile(page, TILE.FLOOR);
  for (let x = 10; x <= 13; x += 1) {
    for (let y = 3; y <= 5; y += 1) await clickMappedTile(page, mapper, x, y);
  }
  await selectChipsetTile(page, TILE.WALL);
  for (let x = 10; x <= 13; x += 1) await clickMappedTile(page, mapper, x, 2);

  // 상위 레이어: 꽃 / 나무 포인트
  console.log("paint upper tiles…");
  await page.getByTestId("layer-upper").click();
  await page.getByTestId("rpg-maker-tool-pen").click();
  await selectChipsetTile(page, TILE.FLOWERS);
  for (const [x, y] of [[6, 4], [7, 4], [9, 4]]) await clickMappedTile(page, mapper, x, y);
  await selectChipsetTile(page, TILE.TREE);
  for (const [x, y] of [[2, 3], [14, 3], [2, 9], [14, 9]]) await clickMappedTile(page, mapper, x, y);
  await page.screenshot({ path: path.join(OUT, "02-map-painted.png") });

  // 시작 위치: 선택 도구로 칸 고른 뒤 맵 설정에서 "선택 칸을 시작 위치로"
  console.log("set start position…");
  await page.getByTestId("layer-lower").click();
  await page.getByTestId("rpg-maker-tool-select").click();
  await clickMappedTile(page, mapper, 8, 10);
  await openMapProperties(page, mapId);
  await page.getByTestId("map-start-pos-button").click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);

  // 이벤트 레이어 + NPC (이벤트 레이어 전환 시 도구가 event로 바뀜)
  console.log("author NPCs…");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click({ force: true }).catch(() => {});

  for (const [index, npc] of NPCS.entries()) {
    console.log(`  npc ${npc.name} @ ${npc.x},${npc.y}`);
    await clickMappedTile(page, mapper, npc.x, npc.y, { dbl: true });
    await page.getByTestId("event-editor-modal").waitFor({ state: "visible", timeout: 15_000 });
    await page.getByTestId("event-page-name-input").fill(npc.name);
    await page.getByTestId("event-page-name-input").dispatchEvent("change");

    // 그래픽: 숨은 sprite input 대신 설정 다이얼로그 사용
    await page.getByTestId("event-page-graphic-set").click();
    await page.getByTestId("event-graphic-dialog").waitFor({ state: "visible", timeout: 10_000 });
    const resource = page.getByTestId(`event-graphic-resource-${npc.spriteId}`);
    await resource.scrollIntoViewIfNeeded();
    await resource.click();
    await page.getByTestId("event-graphic-confirm").click();
    await page.getByTestId("event-graphic-dialog").waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});

    await page.getByTestId("event-command-empty-line").last().dblclick();
    const picker = page.getByTestId("event-command-picker");
    await picker.waitFor({ state: "visible" });
    await picker.getByTestId("command-picker-add-text").click();

    // 전용 「문장 표시」 창을 먼저 보던 분기는 삭제했다 — 그 창(textCommandDialog)은 프로덕션
    // 호출부가 없어 모듈째로 지웠고, 아래 공용 편집창이 실제로 열리는 유일한 경로다.
    const edit = page.getByTestId("event-command-edit-dialog").last();
    await edit.locator("input").first().fill(npc.speaker);
    await edit.locator("textarea").first().fill(npc.text);
    await edit.locator("textarea").first().dispatchEvent("change");
    await edit.getByTestId("event-command-edit-ok").click();

    await page.getByTestId("event-editor-ok").click();
    await page.getByTestId("event-editor-modal").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `03-npc-${index + 1}-${npc.name}.png`) });
  }

  // 데이터베이스 > 시스템 > 게임 타이틀
  console.log("set game title…");
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-system").click();
  const titleField = page.getByTestId("db-field-title-screen-title");
  await titleField.waitFor({ state: "visible" });
  await titleField.fill(TITLE);
  await titleField.dispatchEvent("change");
  await page.screenshot({ path: path.join(OUT, "04-database-title.png") });
  // Database footer: Apply / OK / close
  for (const id of ["database-footer-apply", "database-footer-ok", "database-modal-close"]) {
    const btn = page.getByTestId(id);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(200);
    }
  }
  // ensure modal closed
  if (await page.getByTestId("database-modal").isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);

  // 저장
  console.log("save…");
  await page.getByTestId("toolbar-save").click();
  await page.waitForTimeout(500);

  // 프로젝트 상태 덤프
  const state = await readProjectExport(page);
  const authoredMapId = state.editor?.currentMapId ?? state.project.startMapId;
  const map = state.project.maps[authoredMapId];
  const summary = {
    titleScreen: state.project.system?.titleScreen?.title,
    metaTitle: state.project.meta?.title,
    startMapId: state.project.startMapId,
    startPos: state.project.startPos,
    map: {
      id: authoredMapId,
      name: map?.name,
      width: map?.width,
      height: map?.height,
      eventCount: map?.events?.length ?? 0,
      events: (map?.events ?? []).map((ev) => ({
        id: ev.id,
        x: ev.x,
        y: ev.y,
        name: ev.pages?.[0]?.name,
        commands: (ev.pages?.[0]?.commands ?? []).map((c) => c.kind),
      })),
      lowerTileHistogram: topTiles(map?.lowerTiles ?? [], 8),
      upperNonEmpty: countNonEmpty(map?.upperTiles ?? []),
    },
  };
  await writeFile(path.join(OUT, "project-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path.join(OUT, "project-export.json"), `${JSON.stringify(state.project, null, 2)}\n`, "utf8");
  await page.screenshot({ path: path.join(OUT, "05-editor-final.png"), fullPage: true });

  // 플레이 스모크: 시작 맵에 NPC 대사
  console.log("play smoke…");
  await page.getByTestId("mode-play").click();
  const newGame = page.getByTestId("title-new-game");
  if (await newGame.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newGame.click();
  }
  await page.getByTestId("play-canvas").waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "06-play-start.png") });

  console.log("summary:", JSON.stringify(summary, null, 2));
  if (!map || map.name !== MAP_NAME) {
    throw new Error(`map name expected ${MAP_NAME}, got ${map?.name}`);
  }
  if ((map.events?.length ?? 0) < NPCS.length) {
    throw new Error(`expected >= ${NPCS.length} events, got ${map.events?.length}`);
  }
  if (state.project.system?.titleScreen?.title !== TITLE) {
    console.warn("title screen title mismatch:", state.project.system?.titleScreen?.title);
  }

  await browser.close();
  console.log(`done → ${OUT}`);
}

async function activeMapId(page) {
  const testid = await page.locator(".map-item.active").getAttribute("data-testid");
  if (!testid?.startsWith("map-tree-node-")) throw new Error("no active map tree node");
  return testid.slice("map-tree-node-".length);
}

async function openMapProperties(page, mapId) {
  const row = page.getByTestId(`map-tree-node-${mapId}`);
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const trigger = page.getByTestId(`map-context-trigger-${mapId}`);
  await trigger.scrollIntoViewIfNeeded();
  const box = await trigger.boundingBox();
  if (!box) throw new Error("map context trigger not on screen");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const settings = page.getByTestId(`map-settings-${mapId}`);
  await settings.waitFor({ state: "visible", timeout: 5_000 });
  await settings.click({ force: true });
}

function topTiles(tiles, n) {
  const counts = new Map();
  for (const t of tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tile, count]) => ({ tile, count }));
}

function countNonEmpty(tiles) {
  return tiles.filter((t) => t !== undefined && t !== null && t !== -1).length;
}

async function readProjectExport(page) {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project-export-json");
  return JSON.parse(text);
}

async function selectChipsetTile(page, tileIndex) {
  const tile = page.getByTestId(`chipset-tile-${tileIndex}`);
  if (await tile.count()) {
    await tile.first().scrollIntoViewIfNeeded();
    await tile.first().click();
    return;
  }
  // band buttons may hide some tiles; try common bands then fallback
  for (const band of ["a1", "a2", "a3", "a4", "a5", "b", "c", "d", "e"]) {
    const btn = page.getByTestId(`chipset-band-${band}`);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      if (await tile.count()) {
        await tile.first().scrollIntoViewIfNeeded();
        await tile.first().click();
        return;
      }
    }
  }
  throw new Error(`chipset tile ${tileIndex} not found`);
}

async function buildTileMapper(page) {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  const samples = [];
  const steps = 10;
  for (let iy = 0; iy <= steps; iy += 1) {
    for (let ix = 0; ix <= steps; ix += 1) {
      const px = Math.floor((box.width * ix) / steps);
      const py = Math.floor((box.height * iy) / steps);
      await page.mouse.move(box.x + px, box.y + py);
      const cursor = await page.getByTestId("cursor-position").textContent();
      const m = cursor?.match(/^(\d+),(\d+)$/);
      if (!m) continue;
      samples.push({ px, py, tx: Number(m[1]), ty: Number(m[2]) });
    }
  }
  if (samples.length < 4) throw new Error("could not sample map tiles from canvas");

  // Linear fit: px ≈ ox + sx * tx, py ≈ oy + sy * ty
  const byX = new Map();
  const byY = new Map();
  for (const s of samples) {
    if (!byX.has(s.tx)) byX.set(s.tx, []);
    if (!byY.has(s.ty)) byY.set(s.ty, []);
    byX.get(s.tx).push(s.px);
    byY.get(s.ty).push(s.py);
  }
  const xPts = [...byX.entries()].map(([tx, pxs]) => ({ t: tx, p: avg(pxs) }));
  const yPts = [...byY.entries()].map(([ty, pys]) => ({ t: ty, p: avg(pys) }));
  const xFit = fitLine(xPts);
  const yFit = fitLine(yPts);
  return { box, sx: xFit.s, ox: xFit.o, sy: yFit.s, oy: yFit.o, canvas };
}

function avg(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fitLine(pts) {
  if (pts.length < 2) return { s: 32, o: pts[0]?.p ?? 0 };
  const n = pts.length;
  let sumT = 0;
  let sumP = 0;
  let sumTT = 0;
  let sumTP = 0;
  for (const { t, p } of pts) {
    sumT += t;
    sumP += p;
    sumTT += t * t;
    sumTP += t * p;
  }
  const denom = n * sumTT - sumT * sumT;
  const s = denom === 0 ? 32 : (n * sumTP - sumT * sumP) / denom;
  const o = (sumP - s * sumT) / n;
  return { s, o };
}

async function clickMappedTile(page, mapper, tileX, tileY, { dbl = false } = {}) {
  let px = Math.round(mapper.ox + mapper.sx * tileX);
  let py = Math.round(mapper.oy + mapper.sy * tileY);
  px = Math.min(mapper.box.width - 2, Math.max(1, px));
  py = Math.min(mapper.box.height - 2, Math.max(1, py));

  // Correct with cursor-position if off by a tile.
  await page.mouse.move(mapper.box.x + px, mapper.box.y + py);
  const cursor = await page.getByTestId("cursor-position").textContent();
  const m = cursor?.match(/^(\d+),(\d+)$/);
  if (m) {
    const tx = Number(m[1]);
    const ty = Number(m[2]);
    if (tx !== tileX || ty !== tileY) {
      px = Math.min(mapper.box.width - 2, Math.max(1, Math.round(px + (tileX - tx) * mapper.sx)));
      py = Math.min(mapper.box.height - 2, Math.max(1, Math.round(py + (tileY - ty) * mapper.sy)));
    }
  }

  const clickPos = { x: px, y: py };
  if (dbl) await mapper.canvas.dblclick({ position: clickPos });
  else await mapper.canvas.click({ position: clickPos });
  await page.waitForTimeout(20);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
