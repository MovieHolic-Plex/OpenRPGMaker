import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { houseDoorFrameIndex } from "@/editor/houseInteriors";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { tapKey } from "./runtimeInput";

type RuntimeState = {
  readonly mapId: string;
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
};

type HouseTransferScenario = {
  readonly project: Project;
  readonly villageMapId: string;
  readonly interiorMapId: string;
  readonly doorEventId: string;
  readonly front: { readonly x: number; readonly y: number };
  readonly entry: { readonly x: number; readonly y: number };
  readonly exit: { readonly x: number; readonly y: number };
  readonly expectedOpenFrame: number;
};

type VillageData = {
  readonly mapId: string;
  readonly houses: ReadonlyArray<{
    readonly kitId: "blue-stone" | "bright-plaster";
    readonly doorEventId?: string;
    readonly interiorMapId?: string;
    readonly front: { readonly x: number; readonly y: number };
    readonly entry?: { readonly x: number; readonly y: number };
    readonly exit?: { readonly x: number; readonly y: number };
  }>;
};

const EVIDENCE_DIR = "output/evidence/village-house-interior-transfer";

test("build_village door action opens and transfers into the generated house interior", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const scenario = createScenario();
  await writeFile(`${EVIDENCE_DIR}/scenario.json`, JSON.stringify({
    villageMapId: scenario.villageMapId,
    interiorMapId: scenario.interiorMapId,
    doorEventId: scenario.doorEventId,
    front: scenario.front,
    entry: scenario.entry,
    exit: scenario.exit,
    expectedOpenFrame: scenario.expectedOpenFrame,
  }, null, 2), "utf8");

  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, scenario.project);
  await page.screenshot({ path: `${EVIDENCE_DIR}/editor-village.png`, fullPage: true });
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);

  const before = await runtimeState(page);
  expect(before.mapId).toBe(scenario.villageMapId);
  expect(before.player).toEqual(scenario.front);
  await page.screenshot({ path: `${EVIDENCE_DIR}/play-before-door-action.png`, fullPage: true });

  await tapKey(page, "ArrowUp", 90);
  const frameCapture = collectDoorFrames(page, scenario.doorEventId, 900);
  await tapKey(page, "Space", 30);
  const observedFrames = await frameCapture;
  expect(observedFrames).toContain(scenario.expectedOpenFrame);
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(scenario.interiorMapId);
  const inside = await runtimeState(page);
  expect(inside.player).toEqual(scenario.entry);
  await page.screenshot({ path: `${EVIDENCE_DIR}/play-inside-house.png`, fullPage: true });

  await tapKey(page, "ArrowDown", 180);
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(scenario.villageMapId);
  const returned = await runtimeState(page);
  expect(returned.player).toEqual(scenario.front);
  await page.screenshot({ path: `${EVIDENCE_DIR}/play-returned-to-village.png`, fullPage: true });

  await writeFile(`${EVIDENCE_DIR}/runtime-proof.json`, JSON.stringify({
    before,
    inside,
    returned,
    observedFrames,
  }, null, 2), "utf8");
});

function createScenario(): HouseTransferScenario {
  const context: ToolContext = { project: createEmptyToolProject("마을 내부 e2e") };
  const result = runTool(context, "build_village", { seed: 7 });
  if (!result.ok) throw new Error(`build_village failed: ${result.summary}`);
  const data = result.data as VillageData;
  const firstHouse = data.houses[0];
  if (!firstHouse?.interiorMapId || !firstHouse.doorEventId || !firstHouse.entry || !firstHouse.exit) {
    throw new Error("build_village did not return first house interior refs");
  }
  context.project.startMapId = data.mapId;
  context.project.startPos = firstHouse.front;
  return {
    project: context.project,
    villageMapId: data.mapId,
    interiorMapId: firstHouse.interiorMapId,
    doorEventId: firstHouse.doorEventId,
    front: firstHouse.front,
    entry: firstHouse.entry,
    exit: firstHouse.exit,
    expectedOpenFrame: houseDoorFrameIndex(firstHouse.kitId, 2),
  };
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function collectDoorFrames(page: Page, doorEventId: string, durationMs: number): Promise<unknown[]> {
  return page.evaluate(async ({ doorEventId: eventId, durationMs: duration }) => {
    const frames: unknown[] = [];
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const debug = (window as unknown as {
          __rpgzzuCharacterSprites?: () => { readonly events?: Record<string, { readonly frame?: unknown }> } | null;
        }).__rpgzzuCharacterSprites?.();
        const frame = debug?.events?.[eventId]?.frame;
        if (frame !== undefined) frames.push(frame);
        if (performance.now() - startedAt >= duration) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
    return frames;
  }, { doorEventId, durationMs });
}
