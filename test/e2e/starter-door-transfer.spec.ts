import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startNewGameFromTitle } from "./runtimeInput";

type RuntimeState = {
  readonly mapId: string;
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
};

type ProjectExport = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly name: string }>;
  };
};

type PlayerSpriteDebug = {
  readonly kind: string;
  readonly resourceId: string;
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
};

type PlayCanvasMetrics = {
  readonly width: number;
  readonly height: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
};

type CameraMetrics = {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
};

const EVIDENCE_DIR = "output/evidence/starter-door-transfer";
const TARGET_MAP_ID = "map_starter_house_interior";

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

async function projectExport(page: Page): Promise<ProjectExport> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  const parsed: unknown = JSON.parse(text);
  if (!isProjectExport(parsed)) throw new Error("invalid project export");
  return parsed;
}

async function playerSpriteDebug(page: Page): Promise<PlayerSpriteDebug> {
  const parsed = await page.evaluate(() => {
    const sprite = window.__oprnPlayerSprite?.();
    return sprite ?? null;
  });
  if (!isPlayerSpriteDebug(parsed)) throw new Error("invalid player sprite debug state");
  return parsed;
}

async function playCanvasMetrics(page: Page): Promise<PlayCanvasMetrics> {
  const parsed = await page.getByTestId("play-canvas").locator("canvas").evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error("play surface child is not a canvas");
    const bounds = node.getBoundingClientRect();
    return {
      width: node.width,
      height: node.height,
      displayWidth: bounds.width,
      displayHeight: bounds.height,
    };
  });
  if (!isPlayCanvasMetrics(parsed)) throw new Error("invalid play canvas metrics");
  return parsed;
}

async function cameraMetrics(page: Page): Promise<CameraMetrics> {
  const parsed = await page.evaluate(() => {
    const camera = window.__oprnCamera?.();
    return camera
      ? { width: camera.width, height: camera.height, zoom: camera.zoom }
      : null;
  });
  if (!isCameraMetrics(parsed)) throw new Error("invalid camera metrics");
  return parsed;
}

async function holdDirection(page: Page, direction: string, durationMs: number): Promise<void> {
  await page.evaluate((nextDirection) => {
    window.__oprnInput?.dir(nextDirection);
  }, direction);
  await page.waitForTimeout(durationMs);
  await page.evaluate(() => {
    window.__oprnInput?.dir(null);
  });
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!isRecord(value) || !isRecord(value.player)) return false;
  return (
    typeof value.mapId === "string"
    && typeof value.inputEnabled === "boolean"
    && typeof value.player.x === "number"
    && typeof value.player.y === "number"
  );
}

function isProjectExport(value: unknown): value is ProjectExport {
  if (!isRecord(value) || !isRecord(value.project) || !isRecord(value.project.maps)) return false;
  return typeof value.project.startMapId === "string";
}

function isPlayerSpriteDebug(value: unknown): value is PlayerSpriteDebug {
  return isRecord(value) &&
    typeof value.kind === "string" &&
    typeof value.resourceId === "string" &&
    typeof value.textureKey === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number";
}

function isPlayCanvasMetrics(value: unknown): value is PlayCanvasMetrics {
  return isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.displayWidth === "number" &&
    typeof value.displayHeight === "number";
}

function isCameraMetrics(value: unknown): value is CameraMetrics {
  return isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.zoom === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

test("fresh starter door transfers the player to the new map", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

  const exported = await projectExport(page);
  expect(exported.project.maps[TARGET_MAP_ID]?.name).toBe("시작 집 내부");
  await writeFile(`${EVIDENCE_DIR}/project-export.json`, JSON.stringify(exported, null, 2), "utf8");
  await page.screenshot({ path: `${EVIDENCE_DIR}/editor-before-play.png`, fullPage: true });

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);

  const before = await runtimeState(page);
  expect(before.mapId).toBe(exported.project.startMapId);
  await expect.poll(async () => playerSpriteDebug(page)).toMatchObject({
    kind: "charset",
    resourceId: "easyrpg-charset-actor1",
    textureKey: "tex_easyrpg_charset_actor1",
  });
  const beforeMetrics = await playCanvasMetrics(page);
  expect(beforeMetrics).toMatchObject({ width: 320, height: 240 });
  const beforeCamera = await cameraMetrics(page);
  expect(beforeCamera).toEqual({ width: 320, height: 240, zoom: 1 });
  await holdDirection(page, "right", 260);
  const afterPlayerMove = await runtimeState(page);
  expect(afterPlayerMove.mapId).toBe(before.mapId);
  expect(afterPlayerMove.player.x).toBeGreaterThan(before.player.x);
  expect(afterPlayerMove.player.y).toBe(before.player.y);
  const afterPlayerMoveMetrics = await playCanvasMetrics(page);
  expect(afterPlayerMoveMetrics).toEqual(beforeMetrics);
  const afterPlayerMoveCamera = await cameraMetrics(page);
  expect(afterPlayerMoveCamera).toEqual(beforeCamera);
  await page.getByTestId("play-canvas").screenshot({ path: `${EVIDENCE_DIR}/canvas-after-player-move.png` });
  await page.screenshot({ path: `${EVIDENCE_DIR}/play-before-door.png`, fullPage: true });
  await page.getByTestId("play-canvas").screenshot({ path: `${EVIDENCE_DIR}/canvas-before-door.png` });

  await page.getByTestId("event-event_starter_house_door").click({ force: true });
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(TARGET_MAP_ID);
  const after = await runtimeState(page);
  expect(after.player).toEqual({ x: 4, y: 6 });
  const afterMetrics = await playCanvasMetrics(page);
  expect(afterMetrics).toEqual(beforeMetrics);
  const afterCamera = await cameraMetrics(page);
  expect(afterCamera).toEqual(beforeCamera);
  await expect.poll(async () => playerSpriteDebug(page)).toMatchObject({
    kind: "charset",
    resourceId: "easyrpg-charset-actor1",
    textureKey: "tex_easyrpg_charset_actor1",
    x: 72,
    y: 112,
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${EVIDENCE_DIR}/play-after-door-transfer.png`, fullPage: true });
  await page.getByTestId("play-canvas").screenshot({ path: `${EVIDENCE_DIR}/canvas-after-door-transfer.png` });

  await writeFile(
    `${EVIDENCE_DIR}/runtime-proof.json`,
    JSON.stringify(
      {
        before,
        after,
        playerMove: {
          before,
          after: afterPlayerMove,
          canvasMetrics: { before: beforeMetrics, after: afterPlayerMoveMetrics },
          cameraMetrics: { before: beforeCamera, after: afterPlayerMoveCamera },
        },
        canvasMetrics: { before: beforeMetrics, after: afterMetrics },
        cameraMetrics: { before: beforeCamera, after: afterCamera },
        transfer: { doorEventId: "event_starter_house_door", targetMapId: TARGET_MAP_ID, targetPosition: { x: 4, y: 6 } },
        screenshots: [
          "editor-before-play.png",
          "canvas-after-player-move.png",
          "play-before-door.png",
          "canvas-before-door.png",
          "play-after-door-transfer.png",
          "canvas-after-door-transfer.png",
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
});
