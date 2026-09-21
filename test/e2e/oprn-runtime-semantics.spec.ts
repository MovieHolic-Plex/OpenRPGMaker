import { expect, test, type Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

type SeedProject = Project;
type DebugState = {
  project: {
    startMapId: string;
    maps: Record<string, { lowerTiles: number[] }>;
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function seedProject(page: Page, project: SeedProject): Promise<void> {
  await seedProjectForEditor(page, project);
}

async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await runtimeTapKey(page, key, holdMs);
}

function makeRuntimeProject(): SeedProject {
  return {
    version: 3,
    meta: { title: "Runtime Semantics", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        tex_easyrpg_charset_people1: { id: "tex_easyrpg_charset_people1", image: { type: "bundled", id: "tex_easyrpg_charset_people1" }, frames: 8, frameWidth: 32, frameHeight: 32 },
      },
      uploaded: {},
    },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "Default tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: [
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
        ],
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    switches: [],
    variables: [],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_runtime: {
        id: "map_runtime",
        name: "Runtime",
        width: 2,
        height: 2,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: [0, 0, 1, 0],
        upperTiles: [-1, -1, -1, -1],
        events: [
          {
            id: "ev_change",
            x: 0,
            y: 1,
            sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page_change",
                name: "Change",
                conditions: [],
                graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [
                  { kind: "changeTile", mapId: "map_runtime", layer: "lower", x: 1, y: 0, tile: 5 },
                  { kind: "text", body: "changed" },
                ],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_runtime", children: [] },
    startMapId: "map_runtime",
    startPos: { x: 0, y: 0 },
    flags: {},
  };
}

test("runtime tile overrides do not mutate exported project maps", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, makeRuntimeProject());
  const before = await debugState(page);
  expect(before.project.maps.map_runtime.lowerTiles[1]).toBe(0);

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");
  await expect(page.getByTestId("dialogue-box")).toContainText("changed");
  await page.screenshot({ path: testInfo.outputPath("runtime-change-tile.png"), fullPage: true });

  await page.getByTestId("mode-edit").click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const after = await debugState(page);
  expect(after.project.maps.map_runtime.lowerTiles[1]).toBe(0);
});
