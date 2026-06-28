import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

type SeedProject = Project;

type DebugState = {
  project: Project;
};

type RuntimeState = {
  gold: number;
  inventory: Record<string, number>;
  partyActorIds: string[];
  variables: Record<string, number>;
  inputEnabled: boolean;
  running: boolean;
};

test.setTimeout(60_000);

type PickerTarget = {
  readonly tab: 1 | 2 | 3 | 4;
  readonly name: string;
};

const COMMAND_PICKER_TARGETS: Record<string, PickerTarget> = {
  battleProcessing: { tab: 2, name: "전투 처리..." },
  changeGold: { tab: 1, name: "소지금 변경..." },
  changeItem: { tab: 1, name: "아이템 변경..." },
  changeParty: { tab: 1, name: "파티 멤버 변경..." },
  choices: { tab: 1, name: "선택지 표시..." },
  fork: { tab: 3, name: "조건 분기..." },
  gameOver: { tab: 3, name: "게임 오버" },
  inputNumber: { tab: 1, name: "숫자 입력..." },
  moveEvent: { tab: 2, name: "이동 경로 설정..." },
  playAudio: { tab: 3, name: "BGM 재생..." },
  setSwitch: { tab: 1, name: "스위치 조작..." },
  setVariable: { tab: 1, name: "변수 조작..." },
  showPicture: { tab: 2, name: "그림 표시..." },
  text: { tab: 1, name: "문장 표시..." },
  timer: { tab: 1, name: "타이머 조작..." },
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
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
    { x: 0.68, y: 0.72 },
  ];
  const failures: string[] = [];
  for (const candidate of candidates) {
    await canvas.dblclick({ position: { x: Math.floor(box.width * candidate.x), y: Math.floor(box.height * candidate.y) } });
    const emptyLine = page.getByTestId("event-command-empty-line");
    try {
      await emptyLine.waitFor({ state: "visible", timeout: 1_000 });
      return;
    } catch (error) {
      failures.push(`${candidate.x},${candidate.y}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`event editor did not open from any candidate map point: ${failures.join(" | ")}`);
}

async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await runtimeTapKey(page, key, holdMs);
}

async function seedProject(page: Page, project: SeedProject): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project);
}

async function addRootCommand(page: Page, kind: string): Promise<void> {
  const target = COMMAND_PICKER_TARGETS[kind];
  if (!target) throw new Error(`missing command picker target for ${kind}`);
  await addRootCommandByPickerTarget(page, target);
}

async function addRootCommandByPickerTarget(page: Page, target: PickerTarget): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  const emptyLine = page.getByTestId("event-command-empty-line");
  await expect(emptyLine).toBeVisible();
  await emptyLine.dblclick();
  const picker = page.getByTestId("event-command-picker");
  if ((await picker.count()) === 0) {
    await page.evaluate(() => {
      const target = document.querySelector('[data-testid="event-command-empty-line"]');
      if (!target) throw new Error("missing empty command line");
      target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });
  }
  await expect(picker).toBeVisible();
  if (target.tab !== 1) await picker.getByTestId(`event-command-picker-tab-${target.tab}`).click({ force: true });
  await picker.getByRole("button", { name: target.name, exact: true }).click({ force: true });
  if (target.name === "문장 표시...") {
    const dialog = page.getByTestId("event-command-text-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("event-command-text-body").fill("Auto text");
    await dialog.getByTestId("event-command-text-ok").click();
    await expect(dialog).toBeHidden();
  } else if (target.name === "선택지 표시...") {
    const dialog = page.getByTestId("event-command-choices-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("choices-ok").click();
    await expect(dialog).toBeHidden();
  }
  await expect(picker).toHaveCount(0);
}

async function openCommandEditor(page: Page, kind: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const command = page.getByTestId(`event-command-${kind}`).first();
    try {
      await expect(command).toBeVisible({ timeout: 5_000 });
      await command.locator(".cmd-head").dblclick({ timeout: 5_000 });
      await expect(command).toHaveClass(/editing/, { timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        if (error instanceof Error) throw error;
        throw new Error(String(error));
      }
    }
  }
}

async function editCommand(page: Page, kind: string, action: (command: Locator) => Promise<void>): Promise<void> {
  await openCommandEditor(page, kind);
  await action(page.getByTestId(`event-command-${kind}`).first());
}

async function applyEventEditor(page: Page): Promise<void> {
  const modal = page.getByTestId("event-editor-modal");
  await expect(modal).toBeVisible();
  await modal.getByTestId("event-editor-apply").click();
  await expect(page.getByTestId("event-editor-diff")).toContainText("변경 없음");
}

function makeBattleProject(): SeedProject {
  return {
    version: 3,
    meta: { title: "Battle Command", author: "e2e", terms: { gold: "G" } },
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
      troops: [{ id: "troop_slime", name: "Slime", enemyIds: [], members: [], autoAlign: true, battleEventPages: [] }],
      states: [],
      battleAnimations: [],
    },
    system: { startActorIds: [], initialTroopId: "troop_slime" },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_cmd: {
        id: "map_cmd",
        name: "Commands",
        width: 2,
        height: 2,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: [0, 0, 1, 0],
        upperTiles: [-1, -1, -1, -1],
        events: [
          {
            id: "ev_battle",
            x: 0,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page_battle",
                name: "Battle",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: false }],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_cmd", children: [] },
    startMapId: "map_cmd",
    startPos: { x: 0, y: 0 },
    flags: {},
  };
}

test("event command insert row adds typed commands to the active page", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);
  await expect(page.getByTestId("event-command-empty-line")).toBeVisible();

  const kinds = [
    "text",
    "choices",
    "setSwitch",
    "setVariable",
    "fork",
    "timer",
    "moveEvent",
    "showPicture",
    "playAudio",
    "battleProcessing",
    "changeGold",
    "changeItem",
    "changeParty",
    "gameOver",
  ];
  for (const kind of kinds) await addRootCommand(page, kind);

  await applyEventEditor(page);
  const state = await debugState(page);
  // freshProject=1 사용 시 시작 맵에 사전 정의된 이벤트(starterMapObjects)가
  // events[0]에 존재할 수 있다. 클릭으로 새로 만든 이벤트(ev_ 접두사)를 찾아 검증.
  const events = state.project.maps[state.project.startMapId].events;
  const authored = events.find((event) => event.id.startsWith("ev_")) ?? events[0];
  const commands = authored.pages?.[0].commands ?? [];
  for (const kind of [
    "text",
    "choices",
    "setSwitch",
    "setVariable",
    "fork",
    "timer",
    "moveEvent",
    "showPicture",
    "playAudio",
    "battleProcessing",
    "changeGold",
    "changeItem",
    "changeParty",
    "gameOver",
  ]) {
    expect(commands.some((command) => command.kind === kind)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("event-command-catalog.png"), fullPage: true });
});

test("m2 PDF catalog commands are selectable, editable, and persisted", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);
  await expect(page.getByTestId("event-command-empty-line")).toBeVisible();

  await addRootCommandByPickerTarget(page, { tab: 3, name: "주석..." });
  const command = page.getByTestId("event-command-m2Command");
  await expect(command).toContainText("주석");
  await command.locator(".cmd-head").dblclick();
  await command.getByTestId("m2-command-comment-textarea").fill("QA note");
  await command.getByTestId("m2-command-comment-textarea").blur();

  await applyEventEditor(page);
  const state = await debugState(page);
  const events = state.project.maps[state.project.startMapId].events;
  const authored = events.find((event) => event.id.startsWith("ev_")) ?? events[0];
  const commands = authored.pages?.[0].commands ?? [];
  expect(
    commands.some(
      (entry) =>
        entry.kind === "m2Command" &&
        entry.commandId === "m2-088-comment" &&
        entry.fields.comment === "QA note"
    )
  ).toBe(true);
  await command.locator(".cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
  await page.screenshot({ path: testInfo.outputPath("m2-pdf-command-editor.png"), fullPage: true });
});

test("event command detail editors persist battle, money, item, and party settings", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);

  for (const kind of ["battleProcessing", "changeGold", "changeItem", "changeParty"]) await addRootCommand(page, kind);

  await editCommand(page, "battleProcessing", async (command) => {
    await command.getByTestId("battle-processing-troop-select").selectOption({ index: 1 });
  });
  await editCommand(page, "battleProcessing", async (command) => {
    await command.getByTestId("battle-processing-escape-checkbox").uncheck();
  });
  await editCommand(page, "battleProcessing", async (command) => {
    await command.getByTestId("battle-processing-lose-checkbox").check();
  });

  await editCommand(page, "changeGold", async (command) => {
    await command.getByTestId("change-gold-op-select").selectOption("-=");
  });
  await editCommand(page, "changeGold", async (command) => {
    await command.getByTestId("change-gold-amount-input").fill("25");
    await command.getByTestId("change-gold-amount-input").blur();
  });

  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-select").selectOption({ index: 1 });
  });
  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-op-select").selectOption("+=");
  });
  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-amount-input").fill("2");
    await command.getByTestId("change-item-amount-input").blur();
  });

  await editCommand(page, "changeParty", async (command) => {
    await command.getByTestId("change-party-actor-select").selectOption({ index: 1 });
  });
  await editCommand(page, "changeParty", async (command) => {
    await command.getByTestId("change-party-action-select").selectOption("remove");
  });

  await applyEventEditor(page);
  const state = await debugState(page);
  const events = state.project.maps[state.project.startMapId].events;
  const authored = events.find((event) => event.id.startsWith("ev_")) ?? events[0];
  const commands = authored.pages?.[0].commands ?? [];
  expect(commands.some((command) => command.kind === "battleProcessing" && command.troopId && command.canEscape === false && command.canLose === true)).toBe(true);
  expect(commands.some((command) => command.kind === "changeGold" && command.op === "-=" && command.amount === 25)).toBe(true);
  expect(commands.some((command) => command.kind === "changeItem" && command.itemId && command.op === "+=" && command.amount === 2)).toBe(true);
  expect(commands.some((command) => command.kind === "changeParty" && command.actorId && command.action === "remove")).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("event-command-detail-editors.png"), fullPage: true });
});

test("move event route editor persists route steps", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);

  await addRootCommand(page, "moveEvent");
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-event-id-input").fill("npc_1");
    await command.getByTestId("move-route-event-id-input").blur();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-repeat-checkbox").check();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-switch-id-input").fill("sw_cmd_route");
    await command.getByTestId("move-route-graphic-id-input").fill("npc_villager");
    await command.getByTestId("move-route-sound-id-input").fill("se_cursor");
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-move-up").click();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-move-upper-right").click();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-turn-90-left-or-right").click();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-through-on").click();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-switch-on").click();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-change-graphic").click();
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-play-se").click();
  });

  await applyEventEditor(page);
  const state = await debugState(page);
  const events = state.project.maps[state.project.startMapId].events;
  const authored = events.find((event) => event.id.startsWith("ev_")) ?? events[0];
  const moveCommand = authored.pages?.[0].commands.find((command) => command.kind === "moveEvent");
  expect(moveCommand?.eventId).toBe("npc_1");
  expect(moveCommand?.route?.repeat).toBe(true);
  expect(moveCommand?.route?.moves).toEqual([
    { kind: "move", dir: "up" },
    { kind: "moveDiagonal", horizontal: "right", vertical: "up" },
    { kind: "turnRelative", turn: "leftOrRight90" },
    { kind: "setThrough", enabled: true },
    { kind: "setSwitch", switchId: "sw_cmd_route", value: true },
    { kind: "changeGraphic", spriteId: "npc_villager" },
    { kind: "playSe", resourceId: "se_cursor" },
  ]);
  await page.screenshot({ path: testInfo.outputPath("move-route-editor.png"), fullPage: true });
});

test("editor-created money, item, and party commands affect play mode state", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);

  for (const kind of ["changeGold", "changeItem", "changeParty"]) await addRootCommand(page, kind);
  await editCommand(page, "changeGold", async (command) => {
    await command.getByTestId("change-gold-op-select").selectOption("+=");
  });
  await editCommand(page, "changeGold", async (command) => {
    await command.getByTestId("change-gold-amount-input").fill("40");
    await command.getByTestId("change-gold-amount-input").blur();
  });
  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-select").selectOption({ index: 1 });
  });
  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-op-select").selectOption("+=");
  });
  await editCommand(page, "changeItem", async (command) => {
    await command.getByTestId("change-item-amount-input").fill("2");
    await command.getByTestId("change-item-amount-input").blur();
  });
  await editCommand(page, "changeParty", async (command) => {
    await command.getByTestId("change-party-actor-select").selectOption({ index: 1 });
  });
  await editCommand(page, "changeParty", async (command) => {
    await command.getByTestId("change-party-action-select").selectOption("add");
  });

  await applyEventEditor(page);
  const stateBeforePlay = await debugState(page);
  const project = stateBeforePlay.project;
  const authored = project.maps[project.startMapId].events.find((event) =>
    event.pages?.[0].commands.some((command) => command.kind === "changeGold")
  );
  const commands = authored?.pages?.[0].commands ?? [];
  const itemCommand = commands.find((command) => command.kind === "changeItem");
  const partyCommand = commands.find((command) => command.kind === "changeParty");
  if (!itemCommand?.itemId || !partyCommand?.actorId) throw new Error("missing authored item or party command");
  if (!authored?.pages?.[0]) throw new Error("missing authored event page");
  const playable = makeBattleProject();
  playable.database.actors = project.database.actors;
  playable.database.items = project.database.items;
  playable.maps.map_cmd.events = [{
    id: authored.id,
    x: 0,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      ...authored.pages[0],
      id: "page_authored_runtime",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: authored.pages[0].commands,
    }],
  }];

  await page.getByTestId("event-editor-modal-close").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await seedProject(page, playable);
  const seededForPlay = await debugState(page);
  const playableEvent = seededForPlay.project.maps[seededForPlay.project.startMapId].events.find((event) =>
    event.pages?.[0].commands.some((command) => command.kind === "changeGold")
  );
  expect(playableEvent?.pages?.[0].trigger.kind).toBe("action");
  expect(playableEvent?.pages?.[0].commands.some((command) => command.kind === "changeGold")).toBe(true);
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");
  await expect.poll(async () => (await runtimeState(page)).gold).toBe(40);
  const runtime = await runtimeState(page);
  expect(runtime.inventory[itemCommand.itemId]).toBe(2);
  expect(runtime.partyActorIds).toContain(partyCommand.actorId);
  await page.screenshot({ path: testInfo.outputPath("editor-created-money-item-party-runtime.png"), fullPage: true });
});

test("input number command stores runtime entry in the selected variable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);

  await addRootCommand(page, "inputNumber");
  await editCommand(page, "inputNumber", async (command) => {
    await command.getByTestId("event-variable-picker-open").click();
    const picker = page.getByTestId("event-record-picker");
    await expect(picker).toBeVisible();
    await picker.getByTestId("event-record-picker-add").click();
    await picker.getByTestId("event-record-picker-row-1").click();
    await picker.getByTestId("event-record-picker-ok").click();
    await command.locator(".cmd-head").dblclick();
    await expect(command).toHaveClass(/editing/);
    await command.getByTestId("input-number-digits").fill("4");
    await command.getByTestId("input-number-digits").blur();
  });

  await applyEventEditor(page);
  const stateBeforePlay = await debugState(page);
  const project = stateBeforePlay.project;
  const authored = project.maps[project.startMapId].events.find((event) =>
    event.pages?.[0].commands.some((command) => command.kind === "inputNumber")
  );
  const inputCommand = authored?.pages?.[0].commands.find((command) => command.kind === "inputNumber");
  if (!authored?.pages?.[0] || !inputCommand || inputCommand.kind !== "inputNumber") {
    throw new Error("missing authored input number command");
  }

  const playable = makeBattleProject();
  playable.variables = project.variables;
  playable.maps.map_cmd.events = [{
    id: authored.id,
    x: 0,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      ...authored.pages[0],
      id: "page_input_number_runtime",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [inputCommand],
    }],
  }];

  await page.getByTestId("event-editor-modal-close").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await seedProject(page, playable);
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");
  await expect(page.getByTestId("runtime-input-number")).toBeVisible();
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await page.keyboard.press("3");
  await page.keyboard.press("4");
  await page.keyboard.press("Enter");

  await expect.poll(async () => (await runtimeState(page)).variables[inputCommand.variableId]).toBe(1234);
  await expect(page.getByTestId("runtime-input-number")).toHaveCount(0);
  await expect.poll(async () => {
    const state = await runtimeState(page);
    return state.inputEnabled === true && state.running === false;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("input-number-runtime.png"), fullPage: true });
});

test("battleProcessing command hands off to a battle scene marker in play mode", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, makeBattleProject());
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");
  await expect(page.getByTestId("battle-scene")).toContainText("Slime");
  await page.screenshot({ path: testInfo.outputPath("battle-command.png"), fullPage: true });
});
