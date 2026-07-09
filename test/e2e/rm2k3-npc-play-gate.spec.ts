import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { EventPage, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const PASSABLE = { up: true, down: true, left: true, right: true };
const EVIDENCE_DIR = ".omo/ulw-loop/npc-keyboard-natural";
const NPC_EVIDENCE_JSON = ".omo/ulw-loop/npc-keyboard-natural/npc-natural-evidence.json";
const NPC_SCREENSHOT = ".omo/ulw-loop/npc-keyboard-natural/npc-natural.png";

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
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly events: Record<string, RuntimeEventState>;
};

type CharacterSpriteDebug = {
  readonly player: { readonly x: number; readonly y: number; readonly depth: number };
  readonly events: Record<string, { readonly x: number; readonly y: number; readonly depth: number }>;
};

type SpriteMotionSample = {
  readonly atMs: number;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
};

type DebugState = {
  readonly project: Project;
};

function pageRecord(
  id: string,
  trigger: EventPage["trigger"],
  priority: EventPage["priority"],
  commands: EventPage["commands"],
  movement: EventPage["movement"]
): EventPage {
  return {
    id,
    name: id,
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
    trigger,
    priority,
    movement,
    commands,
  };
}

async function seedProject(page: Page, project: Project): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project);
}

async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await waitForPlaySceneReady(page);
  try {
    await runtimeTapKey(page, key, holdMs);
  } catch (error) {
    if (!isTransientSceneChangeError(error)) throw error;
    await waitForPlaySceneReady(page);
    await runtimeTapKey(page, key, holdMs);
  }
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return parseRuntimeState(text);
}

async function waitForPlaySceneReady(page: Page): Promise<void> {
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  await expect.poll(async () => hasRuntimeInputHook(page)).toBe(true);
}

async function hasRuntimeInputHook(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(
      () => typeof (window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput === "object"
        && !!(window as unknown as { __rpgzzuInput?: unknown }).__rpgzzuInput
    );
  } catch (error) {
    if (isTransientSceneChangeError(error)) return false;
    throw error;
  }
}

function isTransientSceneChangeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Execution context was destroyed|Cannot find context|Target page, context or browser has been closed/u.test(error.message);
}

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return parseDebugState(text);
}

async function characterSpriteDebug(page: Page): Promise<CharacterSpriteDebug> {
  const debug = await page.evaluate<CharacterSpriteDebug | null>(() => {
    const hook = (window as unknown as { __rpgzzuCharacterSprites?: () => CharacterSpriteDebug | null })
      .__rpgzzuCharacterSprites;
    return hook?.() ?? null;
  });
  if (!debug) throw new Error("missing character sprite debug hook");
  return debug;
}

async function sampleEventSprite(
  page: Page,
  eventId: string,
  count: number,
  intervalMs: number
): Promise<readonly SpriteMotionSample[]> {
  const startedAt = Date.now();
  const samples: SpriteMotionSample[] = [];
  for (let index = 0; index < count; index += 1) {
    const sprite = (await characterSpriteDebug(page)).events[eventId];
    if (sprite) {
      samples.push({
        atMs: Date.now() - startedAt,
        x: sprite.x,
        y: sprite.y,
        depth: sprite.depth,
      });
    }
    await page.waitForTimeout(intervalMs);
  }
  return samples;
}

function parseRuntimeState(text: string): RuntimeState {
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("malformed runtime state");
  return parsed;
}

function parseDebugState(text: string): DebugState {
  const parsed: unknown = JSON.parse(text);
  if (!isDebugState(parsed)) throw new Error("malformed project export");
  return parsed;
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!isRecord(value)) return false;
  return isRecord(value.player) &&
    isRecord(value.switches) &&
    isRecord(value.variables) &&
    isRecord(value.events) &&
    typeof value.mapId === "string" &&
    typeof value.inputEnabled === "boolean";
}

function isDebugState(value: unknown): value is DebugState {
  return isRecord(value) && isRecord(value.project);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRuntimeState(value: RuntimeState | null, message: string): RuntimeState {
  if (!value) throw new Error(message);
  return value;
}

function hasDistinctSpritePosition(samples: readonly SpriteMotionSample[]): boolean {
  return new Set(samples.map((sample) => `${sample.x},${sample.y}`)).size > 1;
}

function gateProject(): Project {
  return {
    version: 3,
    meta: { title: "NPC Play Gate", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        tex_easyrpg_charset_people1: {
          id: "tex_easyrpg_charset_people1",
          image: { type: "bundled", id: "tex_easyrpg_charset_people1" },
          frames: 8,
          frameWidth: 32,
          frameHeight: 32,
        },
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
        passability: [PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE],
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    switches: [{ id: "sw_action", name: "Action fired" }],
    variables: [
      { id: "var_player_touch", name: "Player touch count" },
      { id: "var_event_touch", name: "Event touch count" },
    ],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_gate: {
        id: "map_gate",
        name: "NPC Gate",
        width: 6,
        height: 6,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(36).fill(0),
        upperTiles: new Array<number>(36).fill(-1),
        events: [
          {
            id: "npc_action",
            x: 3,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              pageRecord("npc_action_page", { kind: "action" }, "same", [
                { kind: "setSwitch", switchId: "sw_action", value: true },
              ], { type: "fixed", speed: 3, frequency: 3 }),
            ],
          },
          {
            id: "npc_player_touch",
            x: 2,
            y: 3,
            trigger: { kind: "playerTouch" },
            commands: [],
            pages: [
              pageRecord("npc_player_touch_page", { kind: "playerTouch" }, "below", [
                { kind: "setVariable", variableId: "var_player_touch", op: "+=", value: 1 },
              ], { type: "fixed", speed: 3, frequency: 3 }),
            ],
          },
          {
            id: "npc_event_touch_approach",
            x: 5,
            y: 3,
            trigger: { kind: "eventTouch" },
            commands: [],
            pages: [
              pageRecord("npc_event_touch_approach_page", { kind: "eventTouch" }, "same", [
                { kind: "setVariable", variableId: "var_event_touch", op: "+=", value: 1 },
              ], { type: "approach", speed: 6, frequency: 6 }),
            ],
          },
          {
            id: "npc_fixed",
            x: 0,
            y: 0,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              pageRecord("npc_fixed_page", { kind: "action" }, "same", [], { type: "fixed", speed: 6, frequency: 6 }),
            ],
          },
          {
            id: "npc_depth_lower",
            x: 0,
            y: 3,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              pageRecord("npc_depth_lower_page", { kind: "action" }, "same", [], {
                type: "fixed",
                speed: 6,
                frequency: 6,
              }),
            ],
          },
          {
            id: "npc_custom",
            x: 4,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              pageRecord("npc_custom_page", { kind: "action" }, "same", [], {
                type: "custom",
                speed: 6,
                frequency: 6,
                route: { moves: [{ kind: "move", dir: "left" }], repeat: false },
              }),
            ],
          },
          {
            id: "npc_custom_loop",
            x: 4,
            y: 4,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              pageRecord("npc_custom_loop_page", { kind: "action" }, "same", [], {
                type: "custom",
                speed: 6,
                frequency: 6,
                route: { moves: [{ kind: "move", dir: "left" }, { kind: "move", dir: "right" }], repeat: true },
              }),
            ],
          },
          {
            id: "npc_random",
            x: 1,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              pageRecord("npc_random_page", { kind: "action" }, "same", [], { type: "random", speed: 6, frequency: 6 }),
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_gate", children: [] },
    startMapId: "map_gate",
    startPos: { x: 3, y: 3 },
    flags: {},
  };
}

test("real play gate proves NPC movement types and triggers execute in PlayScene", async ({ page }, testInfo) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, gateProject());
  const before = await debugState(page);

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await page.getByTestId("play-canvas").locator("canvas").click();

  const customSpriteMotion = await sampleEventSprite(page, "npc_custom_loop", 20, 50);
  expect(hasDistinctSpritePosition(customSpriteMotion)).toBe(true);

  await expect.poll(async () => (await runtimeState(page)).events.npc_custom).toEqual(
    expect.objectContaining({ x: 3, y: 1, trigger: "action" })
  );
  const customMovedState = await runtimeState(page);
  let randomMovedState: RuntimeState | null = null;
  await expect.poll(async () => {
    const nextState = await runtimeState(page);
    const event = nextState.events.npc_random;
    if (event && (event.x !== 1 || event.y !== 1)) randomMovedState = nextState;
    return randomMovedState !== null;
  }).toBe(true);
  const randomState = requireRuntimeState(randomMovedState, "random NPC did not expose a moved state");
  expect(randomState.events.npc_random?.x).toBeGreaterThanOrEqual(0);
  expect(randomState.events.npc_random?.x).toBeLessThan(6);
  expect(randomState.events.npc_random?.y).toBeGreaterThanOrEqual(0);
  expect(randomState.events.npc_random?.y).toBeLessThan(6);
  let approachMovedState: RuntimeState | null = null;
  await expect.poll(async () => {
    const nextState = await runtimeState(page);
    const event = nextState.events.npc_event_touch_approach;
    if (event?.x === 4 && event.y === 3) approachMovedState = nextState;
    return event;
  }).toEqual(
    expect.objectContaining({ x: 4, y: 3, trigger: "eventTouch" })
  );
  const approachState = requireRuntimeState(approachMovedState, "approach NPC did not expose a moved state");

  const fixedState = await runtimeState(page);
  expect(fixedState.events.npc_fixed).toEqual(expect.objectContaining({ x: 0, y: 0, trigger: "action" }));
  expect(fixedState.player).toEqual({ x: 3, y: 3 });
  const depthState = await characterSpriteDebug(page);
  expect(depthState.events.npc_fixed?.y).toBeLessThan(depthState.events.npc_depth_lower?.y ?? 0);
  expect(depthState.events.npc_fixed?.depth).toBeLessThan(depthState.events.npc_depth_lower?.depth ?? 0);

  await expect.poll(async () => (await runtimeState(page)).variables.var_event_touch ?? 0).toBeGreaterThanOrEqual(1);

  await tapKey(page, "ArrowUp");
  await tapKey(page, "Space");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_action).toBe(true);

  await tapKey(page, "ArrowLeft");
  await expect.poll(async () => (await runtimeState(page)).player).toEqual({ x: 2, y: 3 });
  await expect.poll(async () => (await runtimeState(page)).variables.var_player_touch ?? 0).toBeGreaterThanOrEqual(1);

  const finalState = await runtimeState(page);
  const evidence = {
    observedMovement: {
      fixed: fixedState.events.npc_fixed,
      depthLower: fixedState.events.npc_depth_lower,
      custom: customMovedState.events.npc_custom,
      customLoop: finalState.events.npc_custom_loop,
      random: randomState.events.npc_random,
      approach: approachState.events.npc_event_touch_approach,
    },
    observedSpriteMotion: {
      customLoop: customSpriteMotion,
    },
    observedDepth: depthState,
    observedTriggers: {
      actionSwitch: finalState.switches.sw_action,
      playerTouchCount: finalState.variables.var_player_touch ?? 0,
      eventTouchCount: finalState.variables.var_event_touch ?? 0,
    },
    finalState,
  };
  await testInfo.attach("npc-play-gate-runtime-state.json", {
    body: `${JSON.stringify(evidence, null, 2)}\n`,
    contentType: "application/json",
  });
  await writeFile(NPC_EVIDENCE_JSON, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await page.screenshot({ path: NPC_SCREENSHOT, fullPage: true });
  await page.screenshot({ path: testInfo.outputPath("npc-play-gate.png"), fullPage: true });

  await page.getByTestId("mode-edit").click();
  const after = await debugState(page);
  expect(after.project.maps.map_gate.events.find((event) => event.id === "npc_custom")?.x).toBe(
    before.project.maps.map_gate.events.find((event) => event.id === "npc_custom")?.x
  );
  expect(after.project.maps.map_gate.events.find((event) => event.id === "npc_random")?.x).toBe(
    before.project.maps.map_gate.events.find((event) => event.id === "npc_random")?.x
  );
});
