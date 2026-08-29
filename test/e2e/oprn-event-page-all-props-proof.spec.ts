import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Command, EventPage, Project } from "@/project/types";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { tapKey as runtimeTapKey, startNewGameFromTitle } from "./runtimeInput";

const PASSABLE = { up: true, down: true, left: true, right: true };
const EVIDENCE_DIR = "output/playwright/event-page-all-props-qa";
const PLAYER_TOUCH_SHOT = `${EVIDENCE_DIR}/fixed-player-touch.png`;
const MOVEMENT_SHOT = `${EVIDENCE_DIR}/fixed-page-movement-animation.png`;
const REPORT_PATH = `${EVIDENCE_DIR}/all-event-page-props-qa-report.json`;

type Result = { readonly status: "pass" | "fail"; readonly evidence?: unknown; readonly error?: string };
type RuntimeEventState = {
  readonly x: number;
  readonly y: number;
  readonly pageId?: string;
  readonly priority: string;
  readonly trigger: string;
};
type RuntimeState = {
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly events: Record<string, RuntimeEventState>;
};
type SpriteDebug = {
  readonly frame: string;
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
};

function pageRecord(
  id: string,
  trigger: EventPage["trigger"],
  priority: EventPage["priority"],
  commands: readonly Command[] = [],
  movement: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 },
  options: Partial<Pick<EventPage, "animationType" | "conditions" | "overlapForbidden">> = {}
): EventPage {
  return {
    id,
    name: id,
    conditions: options.conditions ?? [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" } },
    trigger,
    priority,
    movement,
    commands: [...commands],
    ...(options.animationType ? { animationType: options.animationType } : {}),
    ...(options.overlapForbidden === false ? { overlapForbidden: false } : {}),
  };
}

function event(id: string, x: number, y: number, pages: readonly EventPage[]): Project["maps"][string]["events"][number] {
  return { id, x, y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages: [...pages] };
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function waitReady(page: Page): Promise<void> {
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
}

async function tapKey(page: Page, key: string, holdMs = 90): Promise<void> {
  await waitReady(page);
  try {
    await runtimeTapKey(page, key, holdMs);
  } catch (error) {
    if (!isTransientSceneChangeError(error)) throw error;
    await waitReady(page);
    await runtimeTapKey(page, key, holdMs);
  }
}

function isTransientSceneChangeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Execution context was destroyed|Cannot find context|Target page, context or browser has been closed/u.test(error.message);
}

async function sampleSprite(page: Page, eventId: string): Promise<SpriteDebug> {
  const result = await page.evaluate((id): SpriteDebug | null => {
    type HookSprite = {
      readonly frame: string | number;
      readonly textureKey: string;
      readonly x: number;
      readonly y: number;
      readonly depth: number;
    };
    type HookState = { readonly events: Record<string, HookSprite> };
    const hook = (window as unknown as { __oprnCharacterSprites?: () => HookState | null }).__oprnCharacterSprites;
    const sprite = hook?.()?.events[id];
    return sprite ? { frame: String(sprite.frame), textureKey: sprite.textureKey, x: sprite.x, y: sprite.y, depth: sprite.depth } : null;
  }, eventId);
  if (!result) throw new Error(`missing event sprite: ${eventId}`);
  return result;
}

async function frameSamples(page: Page, eventId: string): Promise<readonly SpriteDebug[]> {
  const samples: SpriteDebug[] = [];
  for (let index = 0; index < 16; index += 1) {
    samples.push(await sampleSprite(page, eventId));
    await page.waitForTimeout(55);
  }
  return samples;
}

function notAt(eventState: RuntimeEventState | undefined, x: number, y: number): boolean {
  return Boolean(eventState && (eventState.x !== x || eventState.y !== y));
}

function at(eventState: RuntimeEventState | undefined, x: number, y: number): boolean {
  return Boolean(eventState && eventState.x === x && eventState.y === y);
}

async function editorRows(page: Page): Promise<{ conditionRows: number; disabledRows: number; zebraRows: readonly string[] }> {
  await page.getByTestId("mode-edit").click();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId("event-list-row-ev_condition").click();
  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-page-props")).toBeVisible();
  // 조건 4개를 켠 페이지(2번)에서 실제로 4행이 나오는지 본다. 흐린 행 계약은 사라졌으므로
  // 「disabled 0개」 만으로는 아무것도 증명하지 못한다.
  await page.getByTestId("event-page-tab-2").click();
  const conditionRows = await page.locator(".event-condition-row").count();
  await page.getByTestId("event-page-tab-1").click();
  const disabledRows = await page.locator(".event-condition-row.disabled").count();
  const zebraRows = await page.locator(".event-contents-fieldset .cmd-list > .cmd-item > .cmd-head").evaluateAll((nodes) =>
    nodes.slice(0, 2).map((node) => getComputedStyle(node).backgroundColor)
  );
  return { conditionRows, disabledRows, zebraRows };
}

function proofProject(): Project {
  const database = defaultDatabase();
  return {
    version: 3,
    meta: { title: "Event Page All Props Proof", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "Proof tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: [PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE],
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    switches: [
      { id: "sw_action", name: "Action" },
      { id: "sw_auto", name: "Auto" },
      { id: "sw_condition", name: "Condition" },
    ],
    variables: [
      { id: "var_condition", name: "Condition" },
      { id: "var_player_touch", name: "Player touch" },
      { id: "var_event_touch", name: "Event touch" },
      { id: "var_parallel", name: "Parallel" },
    ],
    commonEvents: [],
    database,
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_proof: {
        id: "map_proof",
        name: "Proof",
        width: 12,
        height: 10,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(120).fill(0),
        upperTiles: new Array<number>(120).fill(-1),
        events: [
          event("ev_action", 0, 1, [pageRecord("action", { kind: "action" }, "same", [{ kind: "setSwitch", switchId: "sw_action", value: true }])]),
          event("ev_player_touch", 2, 1, [pageRecord("playerTouch", { kind: "playerTouch" }, "same", [{ kind: "setVariable", variableId: "var_player_touch", op: "+=", value: 1 }])]),
          event("ev_condition", 1, 2, [
            pageRecord("condition_base", { kind: "action" }, "same", [
              { kind: "setSwitch", switchId: "sw_condition", value: true },
              { kind: "setVariable", variableId: "var_condition", op: "=", value: 7 },
              { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 },
              { kind: "changeParty", actorId: "actor_hero", action: "add" },
            ]),
            pageRecord("condition_met", { kind: "action" }, "same", [], { type: "fixed", speed: 3, frequency: 3 }, {
              conditions: [
                { kind: "switch", switchId: "sw_condition", value: true },
                { kind: "variable", variableId: "var_condition", op: ">=", value: 7 },
                { kind: "item", itemId: "item_potion", present: true },
                { kind: "actor", actorId: "actor_hero", present: true },
              ],
            }),
          ]),
          event("ev_auto", 5, 1, [pageRecord("auto", { kind: "auto" }, "below", [{ kind: "setSwitch", switchId: "sw_auto", value: true }])]),
          event("ev_parallel", 6, 1, [pageRecord("parallel", { kind: "parallel" }, "below", [{ kind: "setVariable", variableId: "var_parallel", op: "+=", value: 1 }])]),
          event("ev_event_touch", 4, 1, [pageRecord("eventTouch", { kind: "eventTouch" }, "same", [{ kind: "setVariable", variableId: "var_event_touch", op: "+=", value: 1 }], { type: "approach", speed: 6, frequency: 6 })]),
          event("move_fixed", 4, 4, [pageRecord("move_fixed", { kind: "action" }, "same", [], { type: "fixed", speed: 6, frequency: 6 })]),
          event("move_custom", 6, 4, [pageRecord("move_custom", { kind: "action" }, "same", [], { type: "custom", speed: 6, frequency: 6, route: { moves: [{ kind: "move", dir: "right" }], repeat: false } })]),
          event("move_random", 8, 4, [pageRecord("move_random", { kind: "action" }, "same", [], { type: "random", speed: 6, frequency: 6 })]),
          event("move_approach", 10, 4, [pageRecord("move_approach", { kind: "action" }, "same", [], { type: "approach", speed: 6, frequency: 6 })]),
          event("anim_normal", 4, 7, [pageRecord("anim_normal", { kind: "action" }, "same", [], { type: "custom", speed: 6, frequency: 6, route: { moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }], repeat: true } }, { animationType: "normal" })]),
          event("anim_fixed", 7, 7, [pageRecord("anim_fixed", { kind: "action" }, "same", [], { type: "custom", speed: 6, frequency: 6, route: { moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }], repeat: true } }, { animationType: "fixedGraphic" })]),
          event("depth_below", 9, 7, [pageRecord("depth_below", { kind: "action" }, "below")]),
          event("depth_above", 10, 7, [pageRecord("depth_above", { kind: "action" }, "above")]),
        ],
      },
    },
    mapTree: { mapId: "map_proof", children: [] },
    startMapId: "map_proof",
    startPos: { x: 1, y: 1 },
    flags: {},
  };
}

test("focused PlayScene proof covers event page runtime props", async ({ page }) => {
  test.setTimeout(60_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, proofProject());
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitReady(page);
  await page.getByTestId("play-canvas").locator("canvas").click({ force: true });

  const initial = await runtimeState(page);
  await tapKey(page, "ArrowRight");
  await expect.poll(async () => (await runtimeState(page)).variables.var_player_touch ?? 0).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: PLAYER_TOUCH_SHOT, fullPage: true });
  const afterTouch = await runtimeState(page);

  await tapKey(page, "ArrowDown");
  await tapKey(page, "Space");
  await expect.poll(async () => (await runtimeState(page)).events.ev_condition?.pageId).toBe("condition_met");
  await tapKey(page, "ArrowLeft");
  await tapKey(page, "Space");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_action).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_auto).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).variables.var_parallel ?? 0).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await runtimeState(page)).variables.var_event_touch ?? 0).toBeGreaterThanOrEqual(1);

  const beforeMove = initial;
  const normalFrames = await frameSamples(page, "anim_normal");
  const fixedFrames = await frameSamples(page, "anim_fixed");
  await expect.poll(async () => notAt((await runtimeState(page)).events.move_custom, 6, 4)).toBe(true);
  await expect.poll(async () => notAt((await runtimeState(page)).events.move_random, 8, 4)).toBe(true);
  await expect.poll(async () => notAt((await runtimeState(page)).events.move_approach, 10, 4)).toBe(true);
  await page.screenshot({ path: MOVEMENT_SHOT, fullPage: true });

  const final = await runtimeState(page);
  const below = await sampleSprite(page, "depth_below");
  const above = await sampleSprite(page, "depth_above");
  const editor = await editorRows(page);
  const results: Record<string, Result> = {
    "conditions-switch-variable-item-actor": { status: final.events.ev_condition?.pageId === "condition_met" ? "pass" : "fail", evidence: { page: final.events.ev_condition, inventory: final.inventory, partyActorIds: final.partyActorIds } },
    "trigger-action": { status: final.switches.sw_action ? "pass" : "fail", evidence: { sw_action: final.switches.sw_action } },
    "trigger-playerTouch": { status: (afterTouch.variables.var_player_touch ?? 0) >= 1 ? "pass" : "fail", evidence: { start: initial.player, after: afterTouch.player, count: afterTouch.variables.var_player_touch } },
    "trigger-eventTouch": { status: (final.variables.var_event_touch ?? 0) >= 1 ? "pass" : "fail", evidence: { count: final.variables.var_event_touch } },
    "trigger-auto": { status: final.switches.sw_auto ? "pass" : "fail", evidence: { sw_auto: final.switches.sw_auto } },
    "trigger-parallel": { status: (final.variables.var_parallel ?? 0) >= 1 ? "pass" : "fail", evidence: { count: final.variables.var_parallel } },
    "priority-depth": { status: below.depth < above.depth ? "pass" : "fail", evidence: { below, above } },
    "overlap-player-movement-hook": { status: afterTouch.player.x === initial.player.x && afterTouch.player.y === initial.player.y ? "pass" : "fail", evidence: { start: initial.player, afterTouch: afterTouch.player } },
    "page-movement-types": { status: at(final.events.move_fixed, 4, 4) && notAt(final.events.move_custom, 6, 4) && notAt(final.events.move_random, 8, 4) && notAt(final.events.move_approach, 10, 4) ? "pass" : "fail", evidence: { before: beforeMove.events, after: final.events } },
    "animation-types": { status: new Set(normalFrames.map((item) => item.frame)).size > 1 && new Set(fixedFrames.map((item) => item.frame)).size === 1 ? "pass" : "fail", evidence: { normalFrames, fixedFrames } },
    "implemented-condition-rows-editor": { status: editor.conditionRows >= 4 && editor.disabledRows === 0 ? "pass" : "fail", evidence: editor },
    "zebra-rows": { status: new Set(editor.zebraRows).size > 1 ? "pass" : "fail", evidence: editor },
  };
  await writeFile(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), browser: "Playwright Chromium", results }, null, 2)}\n`, "utf8");
  expect(Object.values(results).every((result) => result.status === "pass")).toBe(true);
});
