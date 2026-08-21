/**
 * Captures product-path visual evidence for the canonical ice map and its
 * playable expedition derivative. The script does not mutate project data.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:9999";
const PROJECT_ID = "rpg-zzu-dungeon-theme-gallery";
const REFERENCE_MAP_ID = "map_g_ice_grand";
const ADVENTURE_MAP_ID = "map_g_ice_grand_adventure";
const OUTPUT_DIR = path.resolve("output/evidence/ice-grand-adventure");

type FullMapCapture = {
  readonly height: number;
  readonly mapId: string;
  readonly width: number;
};

type RuntimeState = {
  readonly currentMapId?: string;
  readonly x?: number;
  readonly y?: number;
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  deviceScaleFactor: 1,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") process.stderr.write(`[browser-console] ${message.text()}\n`);
});
page.on("pageerror", (error) => process.stderr.write(`[browser-pageerror] ${error.message}\n`));
page.on("requestfailed", (request) => {
  process.stderr.write(`[browser-request-failed] ${request.failure()?.errorText ?? "unknown"} ${request.url()}\n`);
});
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.removeItem("oprn:supabase-project-config");
});

async function openMap(mapId: string, focus?: { readonly x: number; readonly y: number }): Promise<void> {
  const params = new URLSearchParams({ project: PROJECT_ID, rm2k3Shell: "1" });
  if (focus) {
    params.set("focusX", String(focus.x));
    params.set("focusY", String(focus.y));
  }
  await page.goto(`${BASE_URL}/?${params}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    ({ requestedMapId }) => {
      const node = document.querySelector<HTMLElement>("[data-testid='project-export-json']");
      if (!node?.textContent) return false;
      try {
        const exported = JSON.parse(node.textContent) as {
          project?: { maps?: Record<string, unknown> };
        };
        return Boolean(exported.project?.maps?.[requestedMapId]);
      } catch {
        return false;
      }
    },
    { requestedMapId: mapId },
    { timeout: 30_000 },
  );
  const mapNode = page.getByTestId(`map-tree-node-${mapId}`);
  await mapNode.scrollIntoViewIfNeeded();
  await mapNode.click();
  await page.waitForFunction(
    ({ requestedMapId }) => {
      const node = document.querySelector<HTMLElement>("[data-testid='project-export-json']");
      if (!node?.textContent) return false;
      try {
        const exported = JSON.parse(node.textContent) as { editor?: { currentMapId?: string } };
        return exported.editor?.currentMapId === requestedMapId;
      } catch {
        return false;
      }
    },
    { requestedMapId: mapId },
    { timeout: 15_000 },
  );
  const zoomButton = page.getByTestId("editor-zoom-4");
  await zoomButton.dispatchEvent("click");
  await page.waitForTimeout(1_200);
}

async function fullMapCapture(mapId: string, fileName: string): Promise<FullMapCapture> {
  const resultNode = page.getByTestId("editor-map-screenshot-result");
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByTestId("editor-map-screenshot-button").dispatchEvent("click");
  const download = await downloadPromise;
  const filePath = path.join(OUTPUT_DIR, fileName);
  await download.saveAs(filePath);
  await page.waitForFunction(
    ({ requestedMapId }) => {
      const node = document.querySelector<HTMLElement>("[data-testid='editor-map-screenshot-result']");
      if (!node?.textContent) return false;
      try {
        const result = JSON.parse(node.textContent) as { mapId?: string; state?: string };
        return result.mapId === requestedMapId && result.state === "done";
      } catch {
        return false;
      }
    },
    { requestedMapId: mapId },
    { timeout: 30_000 },
  );
  const result = JSON.parse((await resultNode.textContent()) ?? "{}") as {
    mapId?: string;
    pixelSize?: { height?: number; width?: number };
  };
  return {
    height: result.pixelSize?.height ?? 0,
    mapId: result.mapId ?? mapId,
    width: result.pixelSize?.width ?? 0,
  };
}

async function captureEditorRegion(
  fileName: string,
  focus: { readonly x: number; readonly y: number },
): Promise<string> {
  await openMap(ADVENTURE_MAP_ID, focus);
  const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  const filePath = path.join(OUTPUT_DIR, fileName);
  await canvas.screenshot({ path: filePath });
  return filePath;
}

async function runtimeState(): Promise<RuntimeState> {
  return page.evaluate(() => {
    const hook = (window as unknown as {
      __rpgzzuDebug?: { readState: () => RuntimeState };
    }).__rpgzzuDebug;
    return hook?.readState() ?? {};
  });
}

const evidence: Record<string, unknown> = {
  adventureMapId: ADVENTURE_MAP_ID,
  projectId: PROJECT_ID,
  referenceMapId: REFERENCE_MAP_ID,
  screenshots: {},
};

try {
  await openMap(REFERENCE_MAP_ID);
  const referencePath = path.join(OUTPUT_DIR, "00-canonical-map-g-ice-grand.png");
  const reference = await fullMapCapture(REFERENCE_MAP_ID, path.basename(referencePath));

  await openMap(ADVENTURE_MAP_ID);
  const adventurePath = path.join(OUTPUT_DIR, "01-ice-grand-adventure-full.png");
  const adventure = await fullMapCapture(ADVENTURE_MAP_ID, path.basename(adventurePath));

  const entryPath = await captureEditorRegion("02-entry-monsters.png", { x: 27, y: 46 });
  const golemPath = await captureEditorRegion("03-golem-gate.png", { x: 28, y: 25 });
  const bossPath = await captureEditorRegion("04-dragon-sanctum.png", { x: 27, y: 8 });

  await openMap(ADVENTURE_MAP_ID, { x: 22, y: 45 });
  await page.evaluate(({ mapId, eventId }) => {
    window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window", {
      detail: { eventId, kind: "selected-event", mapId },
    }));
  }, { eventId: "ev_ice_golem_west", mapId: ADVENTURE_MAP_ID });
  await page.getByTestId("test-play-window").waitFor({ state: "visible", timeout: 15_000 });
  const playCanvas = page.getByTestId("play-canvas").locator("canvas").first();
  try {
    await playCanvas.waitFor({ state: "visible", timeout: 20_000 });
  } catch (error) {
    const bodyText = await page.getByTestId("test-play-window-body").textContent().catch(() => null);
    throw new Error(`test play canvas did not mount: ${bodyText ?? "<no body>"}`, { cause: error });
  }
  await page.getByTestId("runtime-state-json").waitFor({ state: "attached", timeout: 15_000 });
  await page.evaluate(({ mapId }) => {
    const hook = (window as unknown as {
      __rpgzzuDebug?: { teleport: (targetMapId: string, x: number, y: number) => void };
    }).__rpgzzuDebug;
    hook?.teleport(mapId, 18, 27);
  }, { mapId: ADVENTURE_MAP_ID });
  await page.waitForTimeout(1_000);
  const fieldState = await runtimeState();
  const fieldPath = path.join(OUTPUT_DIR, "05-field-golem-encounter.png");
  await playCanvas.screenshot({ path: fieldPath });

  const encounterTroopId = await page.evaluate(({ eventId, mapId }) => {
    const node = document.querySelector<HTMLElement>("[data-testid='project-export-json']");
    const exported = JSON.parse(node?.textContent ?? "{}") as {
      project?: {
        maps?: Record<string, {
          events?: Array<{
            id?: string;
            pages?: Array<{ commands?: Array<{ kind?: string; troopId?: string }> }>;
          }>;
        }>;
      };
    };
    const event = exported.project?.maps?.[mapId]?.events?.find((entry) => entry.id === eventId);
    return event?.pages?.flatMap((entry) => entry.commands ?? [])
      .find((command) => command.kind === "battleProcessing")?.troopId ?? null;
  }, { eventId: "ev_ice_golem_west", mapId: ADVENTURE_MAP_ID });
  if (encounterTroopId !== "troop_ice_adventure_golem_guard") {
    throw new Error(`field encounter is not linked to troop_ice_adventure_golem_guard: ${encounterTroopId}`);
  }
  await page.evaluate(({ troopId }) => {
    window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window", {
      detail: { kind: "troop-battle", troopId },
    }));
  }, { troopId: encounterTroopId });
  await page.getByTestId("battle-scene").waitFor({ state: "visible", timeout: 15_000 });
  const enemyImage = page.locator(".battle-enemy-image").first();
  await enemyImage.waitFor({ state: "attached", timeout: 15_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(".battle-enemy-image");
    return Boolean(image?.complete && image.naturalWidth > 0);
  }, undefined, { timeout: 15_000 });
  await page.waitForTimeout(1_500);
  const enemyImageEvidence = await enemyImage.evaluate((image) => {
    const element = image as HTMLImageElement;
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      complete: element.complete,
      display: style.display,
      height: bounds.height,
      naturalHeight: element.naturalHeight,
      naturalWidth: element.naturalWidth,
      opacity: style.opacity,
      visibility: style.visibility,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    };
  });
  const battlePath = path.join(OUTPUT_DIR, "06-golem-battle.png");
  await page.getByTestId("battle-scene").screenshot({ path: battlePath });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window", {
      detail: { kind: "troop-battle", troopId: "troop_ice_adventure_dragon" },
    }));
  });
  await page.getByTestId("battle-scene").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(".battle-enemy-image");
    return Boolean(image?.complete && image.naturalWidth > 0 && image.src.includes("monster-dragon-01.png"));
  }, undefined, { timeout: 15_000 });
  await page.waitForTimeout(1_000);
  const dragonBattlePath = path.join(OUTPUT_DIR, "07-dragon-boss-battle.png");
  await page.getByTestId("battle-scene").screenshot({ path: dragonBattlePath });

  evidence.fullMapPixels = {
    adventure: { height: adventure.height, width: adventure.width },
    reference: { height: reference.height, width: reference.width },
  };
  evidence.runtime = {
    battleSceneVisible: true,
    enemyImage: enemyImageEvidence,
    fieldEventTroopId: encounterTroopId,
    fieldMapId: fieldState.currentMapId,
    fieldPlayer: { x: fieldState.x, y: fieldState.y },
  };
  evidence.screenshots = {
    adventure: adventurePath,
    battle: battlePath,
    boss: bossPath,
    canonical: referencePath,
    dragonBattle: dragonBattlePath,
    entry: entryPath,
    field: fieldPath,
    golem: golemPath,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "browser-qa.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await context.close();
  await browser.close();
}
