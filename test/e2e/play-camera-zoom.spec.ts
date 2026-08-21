import { expect, test, type Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

type CameraMetrics = {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
};

const PASSABLE = { up: true, down: true, left: true, right: true } as const;

async function cameraMetrics(page: Page): Promise<CameraMetrics> {
  const parsed = await page.evaluate(() => {
    const camera = window.__oprnCamera?.();
    return camera ? { width: camera.width, height: camera.height, zoom: camera.zoom } : null;
  });
  if (!isCameraMetrics(parsed)) throw new Error("invalid camera metrics");
  return parsed;
}

function isCameraMetrics(value: unknown): value is CameraMetrics {
  return isRecord(value)
    && typeof value.width === "number"
    && typeof value.height === "number"
    && typeof value.zoom === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function smallMapProject(): Project {
  return {
    version: 3,
    meta: { title: "Small Map Camera", author: "e2e", terms: { gold: "G" } },
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
        passability: [PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE],
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
      small_map: {
        id: "small_map",
        name: "Small",
        width: 4,
        height: 3,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(12).fill(0),
        upperTiles: new Array<number>(12).fill(-1),
        events: [],
      },
    },
    mapTree: { mapId: "small_map", children: [] },
    startMapId: "small_map",
    startPos: { x: 0, y: 0 },
    flags: {},
  };
}

test("small runtime maps keep the fixed play camera zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, smallMapProject());
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();

  expect(await cameraMetrics(page)).toEqual({ width: 320, height: 240, zoom: 1 });
});
