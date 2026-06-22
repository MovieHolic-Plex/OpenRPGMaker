import { expect, test, type Page } from "@playwright/test";

type DebugState = {
  project: {
    startMapId: string;
    startPos: { x: number; y: number };
    maps: Record<string, { width: number; height: number; lowerTiles: number[]; upperTiles: number[]; events: { commands: { kind: string; mapId?: string; x?: number; y?: number }[] }[] }>;
    tilesets: Record<string, { passability: { up: boolean; down: boolean; left: boolean; right: boolean }[]; terrain: number[] }>;
  };
  editor: {
    currentMapId: string | null;
    selection: { mapId: string; x: number; y: number; width: number; height: number } | null;
    clipboard: { layer: "lower" | "upper"; width: number; height: number; tiles: number[] } | null;
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.click({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function clickMapOffset(page: Page, dxTiles: number, dyTiles: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.click({
    position: {
      x: Math.floor(box.width / 2 + dxTiles * 32),
      y: Math.floor(box.height / 2 + dyTiles * 32),
    },
  });
}

function countTiles(tiles: number[], tile: number): number {
  return tiles.filter((value) => value === tile).length;
}

test("map editor paints, fills, selects, copies, pastes, edits passability, and undoes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("tool-select")).toBeVisible();
  await expect(page.getByTestId("undo-button")).toBeVisible();
  await expect(page.getByTestId("redo-button")).toBeVisible();
  await expect(page.getByTestId("copy-button")).toBeVisible();
  await expect(page.getByTestId("paste-button")).toBeVisible();

  const beforeFill = await debugState(page);
  const mapId = beforeFill.project.startMapId;
  const beforeSand = countTiles(beforeFill.project.maps[mapId].lowerTiles, 5);

  await page.getByTestId("tile-cell-5").click();
  await page.getByTestId("terrain-tag-input").fill("7");
  await page.getByTestId("terrain-tag-apply").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.tilesets.tiles_default.terrain[5];
  }).toBe(7);
  await page.getByTestId("tool-fill").click();
  await clickMapCenter(page);
  await expect.poll(async () => {
    const state = await debugState(page);
    return countTiles(state.project.maps[mapId].lowerTiles, 5);
  }).toBeGreaterThan(beforeSand);
  await page.screenshot({ path: testInfo.outputPath("map-fill.png"), fullPage: true });

  await page.getByTestId("undo-button").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    return countTiles(state.project.maps[mapId].lowerTiles, 5);
  }).toBe(beforeSand);
  await page.getByTestId("redo-button").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    return countTiles(state.project.maps[mapId].lowerTiles, 5);
  }).toBeGreaterThan(beforeSand);

  await page.getByTestId("tile-cell-1").click();
  await clickMapCenter(page);
  await page.getByTestId("tool-select").click();
  await clickMapCenter(page);
  await page.getByTestId("copy-button").click();
  await expect.poll(async () => (await debugState(page)).editor.clipboard?.tiles[0]).toBe(1);

  await clickMapOffset(page, 1, 0);
  await page.getByTestId("paste-button").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    const selection = state.editor.selection;
    if (!selection) return -999;
    const map = state.project.maps[mapId];
    return map.lowerTiles[selection.y * map.width + selection.x];
  }).toBe(1);

  const beforeUpperTree = countTiles((await debugState(page)).project.maps[mapId].upperTiles, 6);
  await page.getByTestId("layer-upper").click();
  await page.getByTestId("tile-cell-6").click();
  await clickMapOffset(page, 0, 1);
  await expect.poll(async () => {
    const state = await debugState(page);
    return countTiles(state.project.maps[mapId].upperTiles, 6);
  }).toBeGreaterThan(beforeUpperTree);

  const passabilityBefore = (await debugState(page)).project.tilesets.tiles_default.passability[6].up;
  await page.getByTestId("tool-collision").click();
  await clickMapOffset(page, 0, 1);
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.tilesets.tiles_default.passability[6].up;
  }).toBe(!passabilityBefore);

  await page.getByTestId("map-add").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    return Object.keys(state.project.maps).length;
  }).toBe(2);
  const twoMapState = await debugState(page);
  const interiorMapId = twoMapState.editor.currentMapId;
  if (!interiorMapId) throw new Error("new map was not selected");

  await page.getByTestId("map-width-input").fill("8");
  await page.getByTestId("map-height-input").fill("6");
  await page.getByTestId("map-resize-apply").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    const map = state.project.maps[interiorMapId];
    return `${map.width}x${map.height}`;
  }).toBe("8x6");

  await page.getByTestId("tool-select").click();
  await clickMapCenter(page);
  const selectedStart = (await debugState(page)).editor.selection;
  if (!selectedStart) throw new Error("missing start selection");
  await page.getByTestId("map-start-pos-button").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    return `${state.project.startMapId}:${state.project.startPos.x},${state.project.startPos.y}`;
  }).toBe(`${interiorMapId}:${selectedStart.x},${selectedStart.y}`);

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapOffset(page, -1, 0);
  await expect(page.getByTestId("event-command-kind-select")).toBeVisible();
  await page.getByTestId("event-command-kind-select").selectOption("transfer");
  await page.getByTestId("event-command-add").click();
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.maps[interiorMapId].events.some((event) =>
      event.commands.some((command) => command.kind === "transfer")
    );
  }).toBe(true);
  await page.getByTestId("transfer-map-select").last().evaluate((node, value) => {
    const select = node as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, mapId);
  await page.getByTestId("transfer-x-input").last().evaluate((node, value) => {
    const input = node as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, "8");
  await page.getByTestId("transfer-y-input").last().evaluate((node, value) => {
    const input = node as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, "7");
  await expect.poll(async () => {
    const state = await debugState(page);
    return state.project.maps[interiorMapId].events.some((event) =>
      event.commands.some((command) =>
        command.kind === "transfer" &&
        command.mapId === mapId &&
        command.x === 8 &&
        command.y === 7
      )
    );
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("map-selection-copy-paste.png"), fullPage: true });
});
