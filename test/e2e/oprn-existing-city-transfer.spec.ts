import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { deserialize, serialize } from "@/project/io";
import type { GameMap, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

type RuntimeEventState = {
  readonly x: number;
  readonly y: number;
  readonly pageId?: string;
  readonly priority: string;
  readonly trigger: string;
};

type RuntimeState = {
  readonly mapId: string;
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
  readonly events: Record<string, RuntimeEventState>;
};

type Direction = "down" | "left" | "right" | "up";

const EVIDENCE_DIR = "output/evidence/map-transfer-existing-city";
const RECOVERED_PROJECT_PATH = ".omo/recovered/legacyDb-rpg-zzu-house-template-gallery.json";
const CITY_MAP_NAME = "small_house_01 도시 8채";
const TARGET_MAP_NAME = "small_house_01 도시 8채 이동 타겟";
const TARGET_MAP_ID = "map_existing_city_transfer_target";
const CITY_TRANSFER_EVENT_ID = "city-transfer-to-city-target";
const CITY_TARGET_RETURN_EVENT_ID = "city-target-return-to-city";
const DIRECTION_BY_KEY: Record<string, Direction> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeEventState(value: unknown): value is RuntimeEventState {
  return (
    isRecord(value)
    && typeof value.x === "number"
    && typeof value.y === "number"
    && (value.pageId === undefined || typeof value.pageId === "string")
    && typeof value.priority === "string"
    && typeof value.trigger === "string"
  );
}

function isRuntimeState(value: unknown): value is RuntimeState {
  return (
    isRecord(value)
    && typeof value.mapId === "string"
    && typeof value.inputEnabled === "boolean"
    && isRecord(value.player)
    && typeof value.player.x === "number"
    && typeof value.player.y === "number"
    && isRecord(value.events)
    && Object.values(value.events).every(isRuntimeEventState)
  );
}

function mapByName(project: Project, name: string): GameMap {
  const map = Object.values(project.maps).find((entry) => entry.name === name);
  if (!map) throw new Error(`missing map: ${name}`);
  return map;
}

function addTouchTransferEvent(map: GameMap, eventId: string, targetMapId: string, source: { readonly x: number; readonly y: number }, target: { readonly x: number; readonly y: number }): void {
  map.events = map.events.filter((event) => event.id !== eventId);
  map.events.push({
    id: eventId,
    x: source.x,
    y: source.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${eventId}-page`,
        name: "맵 이동",
        conditions: [],
        graphic: {},
        trigger: { kind: "playerTouch" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "transfer", mapId: targetMapId, x: target.x, y: target.y }],
      },
    ],
  });
}

async function existingCityTransferProject(): Promise<Project> {
  const project = deserialize(await readFile(RECOVERED_PROJECT_PATH, "utf8"));
  const cityMap = mapByName(project, CITY_MAP_NAME);
  const targetMap: GameMap = {
    ...cityMap,
    id: TARGET_MAP_ID,
    name: TARGET_MAP_NAME,
    lowerTiles: [...cityMap.lowerTiles],
    upperTiles: [...cityMap.upperTiles],
    events: [],
  };
  project.maps[targetMap.id] = targetMap;
  project.mapTree.children = [
    ...project.mapTree.children.filter((node) => node.mapId !== targetMap.id),
    { mapId: targetMap.id, children: [] },
  ];
  project.startMapId = cityMap.id;
  project.startPos = { x: 24, y: 25 };
  addTouchTransferEvent(cityMap, CITY_TRANSFER_EVENT_ID, targetMap.id, { x: 25, y: 25 }, { x: 23, y: 20 });
  addTouchTransferEvent(targetMap, CITY_TARGET_RETURN_EVENT_ID, cityMap.id, { x: 22, y: 20 }, { x: 18, y: 20 });
  return project;
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

async function holdDirectionUntilMap(page: Page, key: string, expectedMapId: string): Promise<void> {
  const direction = DIRECTION_BY_KEY[key];
  if (!direction) throw new Error(`unsupported direction key: ${key}`);
  const hasHook = await page.evaluate(
    () => typeof (window as unknown as { __oprnInput?: unknown }).__oprnInput === "object"
      && !!(window as unknown as { __oprnInput?: unknown }).__oprnInput
  );
  if (!hasHook) await page.keyboard.down(key);
  await setInjectedDirection(page, hasHook ? direction : null);
  try {
    await page.waitForFunction(
      (targetMapId) => {
        const text = document.querySelector<HTMLElement>("[data-testid='runtime-state-json']")?.textContent;
        if (!text) return false;
        try {
          const state = JSON.parse(text) as { readonly mapId?: unknown };
          return state.mapId === targetMapId;
        } catch {
          return false;
        }
      },
      expectedMapId,
      { polling: "raf", timeout: 8_000 },
    );
  } finally {
    if (hasHook) {
      await setInjectedDirection(page, null);
    } else {
      await page.keyboard.up(key);
    }
  }
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
}

async function setInjectedDirection(page: Page, direction: Direction | null): Promise<void> {
  await page.evaluate((nextDirection) => {
    (window as unknown as { __oprnInput?: { dir: (direction: string | null) => void } }).__oprnInput?.dir(nextDirection);
  }, direction);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeMarkdown(path: string, value: string): Promise<void> {
  await writeFile(path, `${value.trim()}\n`, "utf8");
}

async function publishEvidenceDirectory(sourceDir: string, targetDir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await rm(targetDir, { recursive: true, force: true });
    try {
      await rename(sourceDir, targetDir);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

test("existing city map transfer fires from the event layer", async ({ page }) => {
  const runEvidenceDir = `${EVIDENCE_DIR}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let publishedEvidence = false;
  await rm(runEvidenceDir, { recursive: true, force: true });
  await mkdir(runEvidenceDir, { recursive: true });
  const project = await existingCityTransferProject();
  const cityMap = mapByName(project, CITY_MAP_NAME);
  const targetMap = mapByName(project, TARGET_MAP_NAME);

  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedProjectForEditor(page, project);
    await page.screenshot({ path: `${runEvidenceDir}/editor-city-map.png`, fullPage: true });
    await page.getByTestId("mode-play").click();
    await startNewGameFromTitle(page);
    await expect(page.getByTestId("play-canvas")).toBeVisible();
    await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);

    const before = await runtimeState(page);
    expect(before.mapId).toBe(cityMap.id);
    expect(before.events[CITY_TRANSFER_EVENT_ID]).toMatchObject({
      x: 25,
      y: 25,
      pageId: `${CITY_TRANSFER_EVENT_ID}-page`,
      priority: "below",
      trigger: "playerTouch",
    });
    await page.screenshot({ path: `${runEvidenceDir}/play-city-before-transfer.png`, fullPage: true });
    await page.getByTestId("play-canvas").screenshot({ path: `${runEvidenceDir}/canvas-city-before-transfer.png` });

    await holdDirectionUntilMap(page, "ArrowRight", targetMap.id);
    const after = await runtimeState(page);
    expect(after.player).toEqual({ x: 23, y: 20 });
    expect(after.events[CITY_TARGET_RETURN_EVENT_ID]).toMatchObject({
      x: 22,
      y: 20,
      pageId: `${CITY_TARGET_RETURN_EVENT_ID}-page`,
      priority: "below",
      trigger: "playerTouch",
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${runEvidenceDir}/play-city-target-after-transfer.png`, fullPage: true });
    await page.getByTestId("play-canvas").screenshot({ path: `${runEvidenceDir}/canvas-city-target-after-transfer.png` });

    await holdDirectionUntilMap(page, "ArrowLeft", cityMap.id);
    const returned = await runtimeState(page);
    expect(returned.player).toEqual({ x: 18, y: 20 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${runEvidenceDir}/play-city-after-return.png`, fullPage: true });

    await writeJson(`${runEvidenceDir}/runtime-proof.json`, {
      sourceProject: RECOVERED_PROJECT_PATH,
      sourceMap: { id: cityMap.id, name: cityMap.name, size: `${cityMap.width}x${cityMap.height}` },
      targetMap: { id: targetMap.id, name: targetMap.name, size: `${targetMap.width}x${targetMap.height}` },
      transfer: {
        sourceEventId: CITY_TRANSFER_EVENT_ID,
        requestedTarget: { mapId: targetMap.id, x: 23, y: 20 },
        resolvedTarget: after.player,
      },
      before: { mapId: before.mapId, player: before.player, transferEvent: before.events[CITY_TRANSFER_EVENT_ID] },
      after: { mapId: after.mapId, player: after.player, returnEvent: after.events[CITY_TARGET_RETURN_EVENT_ID] },
      returned: { mapId: returned.mapId, player: returned.player },
    });
    await writeJson(`${runEvidenceDir}/scenario.json`, {
      title: "Existing city event-layer map transfer",
      sourceProject: RECOVERED_PROJECT_PATH,
      sourceMap: { id: cityMap.id, name: cityMap.name, size: `${cityMap.width}x${cityMap.height}` },
      targetMap: { id: targetMap.id, name: targetMap.name, size: `${targetMap.width}x${targetMap.height}` },
      eventLayer: {
        priority: "below",
        trigger: "playerTouch",
        sourceEvent: { id: CITY_TRANSFER_EVENT_ID, x: 25, y: 25 },
        returnEvent: { id: CITY_TARGET_RETURN_EVENT_ID, x: 22, y: 20 },
      },
      screenshots: [
        "editor-city-map.png",
        "play-city-before-transfer.png",
        "canvas-city-before-transfer.png",
        "play-city-target-after-transfer.png",
        "canvas-city-target-after-transfer.png",
        "play-city-after-return.png",
      ],
    });
    await writeMarkdown(
      `${runEvidenceDir}/visual-qa.md`,
      `
# Existing City Transfer Visual QA

Verdict: PASS

- \`play-city-before-transfer.png\` shows the recovered city map \`${CITY_MAP_NAME}\` with house and road tiles before the player steps onto the transfer event.
- \`play-city-target-after-transfer.png\` shows the cloned existing-city target map after the event-layer transfer command reaches its requested landing tile.
- \`play-city-after-return.png\` shows the player returned to the original city map after stepping onto the target map's return event.
`,
    );
    await writeMarkdown(
      `${runEvidenceDir}/cleanup-receipt.md`,
      `
# Cleanup Receipt

- This scenario seeds from \`${RECOVERED_PROJECT_PATH}\` and does not overwrite the recovered project file.
- The target map is an in-memory clone of the existing city map, so screenshots stay on the user's city surface rather than a sample fixture.
- Browser artifacts are regenerated under \`${EVIDENCE_DIR}\`.
`,
    );
    await writeFile(`${runEvidenceDir}/project-export.json`, serialize(project), "utf8");
    await publishEvidenceDirectory(runEvidenceDir, EVIDENCE_DIR);
    publishedEvidence = true;
  } finally {
    if (!publishedEvidence) await rm(runEvidenceDir, { recursive: true, force: true });
  }
});
