import { expect, test, type Page } from "@playwright/test";

type DebugState = {
  project: {
    startMapId: string;
    startPos: { x: number; y: number };
    maps: Record<string, {
      name: string;
      width: number;
      height: number;
      tilesetId: string;
      lowerTiles: number[];
      upperTiles: number[];
      lowerTileStacks?: Record<string, number[]>;
      upperTileStacks?: Record<string, number[]>;
      events: { commands: { kind: string; mapId?: string; x?: number; y?: number }[] }[];
    }>;
    tilesets: Record<string, { passability: { up: boolean; down: boolean; left: boolean; right: boolean }[]; terrain: number[] }>;
  };
  editor: {
    currentMapId: string | null;
    paintShape: "pen" | "rect" | "round";
    selection: { mapId: string; x: number; y: number; width: number; height: number } | null;
    clipboard: {
      width: number;
      height: number;
      lower: { tiles: number[]; stacks: number[][] };
      upper: { tiles: number[]; stacks: number[][] };
    } | null;
    tool: string;
    zoom: number;
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

function currentMap(state: DebugState): DebugState["project"]["maps"][string] {
  const mapId = state.editor.currentMapId ?? state.project.startMapId;
  const map = state.project.maps[mapId];
  if (!map) throw new Error(`missing current map ${mapId}`);
  return map;
}

type CanvasPoint = { readonly x: number; readonly y: number };

async function findVisibleMapPoint(page: Page, marginTiles = 2): Promise<CanvasPoint> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = currentMap(state);
  const fractions = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7];
  for (const fy of fractions) {
    for (const fx of fractions) {
      const x = Math.floor(box.width * fx);
      const y = Math.floor(box.height * fy);
      await page.mouse.move(Math.floor(box.x + x), Math.floor(box.y + y));
      const cursor = await page.getByTestId("cursor-position").textContent();
      const match = cursor?.match(/^(\d+),(\d+)$/);
      if (!match) continue;
      const tileX = Number(match[1]);
      const tileY = Number(match[2]);
      if (tileX < marginTiles || tileY < marginTiles) continue;
      if (tileX >= map.width - marginTiles || tileY >= map.height - marginTiles) continue;
      return { x, y };
    }
  }
  throw new Error("missing visible map point");
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const point = await findVisibleMapPoint(page);
  await canvas.dblclick({ position: point });
}

async function clickMapOffset(page: Page, dxTiles: number, dyTiles: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const point = await findVisibleMapPoint(page, 3);
  await canvas.click({
    position: {
      x: point.x + dxTiles * 32,
      y: point.y + dyTiles * 32,
    },
  });
}

async function dragMapFromVisiblePoint(page: Page, dxTiles: number, dyTiles: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const tileStep = 16 * state.editor.zoom;
  const point = await findVisibleMapPoint(page, 4);
  const start = { x: Math.floor(box.x + point.x), y: Math.floor(box.y + point.y) };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dxTiles * tileStep, start.y + dyTiles * tileStep, { steps: 6 });
  await page.mouse.up();
}

function countTiles(tiles: number[], tile: number): number {
  return tiles.filter((value) => value === tile).length;
}

function countStackTiles(stacks: Record<string, number[]> | undefined, tile: number): number {
  return Object.values(stacks ?? {}).reduce((total, stack) => total + countTiles(stack, tile), 0);
}

const FILL_TILE = 6;
const PAINT_TILE = 7;
const UPPER_TILE = 374;

test("map chipset picker changes only the active map", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapTilesetIsolation=1");

  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const before = await debugState(page);
  const startMapId = before.project.startMapId;
  const startMapName = before.project.maps[startMapId].name;
  await expect(page.getByLabel(`${startMapName} 칩셋`)).toBeVisible();

  await page.getByTestId("map-add").click();
  const addedState = await debugState(page);
  const addedMapId = addedState.editor.currentMapId;
  if (!addedMapId || addedMapId === startMapId) throw new Error("new map was not selected");
  const addedMapName = addedState.project.maps[addedMapId].name;
  await expect(page.getByLabel(`${addedMapName} 칩셋`)).toBeVisible();
  await page.getByTestId("map-tileset-select").selectOption("easyrpg_chipset_interior");
  await expect.poll(async () => (await debugState(page)).project.maps[addedMapId].tilesetId).toBe("easyrpg_chipset_interior");

  await page.getByTestId(`map-tree-node-${startMapId}`).click();
  await expect(page.getByLabel(`${startMapName} 칩셋`)).toBeVisible();
  await page.getByTestId("map-tileset-select").selectOption("easyrpg_chipset_dungeon");
  await expect.poll(async () => (await debugState(page)).project.maps[startMapId].tilesetId).toBe("easyrpg_chipset_dungeon");

  const afterStartMapChange = await debugState(page);
  expect(afterStartMapChange.project.maps[addedMapId].tilesetId).toBe("easyrpg_chipset_interior");

  await page.getByTestId(`map-tree-node-${addedMapId}`).click();
  await expect(page.getByLabel(`${addedMapName} 칩셋`)).toBeVisible();
  await expect(page.getByTestId("map-tileset-select")).toHaveValue("easyrpg_chipset_interior");
});

test("map editor paints, fills, selects, copies, pastes, edits passability, and persists after reload", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&m1MapEditor=1");

  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("tool-select")).toBeVisible();
  await expect(page.getByTestId("toolbar-undo")).toBeVisible();
  await expect(page.getByTestId("toolbar-redo")).toBeVisible();

  const beforeFill = await debugState(page);
  const beforeFillMap = currentMap(beforeFill);
  const beforeFillTileCount = countTiles(beforeFillMap.lowerTiles, FILL_TILE);

  await page.getByTestId(`chipset-tile-${FILL_TILE}`).click();
  await page.getByTestId("quick-tile-toggle").click();
  await expect(page.getByTestId("terrain-tag-input")).toBeVisible();
  await page.getByTestId("terrain-tag-input").fill("7");
  await page.getByTestId("terrain-tag-apply").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.tilesets[currentMap(state).tilesetId].terrain[FILL_TILE];
  }).toBe(7);
  await page.getByTestId("tool-fill").click();
  await clickMapCenter(page);
  await expect.poll(async () => {
    const state = await debugState(page);
    return countTiles(currentMap(state).lowerTiles, FILL_TILE);
  }).toBeGreaterThan(beforeFillTileCount);
  await page.screenshot({ path: testInfo.outputPath("map-fill.png"), fullPage: true });

  await page.keyboard.press("Control+Z");
  await expect.poll(async () => {
    const state = await debugState(page);
    return countTiles(currentMap(state).lowerTiles, FILL_TILE);
  }).toBe(beforeFillTileCount);
  await page.keyboard.press("Control+Y");
  await expect.poll(async () => {
    const state = await debugState(page);
    return countTiles(currentMap(state).lowerTiles, FILL_TILE);
  }).toBeGreaterThan(beforeFillTileCount);

  await page.getByTestId(`chipset-tile-${PAINT_TILE}`).click();
  await clickMapCenter(page);
  await page.getByTestId("tool-select").click();
  await clickMapCenter(page);
  await page.keyboard.press("Control+C");
  await expect.poll(async () => (await debugState(page)).editor.clipboard?.lower.tiles[0]).toBe(PAINT_TILE);

  await clickMapOffset(page, 1, 0);
  await page.keyboard.press("Control+V");
  await expect.poll(async () => {
    const state = await debugState(page);
    const selection = state.editor.selection;
    if (!selection) return -999;
    const map = currentMap(state);
    return map.lowerTiles[selection.y * map.width + selection.x];
  }).toBe(PAINT_TILE);

  const beforeUpperTree = countStackTiles(currentMap(await debugState(page)).upperTileStacks, UPPER_TILE);
  await page.getByTestId("layer-upper").click();
  await page.getByTestId("tool-paint").click();
  await page.getByTestId("chipset-band-a3").click();
  await page.getByTestId(`chipset-tile-${UPPER_TILE}`).click();
  await clickMapOffset(page, 0, 1);
  await expect.poll(async () => {
    const state = await debugState(page);
    return countStackTiles(currentMap(state).upperTileStacks, UPPER_TILE);
  }).toBeGreaterThan(beforeUpperTree);

  const passabilityBeforeState = await debugState(page);
  const passabilityBefore = passabilityBeforeState.project.tilesets[currentMap(passabilityBeforeState).tilesetId].passability[UPPER_TILE].up;
  await page.getByTestId("tool-collision").click();
  await clickMapOffset(page, 0, 1);
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.tilesets[currentMap(state).tilesetId].passability[UPPER_TILE].up;
  }).toBe(!passabilityBefore);

  const persistedAfterEdit = await debugState(page);
  const persistedUpperTreeCount = countStackTiles(currentMap(persistedAfterEdit).upperTileStacks, UPPER_TILE);
  const persistedPassability = persistedAfterEdit.project.tilesets[currentMap(persistedAfterEdit).tilesetId].passability[UPPER_TILE].up;
  await page.evaluate(() => window.history.replaceState(null, "", "/"));
  await page.getByTestId("toolbar-save").click();
  await expect(page.getByTestId("toast")).toContainText("저장됨");
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect.poll(async () => {
    const state = await debugState(page);
    return countStackTiles(currentMap(state).upperTileStacks, UPPER_TILE);
  }).toBe(persistedUpperTreeCount);
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.tilesets[currentMap(state).tilesetId].passability[UPPER_TILE].up;
  }).toBe(persistedPassability);

  await page.screenshot({ path: testInfo.outputPath("map-selection-copy-paste.png"), fullPage: true });
});

test("requested map toolbar controls drive select area, zoom, pen, rectangle, round terrain, fill, and undo", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&requestedToolbar=1");

  await expect(page.getByTestId("toolbar-undo")).toBeVisible();
  await expect(page.getByTestId("toolbar-select-area")).toBeVisible();
  await expect(page.getByTestId("toolbar-map-zoom")).toBeVisible();
  await expect(page.getByTestId("toolbar-pen")).toBeVisible();
  await expect(page.getByTestId("toolbar-rect-terrain")).toBeVisible();
  await expect(page.getByTestId("toolbar-round-terrain")).toBeVisible();
  await expect(page.getByTestId("toolbar-fill")).toBeVisible();

  const beforeZoom = (await debugState(page)).editor.zoom;
  await page.getByTestId("toolbar-map-zoom").click();
  await expect.poll(async () => (await debugState(page)).editor.zoom).not.toBe(beforeZoom);

  await page.getByTestId("toolbar-select-area").click();
  await dragMapFromVisiblePoint(page, 2, 1);
  await expect.poll(async () => {
    const selection = (await debugState(page)).editor.selection;
    return selection ? `${selection.width}x${selection.height}` : "none";
  }).toBe("3x2");

  await page.getByTestId(`chipset-tile-${PAINT_TILE}`).click();
  await page.getByTestId("toolbar-rect-terrain").click();
  const beforeRectCount = countTiles(currentMap(await debugState(page)).lowerTiles, PAINT_TILE);
  await dragMapFromVisiblePoint(page, 2, 1);
  await expect.poll(async () => countTiles(currentMap(await debugState(page)).lowerTiles, PAINT_TILE)).toBeGreaterThanOrEqual(beforeRectCount + 6);

  await page.getByTestId("toolbar-undo").click();
  await expect.poll(async () => countTiles(currentMap(await debugState(page)).lowerTiles, PAINT_TILE)).toBe(beforeRectCount);

  await page.getByTestId(`chipset-tile-${FILL_TILE}`).click();
  await page.getByTestId("toolbar-round-terrain").click();
  const beforeRoundCount = countTiles(currentMap(await debugState(page)).lowerTiles, FILL_TILE);
  await dragMapFromVisiblePoint(page, 4, 2);
  await expect.poll(async () => countTiles(currentMap(await debugState(page)).lowerTiles, FILL_TILE)).toBeGreaterThan(beforeRoundCount);

  await page.getByTestId("toolbar-pen").click();
  await expect.poll(async () => (await debugState(page)).editor.paintShape).toBe("pen");
  await expect.poll(async () => (await debugState(page)).editor.tool).toBe("paint");

  await page.getByTestId("toolbar-fill").click();
  await expect.poll(async () => (await debugState(page)).editor.tool).toBe("fill");

  await page.screenshot({ path: testInfo.outputPath("requested-toolbar-tools.png"), fullPage: true });
});
