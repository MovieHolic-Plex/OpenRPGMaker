// scripts/qa/combo-brush.mjs
// OPRN-OUT-022 Combo Brush — 실제 브라우저 증거. 모든 변경은 freshProject 지역 세션에만 남는다.
//
// 담는 장면(각각 PNG 하나):
//  01 selection        기본 리플로우 팔레트에서 사각 드래그 → 활성 조합 붓 + 합성 배지
//  02 hover-footprint  맵 호버가 발자국 전체를 보여준다
//  03 repeat           같은 붓으로 세 곳에 반복 배치
//  04 boundary         맵 오른쪽 끝 — 잘리는 칸이 미리보기에 보이고, 맵 밖은 거부된다
//  05 terrain-list     지형 도구 표면의 큐레이션 조합 목록(번호 입력 없음)
//
// 실행: node scripts/qa/combo-brush.mjs [--base-url http://127.0.0.1:9855] [--out <dir>] [--headed]

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = flag("base-url", "http://127.0.0.1:9855");
const outputDir = flag("out", "verify-shots/oprn-022");
const headed = args.includes("--headed");

const browser = await chromium.launch({ headless: !headed });
await mkdir(outputDir, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const results = [];
const errors = [];
page.on("pageerror", error => errors.push(error.message));

await page.addInitScript(() => {
  window.comboSceneReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("EditScene did not publish its coordinate hook")), 90_000);
    let worldToClient;
    Object.defineProperty(window, "__oprnEditWorldToClient", {
      configurable: true,
      get: () => worldToClient,
      set: value => { worldToClient = value; clearTimeout(timeout); resolve(); },
    });
  });
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
});

const shot = name => page.screenshot({ path: join(outputDir, `${name}.png`) });
const state = () => page.evaluate(() => window.comboQa.state.get());
const readMap = () => page.evaluate(() => {
  const { state, store } = window.comboQa;
  const map = store.getCurrent().maps[state.get().currentMapId];
  return { height: map.height, lower: [...map.lowerTiles], upper: [...map.upperTiles], width: map.width };
});
const point = (x, y) => page.evaluate(({ x, y }) => window.__oprnEditWorldToClient(x * 16 + 8, y * 16 + 8), { x, y });
const visibleAnchor = async () => {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() => {
    const view = window.__oprnEditVisibleArea().worldView;
    return { x: Math.floor((view.x + view.width * 0.2) / 16), y: Math.floor((view.y + view.height * 0.25) / 16) };
  });
};
const clickTile = async (x, y, options) => {
  const p = await point(x, y);
  await page.mouse.click(p.x, p.y, options);
};
const hoverTile = async (x, y) => {
  const p = await point(x, y);
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

/** 팔레트에서 표시 순서 기준 두 칸 사이를 실제 포인터로 끈다. */
const dragPaletteCells = async (fromTile, toTile) => {
  const from = page.locator(`[data-testid="tile-palette"] .chipset-tile[data-tile-index="${fromTile}"]`);
  const to = page.locator(`[data-testid="tile-palette"] .chipset-tile[data-tile-index="${toTile}"]`);
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  assert(a && b, `palette cells ${fromTile}/${toTile} must be laid out`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
};

const scenario = async (name, action) => {
  try {
    const observed = await action();
    await shot(name);
    results.push({ name, observed, screenshot: `${name}.png`, status: "PASS" });
  } catch (error) {
    await shot(name);
    results.push({ error: error.message, name, screenshot: `${name}.png`, status: "FAIL" });
  }
  console.log(`QA ${name}: ${results.at(-1).status}${results.at(-1).error ? ` — ${results.at(-1).error}` : ""}`);
};

try {
  await page.goto(`${baseUrl}/?freshProject=1`, { timeout: 90_000, waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 });
  await page.evaluate(() => window.comboSceneReady);
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const history = await import("/src/editor/mapEditHistory.ts");
    const combo = await import("/src/editor/comboBrush.ts");
    if (store.remotePersistenceEnabled !== false) throw new Error("QA requires remote persistence disabled");
    window.comboQa = { combo, history, state: editorState, store };
    store.update(project => {
      const map = project.maps[editorState.get().currentMapId];
      // 경계 장면을 실제로 눌러 보려면 맵의 오른쪽 끝이 화면에 있어야 한다.
      // 기본 맵은 100×100(1600px)이라 끝이 화면 밖이다 — QA 픽스처는 20×20 으로 줄인다.
      const width = 20;
      const height = 20;
      map.width = width;
      map.height = height;
      map.lowerTiles = new Array(width * height).fill(240);
      map.upperTiles = new Array(width * height).fill(-1);
      map.events = [];
      map.lowerTileStacks = {};
      map.upperTileStacks = {};
    }, { label: "Local combo brush QA fixture", origin: "system", scope: "project" });
    history.resetMapEditHistory();
  });

  // 표시 순서 = 조합 붓이 격자로 읽는 순서. 앞 8칸이 두 행을 채운다.
  const order = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="tile-palette"] .chipset-tile'))
      .map(cell => Number(cell.dataset.tileIndex)));

  await scenario("01-selection", async () => {
    await page.getByTestId("tool-paint").click();
    await dragPaletteCells(order[0], order[7]);
    const active = (await state()).activePaletteStamp;
    assert(active, "default palette drag must create an active combo brush");
    assert.equal(active.cells.length, 4, "2x2 drag must carry four cells");
    assert.deepEqual(active.cells.map(cell => cell.tile), [order[0], order[1], order[6], order[7]]);
    const badge = await page.getByTestId("tile-brush-state");
    const kind = await badge.getAttribute("data-brush-kind");
    assert.equal(kind, "combo", "sidebar must call this a composite combo brush");
    return { badge: (await badge.textContent()).trim(), brushKind: kind, cells: active.cells.map(cell => cell.tile),
      footprint: [active.width, active.height] };
  });

  const anchor = await visibleAnchor();

  await scenario("02-hover-footprint", async () => {
    await hoverTile(anchor.x, anchor.y);
    const active = (await state()).activePaletteStamp;
    const map = await readMap();
    const placement = await page.evaluate(({ bounds, stamp, x, y }) =>
      window.comboQa.combo.comboBrushPlacement({ bounds, stamp, x, y }),
      { bounds: { height: map.height, width: map.width }, stamp: active, x: anchor.x, y: anchor.y });
    assert.equal(placement.clippedCount, 0, "hover inside the map must not clip");
    assert.equal(placement.paintableCells.length, active.cells.length);
    return { anchor, previewCells: placement.cells.length, clipped: placement.clippedCount };
  });

  await scenario("03-repeat", async () => {
    const active = (await state()).activePaletteStamp;
    const origins = [[anchor.x, anchor.y], [anchor.x + 4, anchor.y], [anchor.x, anchor.y + 4]];
    for (const [x, y] of origins) await clickTile(x, y);
    const after = await readMap();
    for (const [x, y] of origins) {
      for (const cell of active.cells) {
        const index = (y + cell.dy) * after.width + x + cell.dx;
        const value = cell.layer === "upper" ? after.upper[index] : after.lower[index];
        assert.equal(value, cell.tile, `cell ${cell.tile} missing at ${x + cell.dx},${y + cell.dy}`);
      }
    }
    const stillActive = (await state()).activePaletteStamp;
    assert(stillActive, "combo brush must survive repeated placement");
    await hoverTile(anchor.x + 8, anchor.y + 8);
    return { origins, stillActive: stillActive.cells.length === active.cells.length };
  });

  await scenario("04-boundary", async () => {
    const map = await readMap();
    const active = (await state()).activePaletteStamp;
    // 맵 오른쪽 마지막 열에 원점을 두면 폭 2 조합의 오른쪽 열이 잘린다.
    // 그 칸이 실제로 화면에 보여야 포인터를 댈 수 있다 — 카메라를 그리로 옮긴다.
    const edgeX = map.width - 1;
    const edgeY = Math.min(map.height - 3, anchor.y + 6);
    const edgePoint = await point(edgeX, edgeY);
    assert(edgePoint.x > 330 && edgePoint.x < 1430 && edgePoint.y > 125 && edgePoint.y < 890,
      `map edge ${edgeX},${edgeY} must be on screen: ${JSON.stringify(edgePoint)}`);
    const clipped = await page.evaluate(({ bounds, stamp, x, y }) =>
      window.comboQa.combo.evaluateComboBrushPlacement({ bounds, stamp, x, y }),
      { bounds: { height: map.height, width: map.width }, stamp: active, x: edgeX, y: edgeY });
    assert.equal(clipped.ok, true, "edge placement must be allowed");
    assert(clipped.placement.clippedCount > 0, "edge placement must report clipped cells");
    await hoverTile(edgeX, edgeY);
    await shot("04-boundary-hover");
    await clickTile(edgeX, edgeY);
    const after = await readMap();
    for (const placed of clipped.placement.paintableCells) {
      const index = placed.y * after.width + placed.x;
      const value = placed.cell.layer === "upper" ? after.upper[index] : after.lower[index];
      assert.equal(value, placed.cell.tile, "in-bounds cells keep the source layout");
    }
    // 완전히 맵 밖 — 아무 칸도 쓰지 않고 진단만 나온다.
    const outside = await page.evaluate(({ bounds, stamp, x, y }) =>
      window.comboQa.combo.evaluateComboBrushPlacement({ bounds, stamp, x, y }),
      { bounds: { height: map.height, width: map.width }, stamp: active, x: map.width + 2, y: map.height + 2 });
    assert.equal(outside.ok, false);
    return { clippedCount: clipped.placement.clippedCount, diagnostic: outside.diagnostic.text,
      edge: [edgeX, edgeY], painted: clipped.placement.paintableCells.length };
  });

  await scenario("05-terrain-list", async () => {
    await page.getByTestId("sidebar-combo-brushes").click();
    const shelf = page.getByTestId("combo-brush-shelf");
    await shelf.waitFor({ state: "visible" });
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="combo-brush-combo_"]'))
        .map(node => node.querySelector(".combo-brush-cell-name")?.textContent ?? ""));
    assert(names.length >= 8, `curated list must be populated, saw ${names.length}`);
    const inputs = await shelf.locator("input").count();
    assert.equal(inputs, 0, "curated list must not require raw tile-number entry");
    await shot("05-terrain-list");
    // 목록에서 조합 하나를 고르면 그것이 곧 활성 조합 붓이 된다.
    await page.getByTestId("combo-brush-combo_tree_full").click();
    const active = (await state()).activePaletteStamp;
    assert.equal(active.origin, "curated");
    const badge = page.getByTestId("tile-brush-state");
    assert.equal(await badge.getAttribute("data-brush-kind"), "combo");
    return { badge: (await badge.textContent()).trim(), curated: names, label: active.label };
  });

  await scenario("06-curated-place", async () => {
    const active = (await state()).activePaletteStamp;
    const map = await readMap();
    const target = { x: Math.min(map.width - 2, anchor.x + 8), y: Math.min(map.height - 3, anchor.y + 2) };
    await clickTile(target.x, target.y);
    const after = await readMap();
    const placed = active.cells.map(cell => {
      const index = (target.y + cell.dy) * after.width + target.x + cell.dx;
      return cell.layer === "upper" ? after.upper[index] : after.lower[index];
    });
    assert.deepEqual(placed, active.cells.map(cell => cell.tile), "curated combination must place its exact pattern");
    return { label: active.label, placed, target };
  });
} finally {
  await writeFile(join(outputDir, "results.json"), JSON.stringify({ baseUrl, errors, results }, null, 2));
  await context.close();
  await browser.close();
}

const failed = results.filter(entry => entry.status === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} scenarios PASS · page errors: ${errors.length}`);
if (errors.length > 0) console.log(errors.join("\n"));
process.exitCode = failed.length > 0 ? 1 : 0;
