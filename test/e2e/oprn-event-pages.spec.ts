import { expect, test, type Page } from "@playwright/test";
import { expandEventConditions, expandEventMovementSection } from "./eventEditorExpandHelpers";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

test.setTimeout(60_000);

type EventPageExport = {
  id: string;
  name: string;
  conditions: {
    kind: string;
    switchId?: string;
    variableId?: string;
    actorId?: string;
    itemId?: string;
    op?: string;
    value?: boolean | number;
    present?: boolean;
  }[];
  graphic: { sprite?: { id: string } };
  trigger: { kind: string };
  priority: string;
  movement?: {
    type: string;
    speed: number;
    frequency: number;
    route?: {
      repeat: boolean;
      moves: {
        kind: string;
        dir?: string;
        switchId?: string;
        spriteId?: string;
        resourceId?: string;
        value?: boolean;
        delta?: number;
      }[];
    };
  };
  commands: { kind: string; body?: string }[];
};

type DebugState = {
  project: {
    startMapId: string;
    maps: Record<string, { events: { pages?: EventPageExport[] }[] }>;
  };
};

type RuntimeState = {
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
  readonly inventory: Record<string, number>;
  readonly partyActorIds: string[];
  readonly variables: Record<string, number>;
};

type SeedProject = Project;
type MutableEvent = GameEvent & { pages: EventPage[] };
type MutableEventFixture = Project & {
  readonly maps: Project["maps"] & {
    readonly map_page: GameMap & {
      readonly events: MutableEvent[];
    };
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

// freshProject 사용 시 시작 맵에 사전 정의된 이벤트(starterMapObjects)가 있을 수 있다.
// 클릭으로 새로 만든 이벤트(ev_ 접두사)를 우선 반환한다.
function authoredEvent(state: DebugState): DebugState["project"]["maps"][string]["events"][number] | undefined {
  const events = state.project.maps[state.project.startMapId].events;
  return events.find((event) => "id" in event && typeof event.id === "string" && event.id.startsWith("ev_")) ?? events[0];
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const candidates = [
    { x: 0.2, y: 0.45 },
    { x: 0.25, y: 0.75 },
    { x: 0.35, y: 0.72 },
    { x: 0.18, y: 0.62 },
    { x: 0.5, y: 0.5 },
  ];
  const failures: string[] = [];
  for (const candidate of candidates) {
    await canvas.dblclick({ position: { x: Math.floor(box.width * candidate.x), y: Math.floor(box.height * candidate.y) } });
    const pageTabs = page.getByTestId("event-page-tabs");
    try {
      await pageTabs.waitFor({ state: "visible", timeout: 1_000 });
      return;
    } catch (error) {
      failures.push(`${candidate.x},${candidate.y}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`event editor did not open from any candidate map point: ${failures.join(" | ")}`);
}

async function expectClassicSettingsVisible(page: Page): Promise<void> {
  await expandEventMovementSection(page);
  const footer = page.locator(".event-editor-modal-footer");
  const movementType = page.getByTestId("event-classic-movement-type");
  const movementSpeed = page.getByTestId("event-classic-movement-speed");
  await expect(movementType).toBeVisible();
  await expect(movementSpeed).toBeVisible();
  const [footerBox, typeBox, speedBox] = await Promise.all([
    footer.boundingBox(),
    movementType.boundingBox(),
    movementSpeed.boundingBox(),
  ]);
  if (!footerBox || !typeBox || !speedBox) {
    throw new Error("classic event editor setting geometry was not measurable");
  }
  expect(typeBox.y + typeBox.height).toBeLessThanOrEqual(footerBox.y);
  expect(speedBox.y + speedBox.height).toBeLessThanOrEqual(footerBox.y);
}

async function expectEventEditorTitlebarDragMovesWindow(page: Page): Promise<void> {
  const modal = page.getByTestId("event-editor-modal").locator(".event-editor-modal-window");
  const titlebar = page.getByTestId("event-editor-titlebar");
  await expect(modal).toBeVisible();
  const before = await modal.boundingBox();
  const handle = await titlebar.boundingBox();
  if (!before || !handle) throw new Error("event editor modal geometry was not measurable");

  await page.mouse.move(handle.x + 80, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 180, handle.y + handle.height / 2 + 40);
  await page.mouse.up();

  const after = await modal.boundingBox();
  if (!after) throw new Error("event editor modal geometry was not measurable after drag");
  expect(after.x).toBeGreaterThanOrEqual(0);
  expect(after.y).toBeGreaterThan(before.y + 20);
}

async function addTextCommand(page: Page, body: string): Promise<void> {
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-page-tabs")).toBeVisible();
  const emptyLine = page.getByTestId("event-command-empty-line");
  await expect(emptyLine).toBeVisible({ timeout: 10_000 });
  await emptyLine.dblclick();

  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("command-picker-add-text").click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("event-command-text-body").fill(body);
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect(dialog).toBeHidden();
  await expect(picker).toBeHidden();
  await expect(page.getByTestId("event-command-text").filter({ hasText: body })).toBeVisible();
}

async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  // 공유 헬퍼로 위임 — headless 입력 주입 + 브라우저 폴백.
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await runtimeTapKey(page, key, holdMs);
}

function loadEventFixture(): MutableEventFixture {
  return {
    version: 3,
    meta: { title: "Runtime Event Pages", author: "e2e", terms: { gold: "G" } },
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
    switches: [{ id: "sw_page", name: "Page switch" }],
    variables: [{ id: "var_rank", name: "Rank" }],
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
      map_page: {
        id: "map_page",
        name: "Pages",
        width: 2,
        height: 2,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: [0, 0, 1, 0],
        upperTiles: [-1, -1, -1, -1],
        events: [
          {
            id: "ev_page",
            x: 0,
            y: 1,
            trigger: { kind: "action" },
            commands: [{ kind: "text", body: "legacy" }],
            pages: [
              {
                id: "page_1",
                name: "Base page",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [
                  { kind: "setSwitch", switchId: "sw_page", value: true },
                  { kind: "text", body: "page 1" },
                ],
              },
              {
                id: "page_2",
                name: "Switch page",
                conditions: [
                  { kind: "switch", switchId: "sw_page", value: true },
                  { kind: "variable", variableId: "var_rank", op: ">=", value: 3 },
                  { kind: "actor", actorId: "actor_hero", present: true },
                  { kind: "item", itemId: "item_key", present: true },
                ],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [{ kind: "text", body: "page 2" }],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_page", children: [] },
    startMapId: "map_page",
    startPos: { x: 0, y: 0 },
    flags: {},
  } satisfies MutableEventFixture;
}

async function seedProject(page: Page, project: SeedProject): Promise<void> {
  await seedProjectForEditor(page, project);
}

test("event editor manages RM2K3-style pages with conditions and page-owned text", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);
  await expect(page.getByTestId("event-page-tabs")).toBeVisible();
  await expect(page.getByTestId("event-page-tab-1")).toBeVisible();
  await expectEventEditorTitlebarDragMovesWindow(page);
  await expectClassicSettingsVisible(page);
  await page.getByTestId("event-command-empty-line").click();
  await expect(page.getByTestId("event-command-picker")).toHaveCount(0);

  await addTextCommand(page, "Page one");

  await expect(page.getByTestId("event-page-add")).toBeVisible();
  await page.getByTestId("event-page-add").click();
  await expect.poll(async () => page.getByTestId("event-page-tab-2").count()).toBe(1);
  await expect(page.getByTestId("event-page-tab-2")).toBeVisible();
  await page.getByTestId("event-page-name-input").fill("Switch Page");
  await page.getByTestId("event-page-name-input").blur();
  await expandEventMovementSection(page);
  await page.getByTestId("event-page-trigger-select").selectOption("action");
  await page.getByTestId("event-page-priority-select").selectOption("above");
  await page.getByTestId("event-page-movement-type").selectOption("custom");
  await page.getByTestId("event-page-movement-speed-select").selectOption("4");
  await expectClassicSettingsVisible(page);
  await page.getByTestId("event-page-custom-route").click();
  const routeDialog = page.getByTestId("event-page-move-route-dialog");
  await expect(routeDialog).toBeVisible();
  await expect(routeDialog).toContainText("이동 경로");
  await expect(routeDialog.getByTestId("event-page-move-route-add-move-right")).toHaveText("오른쪽으로 이동");
  await expect(routeDialog.getByTestId("event-page-move-route-add-wait")).toHaveText("대기");
  await routeDialog.getByTestId("event-page-move-route-frequency-5").check();
  await routeDialog.getByTestId("event-page-move-route-repeat").check();
  await routeDialog.getByTestId("event-page-move-route-switch-id").fill("sw_page");
  await routeDialog.getByTestId("event-page-move-route-graphic-id").fill("tex_easyrpg_charset_people1");
  await routeDialog.getByTestId("event-page-move-route-sound-id").fill("se_cursor");
  const addRouteCommand = async (id: string) => {
    const button = routeDialog.getByTestId(`event-page-move-route-add-${id}`);
    await expect(button).toBeEnabled();
    await button.click();
  };
  for (const id of [
    "move-up",
    "turn-up",
    "jump",
    "move-right",
    "turn-right",
    "land",
    "move-down",
    "turn-down",
    "direction-fix-on",
    "move-left",
    "turn-left",
    "direction-fix-off",
    "move-upper-right",
    "turn-90-right",
    "through-on",
    "move-lower-right",
    "turn-90-left",
    "through-off",
    "move-lower-left",
    "turn-180",
    "animation-off",
    "move-upper-left",
    "turn-90-left-or-right",
    "animation-on",
    "move-random",
    "turn-random",
    "decrease-opacity",
    "move-toward-player",
    "turn-toward-player",
    "increase-opacity",
    "move-away-from-player",
    "turn-away-from-player",
    "switch-on",
    "step-forward",
    "wait",
    "switch-off",
    "increase-speed",
    "increase-frequency",
    "change-graphic",
    "decrease-speed",
    "decrease-frequency",
    "play-se",
  ]) {
    await addRouteCommand(id);
  }
  await expect(routeDialog.getByTestId("event-page-move-route-command-list")).toContainText("오른쪽 이동");
  await expect(routeDialog.getByTestId("event-page-move-route-command-list")).toContainText("오른쪽 위 이동");
  await expect(routeDialog.getByTestId("event-page-move-route-command-list")).toContainText("스위치 sw_page ON");
  await expect(routeDialog.getByTestId("event-page-move-route-command-list")).toContainText("스위치 sw_page OFF");
  await expect(routeDialog.getByTestId("event-page-move-route-command-list")).toContainText("효과음 se_cursor");
  await routeDialog.getByTestId("event-page-move-route-ok").click();
  await expect(routeDialog).toBeHidden();
  await expect(page.getByTestId("event-page-movement-route-summary")).toContainText("오른쪽 이동");
  await expandEventConditions(page);
  await page.getByTestId("event-page-sprite-input").fill("tex_easyrpg_charset_people1");
  await page.getByTestId("event-page-sprite-input").blur();
  await page.getByTestId("event-page-switch-condition-input").fill("sw_page");
  await page.getByTestId("event-page-switch-condition-input").blur();
  await page.getByTestId("event-page-variable-condition-input").fill("var_rank");
  await page.getByTestId("event-page-variable-condition-input").blur();
  await page.getByTestId("event-page-variable-condition-op").selectOption(">=");
  await page.getByTestId("event-page-variable-condition-value").fill("3");
  await page.getByTestId("event-page-variable-condition-value").blur();
  await page.getByTestId("event-page-actor-condition-input").fill("actor_hero");
  await page.getByTestId("event-page-actor-condition-input").blur();
  await page.getByTestId("event-page-item-condition-input").fill("item_key");
  await page.getByTestId("event-page-item-condition-input").blur();
  await addTextCommand(page, "Page two");

  await page.getByTestId("event-page-copy").click();
  await page.getByTestId("event-page-paste").click();
  await expect(page.getByTestId("event-page-tab-3")).toBeVisible();
  await page.getByTestId("event-editor-modal").getByRole("button", { name: "Apply" }).click();

  await expect.poll(async () => {
    const state = await debugState(page);
    const event = authoredEvent(state);
    return event?.pages?.length ?? 0;
  }).toBe(3);

  const state = await debugState(page);
  const event = authoredEvent(state);
  if (!event) throw new Error("authored event not found");
  const pages = event.pages ?? [];
  const switchPage = pages.find((item) => item.name.includes("Switch Page"));
  const savedMoves = switchPage?.movement?.route?.moves ?? [];
  expect(savedMoves.map((move) => move.kind)).toEqual(expect.arrayContaining([
    "move",
    "turn",
    "jump",
    "land",
    "moveDiagonal",
    "turnRelative",
    "setDirectionFix",
    "setThrough",
    "setAnimation",
    "moveRandom",
    "turnRandom",
    "changeOpacity",
    "moveTowardPlayer",
    "turnTowardPlayer",
    "moveAwayFromPlayer",
    "turnAwayFromPlayer",
    "setSwitch",
    "stepForward",
    "wait",
    "changeSpeed",
    "changeFrequency",
    "changeGraphic",
    "playSe",
  ]));
  expect(savedMoves.some((move) => move.kind === "setSwitch" && move.value === false)).toBe(true);
  expect(savedMoves.some((move) => move.kind === "changeSpeed" && move.delta === -1)).toBe(true);
  expect(savedMoves.some((move) => move.kind === "changeFrequency" && move.delta === -1)).toBe(true);
  expect(pages.some((item) => item.commands.some((command) => command.body === "Page one"))).toBe(true);
  expect(pages.some((item) =>
    item.name.includes("Switch Page") &&
    item.conditions.some((condition) => condition.kind === "switch" && condition.switchId === "sw_page") &&
    item.conditions.some((condition) => condition.kind === "variable" && condition.variableId === "var_rank" && condition.value === 3) &&
    item.conditions.some((condition) => condition.kind === "actor" && condition.actorId === "actor_hero" && condition.present === true) &&
    item.conditions.some((condition) => condition.kind === "item" && condition.itemId === "item_key" && condition.present === true) &&
    item.graphic.sprite?.id === "tex_easyrpg_charset_people1" &&
    item.priority === "above" &&
    item.movement?.type === "custom" &&
    item.movement?.speed === 4 &&
    item.movement?.frequency === 5 &&
    item.movement?.route?.repeat === true &&
    item.movement?.route?.moves.some((move) => move.kind === "move" && move.dir === "right") &&
    item.movement?.route?.moves.some((move) => move.kind === "moveDiagonal") &&
    item.movement?.route?.moves.some((move) => move.kind === "setSwitch" && move.switchId === "sw_page") &&
    item.movement?.route?.moves.some((move) => move.kind === "changeGraphic" && move.spriteId === "tex_easyrpg_charset_people1") &&
    item.movement?.route?.moves.some((move) => move.kind === "playSe" && move.resourceId === "se_cursor") &&
    item.movement?.route?.moves.some((move) => move.kind === "wait") &&
    item.commands.some((command) => command.body === "Page two")
  )).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("event-pages.png"), fullPage: true });
});

test("play mode resolves the highest matching event page", async ({ page }) => {
  const seeded = loadEventFixture();
  const event = seeded.maps.map_page.events[0];
  event.x = 0;
  event.y = 1;
  seeded.maps.map_page.lowerTiles[2] = 1;
  event.pages[0].commands = [
    { kind: "setSwitch", switchId: "sw_page", value: true },
    { kind: "setVariable", variableId: "var_rank", op: "=", value: 3 },
    { kind: "changeItem", itemId: "item_key", op: "+=", amount: 1 },
    { kind: "changeParty", actorId: "actor_hero", action: "add" },
    { kind: "text", body: "page 1" },
  ];
  event.pages[1].commands = [{ kind: "text", body: "page 2" }];

  await seedProject(page, seeded);
  const seededState = await debugState(page);
  expect(seededState.project.startMapId).toBe("map_page");
  expect(seededState.project.maps.map_page.events[0].pages?.length).toBe(2);
  await page.click('[data-testid="mode-play"]');
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  await page.getByTestId("play-canvas").locator("canvas").click();

  await tapKey(page, "Space");
  await expect(page.getByTestId("dialogue-box")).toContainText("page 1");
  await page.getByTestId("dialogue-box").click();
  await expect.poll(async () => (await runtimeState(page)).variables.var_rank).toBe(3);
  let runtime = await runtimeState(page);
  expect(runtime.inventory.item_key).toBe(1);
  expect(runtime.partyActorIds).toContain("actor_hero");
  await expect(page.getByTestId("dialogue-box")).toHaveCount(0);

  await tapKey(page, "ArrowRight");
  await expect.poll(async () => (await runtimeState(page)).player.x).toBe(1);
  await tapKey(page, "ArrowLeft");
  await expect.poll(async () => (await runtimeState(page)).player.x).toBe(0);
  await tapKey(page, "ArrowDown");
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  await tapKey(page, "Space");
  await expect(page.getByTestId("dialogue-box")).toContainText("page 2");
  runtime = await runtimeState(page);
  expect(runtime.variables.var_rank).toBe(3);
  expect(runtime.inventory.item_key).toBe(1);
  expect(runtime.partyActorIds).toContain("actor_hero");
  await page.click('[data-testid="mode-edit"]');
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
});
