import { expect, test, type Page } from "@playwright/test";
import type { EventPage, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

type RuntimeState = {
  readonly mapId: string;
  readonly inputEnabled: boolean;
  readonly running: boolean;
  readonly player: { readonly x: number; readonly y: number };
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly gold: number;
  readonly inventory: Record<string, number>;
  readonly partyActorIds: string[];
  readonly events: Record<
    string,
    {
      readonly x: number;
      readonly y: number;
      readonly pageId?: string;
      readonly priority: string;
      readonly trigger: string;
    }
  >;
};

type DebugState = {
  readonly project: Project;
};

const PASSABLE = { up: true, down: true, left: true, right: true };

function eventPage(
  id: string,
  trigger: EventPage["trigger"],
  priority: EventPage["priority"],
  commands: EventPage["commands"],
  options: {
    readonly conditions?: EventPage["conditions"];
    readonly spriteId?: string;
    readonly movement?: EventPage["movement"];
  } = {}
): EventPage {
  return {
    id,
    name: id,
    conditions: options.conditions ?? [],
    graphic: options.spriteId ? { sprite: { type: "bundled", id: options.spriteId } } : {},
    trigger,
    priority,
    movement: options.movement ?? { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

async function seedProject(page: Page, project: Project): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project);
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await runtimeTapKey(page, key, holdMs);
}

function runtimeProject(): Project {
  return {
    version: 3,
    meta: { title: "T9 Runtime", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        npc_base: { id: "npc_base", image: { type: "bundled", id: "tex_npc_base" }, frames: 8, frameWidth: 32, frameHeight: 32 },
        npc_alt: { id: "npc_alt", image: { type: "bundled", id: "tex_npc_alt" }, frames: 8, frameWidth: 32, frameHeight: 32 },
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
    switches: [
      { id: "sw_auto", name: "Autorun complete" },
      { id: "sw_common_auto", name: "Common autorun complete" },
      { id: "sw_page", name: "Page swap" },
    ],
    variables: [
      { id: "var_parallel", name: "Parallel ticks" },
      { id: "var_common_parallel", name: "Common parallel ticks" },
      { id: "var_touch", name: "Touch count" },
    ],
    commonEvents: [
      {
        id: "ce_auto",
        name: "공용 자동 실행",
        trigger: "auto",
        commands: [
          { kind: "setSwitch", switchId: "sw_common_auto", value: true },
          { kind: "changeGold", op: "+=", amount: 40 },
          { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
          { kind: "changeParty", actorId: "actor_hero", action: "add" },
        ],
      },
      {
        id: "ce_parallel",
        name: "공용 병렬 처리",
        trigger: "parallel",
        commands: [
          { kind: "label", name: "loop" },
          { kind: "wait", ms: 200 },
          { kind: "setVariable", variableId: "var_common_parallel", op: "+=", value: 1 },
          { kind: "gotoLabel", name: "loop" },
        ],
      },
    ],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_runtime: {
        id: "map_runtime",
        name: "Runtime",
        width: 4,
        height: 3,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(12).fill(0),
        upperTiles: new Array<number>(12).fill(-1),
        events: [
          {
            id: "npc-1",
            x: 1,
            y: 0,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              eventPage("npc_base_page", { kind: "action" }, "same", [
                { kind: "setSwitch", switchId: "sw_page", value: true },
                { kind: "text", body: "base page" },
              ], { spriteId: "npc_base" }),
              eventPage("npc_swapped_page", { kind: "action" }, "above", [
                { kind: "text", body: "swapped page" },
              ], {
                conditions: [{ kind: "switch", switchId: "sw_page", value: true }],
                spriteId: "npc_alt",
              }),
            ],
          },
          {
            id: "touch-1",
            x: 0,
            y: 1,
            trigger: { kind: "touch" },
            commands: [],
            pages: [eventPage("touch_page", { kind: "touch" }, "below", [
              { kind: "setVariable", variableId: "var_touch", op: "+=", value: 1 },
            ])],
          },
          {
            id: "autorun-1",
            x: 2,
            y: 0,
            trigger: { kind: "auto" },
            commands: [],
            pages: [eventPage("autorun_page", { kind: "auto" }, "below", [
              { kind: "wait", ms: 350 },
              { kind: "setSwitch", switchId: "sw_auto", value: true },
            ])],
          },
          {
            id: "parallel-1",
            x: 3,
            y: 0,
            trigger: { kind: "parallel" },
            commands: [],
            pages: [eventPage("parallel_page", { kind: "parallel" }, "below", [
              { kind: "label", name: "loop" },
              { kind: "wait", ms: 200 },
              { kind: "setVariable", variableId: "var_parallel", op: "+=", value: 1 },
              { kind: "gotoLabel", name: "loop" },
            ])],
          },
          {
            id: "mover-1",
            x: 2,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("mover_page", { kind: "action" }, "same", [], {
              movement: {
                type: "custom",
                speed: 3,
                frequency: 5,
                route: { moves: [{ kind: "move", dir: "left" }], repeat: false },
              },
            })],
          },
          {
            id: "transfer-1",
            x: 0,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("transfer_page", { kind: "action" }, "same", [
              { kind: "transfer", mapId: "map_two", x: 1, y: 0 },
            ])],
          },
        ],
      },
      map_two: {
        id: "map_two",
        name: "Second",
        width: 3,
        height: 2,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(6).fill(0),
        upperTiles: new Array<number>(6).fill(-1),
        events: [
          {
            id: "hook-1",
            x: 1,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("hook_page", { kind: "action" }, "same", [
              { kind: "showPicture", pictureId: "pic_1", resourceId: "picture_1", x: 0, y: 0 },
              { kind: "playAudio", resourceId: "bgm_1", loop: true },
              { kind: "text", body: "map two hook" },
            ])],
          },
        ],
      },
    },
    mapTree: { mapId: "map_runtime", children: [{ mapId: "map_two", children: [] }] },
    startMapId: "map_runtime",
    startPos: { x: 0, y: 0 },
    flags: {},
  };
}

function missingResourceProject(): Project {
  const project = runtimeProject();
  return {
    ...project,
    maps: {
      ...project.maps,
      map_runtime: {
        ...project.maps.map_runtime,
        events: [
          {
            id: "missing-1",
            x: 1,
            y: 0,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("missing_page", { kind: "action" }, "same", [], { spriteId: "missing_sprite" })],
          },
        ],
      },
    },
  };
}

test("map runtime schedules events without mutating authoring project data", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, runtimeProject());
  const before = await debugState(page);
  expect(before.project.maps.map_runtime.events.find((event) => event.id === "mover-1")?.x).toBe(2);

  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect(page.getByTestId("event-sprite-npc-1")).toBeVisible();

  await page.getByTestId("play-canvas").locator("canvas").click();
  // auto 이벤트(autorun-1)가 맵 진입 즉시 실행되어 input을 잠근다.
  // 실행 중에는 inputEnabled가 false여야 한다(RM2K3 autorun 동작).
  let state = await runtimeState(page);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_auto).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_common_auto).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).gold).toBe(40);
  state = await runtimeState(page);
  expect(state.inventory.item_potion).toBe(2);
  expect(state.partyActorIds).toContain("actor_hero");
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);

  await tapKey(page, "ArrowRight");
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  // (1,0)의 npc-1은 same priority + overlapForbidden이므로 우측 이동을 막는다.
  state = await runtimeState(page);
  expect(state.player).toEqual({ x: 0, y: 0 });

  await tapKey(page, "Space");
  await expect(page.getByTestId("dialogue-box")).toContainText("base page");
  await page.getByTestId("dialogue-box").click();
  await expect.poll(async () => (await runtimeState(page)).events["npc-1"]?.pageId).toBe("npc_swapped_page");
  await tapKey(page, "Space");
  await expect(page.getByTestId("dialogue-box")).toContainText("swapped page");
  await page.getByTestId("dialogue-box").click();

  await tapKey(page, "ArrowDown");
  await expect.poll(async () => (await runtimeState(page)).player.y).toBe(1);
  await expect.poll(async () => (await runtimeState(page)).variables.var_touch).toBe(1);
  await expect.poll(async () => (await runtimeState(page)).variables.var_parallel).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await runtimeState(page)).variables.var_common_parallel).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await runtimeState(page)).events["mover-1"]?.x).toBe(1);

  await tapKey(page, "ArrowDown");
  await tapKey(page, "Space");
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_two");
  state = await runtimeState(page);
  expect(state.player).toEqual({ x: 1, y: 0 });

  await tapKey(page, "Space");
  await expect(page.getByTestId("picture-overlay")).toContainText("pic_1");
  await expect(page.getByTestId("audio-indicator")).toContainText("bgm_1");
  await expect(page.getByTestId("dialogue-box")).toContainText("map two hook");
  await page.screenshot({ path: testInfo.outputPath("map-runtime.png"), fullPage: true });

  await page.getByTestId("mode-edit").click();
  const after = await debugState(page);
  expect(after.project.maps.map_runtime.events.find((event) => event.id === "mover-1")?.x).toBe(2);
  expect(after.project.maps.map_runtime.lowerTiles).toEqual(before.project.maps.map_runtime.lowerTiles);
});

test("map runtime reports missing page graphics", async ({ page }) => {
  await seedProject(page, missingResourceProject());
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("missing-resource-error")).toContainText("missing_sprite");
});
