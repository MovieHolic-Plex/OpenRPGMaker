import { expect, test, type Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";

const PASSABLE = { up: true, down: true, left: true, right: true };

type ExportedEvent = {
  readonly id: string;
};

type ExportedMap = {
  readonly width: number;
  readonly height: number;
  readonly events: readonly ExportedEvent[];
};

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, ExportedMap>;
  };
};

async function seedProject(page: Page): Promise<void> {
  // Delete-key paths call window.confirm — auto-accept so the assertion is about deletion, not the dialog.
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await seedProjectForEditor(page, projectWithPlacedEvent());
}

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  const parsed: unknown = JSON.parse(text);
  if (!isDebugState(parsed)) throw new Error("project export has unexpected shape");
  return parsed;
}

async function clickMapTile(page: Page, x: number, y: number, clickCount: 1 | 2 = 1): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 32;
  const position = {
    x: Math.floor((box.width - map.width * tileSize) / 2) + x * tileSize + tileSize / 2,
    y: Math.floor((box.height - map.height * tileSize) / 2) + y * tileSize + tileSize / 2,
  };
  if (clickCount === 2) {
    await canvas.dblclick({ position });
    return;
  }
  await canvas.click({ position });
}

function projectWithPlacedEvent(): Project {
  return {
    version: 3,
    meta: { title: "Event Delete Key", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "Default tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: new Array(8).fill(PASSABLE),
        priority: new Array(8).fill("lower"),
        terrain: new Array(8).fill(0),
      },
    },
    switches: [],
    variables: [],
    commonEvents: [],
    database: {
      actors: [],
      classes: [],
      skills: [],
      items: [],
      equipment: [],
      enemies: [],
      troops: [],
      states: [],
      battleAnimations: [],
    },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_delete: {
        id: "map_delete",
        name: "Delete",
        width: 5,
        height: 4,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(20).fill(0),
        upperTiles: new Array<number>(20).fill(-1),
        events: [
          {
            id: "ev_delete",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page_delete",
                name: "Delete Target",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_delete", children: [] },
    startMapId: "map_delete",
    startPos: { x: 1, y: 1 },
    flags: {},
  } satisfies Project;
}

function isDebugState(value: unknown): value is DebugState {
  if (!isRecord(value)) return false;
  const project = value.project;
  if (!isRecord(project)) return false;
  return typeof project.startMapId === "string" && isRecord(project.maps);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

test("event editor list deletes the selected event with Delete", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);

  await page.getByTestId("layer-event").click();
  await page.getByTestId("event-list-row-ev_delete").click();
  await page.keyboard.press("Delete");

  await expect(page.getByTestId("event-list-row-ev_delete")).toHaveCount(0);
  expect((await debugState(page)).project.maps.map_delete?.events).toEqual([]);
});

test("event layer canvas deletes the clicked event with Delete", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapTile(page, 2, 2);
  await page.keyboard.press("Delete");

  await expect(page.getByTestId("event-list-row-ev_delete")).toHaveCount(0);
  expect((await debugState(page)).project.maps.map_delete?.events).toEqual([]);
});

test("event editor modal deletes the open event with Delete", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);

  await page.getByTestId("layer-event").click();
  await clickMapTile(page, 2, 2, 2);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await page.getByTestId("event-editor-modal-close").focus();
  await page.keyboard.press("Delete");

  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  expect((await debugState(page)).project.maps.map_delete?.events).toEqual([]);
});
