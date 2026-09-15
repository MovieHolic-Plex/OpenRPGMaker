import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop4-low-level-core";

type RuntimeState = {
  readonly inputEnabled: boolean;
  readonly running: boolean;
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly timers: Record<string, number>;
  readonly flags: Record<string, boolean>;
  readonly events: Record<string, { readonly pageId?: string }>;
};

type DebugState = {
  readonly project: Project;
};

const PASSABLE = { up: true, down: true, left: true, right: true };

test.setTimeout(90_000);

test("loop4 certifies quest-grade low-level event parts in editor and runtime", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProjectFromSupabaseCanonical(page, lowLevelProject());
  await writeJson("000-scenario.json", {
    runId: "loop4-low-level-core",
    scope: [
      "setSwitch, setVariable, fork, label, gotoLabel",
      "timer, inputWait, inputNumber, setFlag, callCommonEvent",
      "page condition resolution driven by switch+variable state",
    ],
  });

  await screenshot(page, "001-editor-seeded-map.png");
  await openEventEditor(page, "ev_core");
  await expect(page.getByTestId("event-command-setSwitch")).toBeVisible();
  await expect(page.getByTestId("event-command-fork")).toBeVisible();
  await expect(page.getByTestId("event-command-inputWait")).toBeVisible();
  await expect(page.getByTestId("event-command-inputNumber")).toBeVisible();
  await expect(page.getByTestId("event-command-timer")).toBeVisible();
  await expect(page.getByTestId("event-command-setFlag")).toBeVisible();
  await expect(page.getByTestId("event-command-callCommonEvent")).toBeVisible();
  await screenshot(page, "002-editor-core-command-list.png");

  await openInlineEditor(page.getByTestId("event-command-fork"));
  await screenshot(page, "003-editor-fork-condition-and-branches.png");
  await openInlineEditor(page.getByTestId("event-command-inputNumber"));
  await screenshot(page, "004-editor-input-number-body.png");
  await openInlineEditor(page.getByTestId("event-command-timer"));
  await screenshot(page, "005-editor-timer-body.png");
  await openInlineEditor(page.getByTestId("event-command-setFlag"));
  await screenshot(page, "006-editor-set-flag-body.png");
  await openInlineEditor(page.getByTestId("event-command-callCommonEvent"));
  await screenshot(page, "007-editor-common-event-call-body.png");
  await page.getByTestId("event-editor-apply").click();
  await page.getByTestId("event-editor-modal-close").click();

  const editorExport = await debugState(page);
  assertEditorCommandShapes(editorExport);
  assertPageConditionShapes(editorExport);
  await writeJson("008-editor-export.json", editorExport);

  await page.addInitScript((project) => {
    window.__OPRN_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtripExport = await debugState(page);
  assertEditorCommandShapes(roundtripExport);
  assertPageConditionShapes(roundtripExport);
  await writeJson("008b-editor-roundtrip-after-reload.json", roundtripExport);
  await openEventEditor(page, "ev_core");
  await expect(page.getByTestId("event-command-callCommonEvent")).toBeVisible();
  await screenshot(page, "008c-editor-core-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await openEventEditor(page, "ev_gate");
  await expect(page.getByTestId("event-page-switch-condition-input")).toHaveValue("sw_core");
  await expect(page.getByTestId("event-page-variable-condition-input")).toHaveValue("var_input");
  await screenshot(page, "009-editor-page-conditions.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await screenshot(page, "010-runtime-start.png");

  await page.getByTestId("event-ev_core").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("LOOP4 START");
  await screenshot(page, "011-runtime-start-text.png");
  await dismissDialogue(page);

  await expect(page.getByTestId("dialogue-box")).toContainText("THEN BRANCH");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_core).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).variables.var_score).toBe(2);
  await expect.poll(async () => (await runtimeState(page)).variables.var_branch).toBe(1);
  await writeJson("012-runtime-after-fork.json", await runtimeState(page));
  await screenshot(page, "013-runtime-fork-then-branch.png");
  await dismissDialogue(page);

  await expect.poll(async () => (await runtimeState(page)).running).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(false);
  await writeJson("014-runtime-input-wait-blocking.json", await runtimeState(page));
  await screenshot(page, "015-runtime-input-wait-blocking.png");
  await page.keyboard.press("Space");

  await expect(page.getByTestId("dialogue-box")).toContainText("AFTER INPUT WAIT");
  await screenshot(page, "016-runtime-after-input-wait.png");
  await dismissDialogue(page);
  await expect(page.getByTestId("runtime-input-number")).toBeVisible();
  await page.getByTestId("runtime-input-number-field").fill("321");
  await screenshot(page, "017-runtime-number-input.png");
  await page.getByTestId("runtime-input-number-ok").click();

  await expect(page.getByTestId("dialogue-box")).toContainText("COMMON EVENT FIRED");
  await expect.poll(async () => (await runtimeState(page)).variables.var_input).toBe(321);
  await expect.poll(async () => (await runtimeState(page)).timers.default).toBe(42);
  await expect.poll(async () => (await runtimeState(page)).flags.loop4_flag).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).variables.var_common).toBe(5);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_common).toBe(true);
  await writeJson("018-runtime-after-common-event.json", await runtimeState(page));
  await screenshot(page, "019-runtime-common-event-fired.png");
  await dismissDialogue(page);

  await expect(page.getByTestId("dialogue-box")).toContainText("DONE AFTER LABEL");
  await screenshot(page, "020-runtime-goto-label-done.png");
  await dismissDialogue(page);
  await expect.poll(async () => (await runtimeState(page)).running).toBe(false);
  await writeJson("021-runtime-final-state.json", await runtimeState(page));

  await page.getByTestId("event-ev_gate").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("GATE PAGE ACTIVE");
  await expect.poll(async () => (await runtimeState(page)).events.ev_gate?.pageId).toBe("ev_gate_open");
  await screenshot(page, "022-runtime-page-condition-open.png");
  await dismissDialogue(page);

  await page.getByTestId("event-ev_else").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("ELSE BRANCH CONFIRMED");
  await expect.poll(async () => (await runtimeState(page)).variables.var_else_branch).toBe(-1);
  await writeJson("023-runtime-fork-else-branch.json", await runtimeState(page));
  await screenshot(page, "024-runtime-fork-else-branch.png");

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 4 low-level core",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: switch/variable mutation, conditional branch true and false routes, label/gotoLabel jump, timer set, key input wait, number input, common event call, legacy flag mutation, and switch+variable event page resolution.",
    "- RM2003-scoped deviation: this loop certifies timer `set` only, not full Timer 1/Timer 2 page-condition parity or start/stop countdown semantics.",
    "- RM2003-scoped deviation: `setFlag` is a local legacy compatibility command, not an RM2003-native editor command; it is certified only as a low-level runtime/session primitive.",
    "",
  ].join("\n"));
  await writeJson("manifest.json", {
    runId: "loop4-low-level-core",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: [
      "001-editor-seeded-map.png",
      "002-editor-core-command-list.png",
      "003-editor-fork-condition-and-branches.png",
      "004-editor-input-number-body.png",
      "005-editor-timer-body.png",
      "006-editor-set-flag-body.png",
      "007-editor-common-event-call-body.png",
      "008c-editor-core-after-reload.png",
      "009-editor-page-conditions.png",
      "015-runtime-input-wait-blocking.png",
      "017-runtime-number-input.png",
      "019-runtime-common-event-fired.png",
      "020-runtime-goto-label-done.png",
      "022-runtime-page-condition-open.png",
      "024-runtime-fork-else-branch.png",
    ],
    json: [
      "008-editor-export.json",
      "008b-editor-roundtrip-after-reload.json",
      "012-runtime-after-fork.json",
      "014-runtime-input-wait-blocking.json",
      "018-runtime-after-common-event.json",
      "021-runtime-final-state.json",
      "023-runtime-fork-else-branch.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
  });
  await writeJson("cleanup-receipt.json", {
    ownedServerProcess: "playwright webServer",
    browserClosedBy: "playwright test runner",
    storageIsolation: "fresh browser context per test",
    generatedEvidenceRoot: EVIDENCE_DIR,
    status: "cleaned by runner",
  });
});

async function openEventEditor(page: Page, eventId: string): Promise<void> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId(`event-list-row-${eventId}`).click();
  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

async function openInlineEditor(command: Locator): Promise<void> {
  await expect(command).toBeVisible();
  await command.locator(".cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
}

async function dismissDialogue(page: Page): Promise<void> {
  await page.getByTestId("dialogue-box").click();
}

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

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}`, fullPage: true });
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeFile(`${EVIDENCE_DIR}/${name}`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(name: string, value: string): Promise<void> {
  await writeFile(`${EVIDENCE_DIR}/${name}`, value, "utf8");
}

function assertEditorCommandShapes(state: DebugState): void {
  const core = state.project.maps.map_loop4?.events.find((event) => event.id === "ev_core");
  const commands = core?.pages?.[0]?.commands ?? [];
  expect(commands.some((command) => command.kind === "setSwitch" && command.switchId === "sw_core")).toBe(true);
  expect(commands.some((command) => command.kind === "setVariable" && command.variableId === "var_score")).toBe(true);
  expect(commands.some((command) => command.kind === "fork" && command.then.some((child) => child.kind === "setVariable"))).toBe(true);
  expect(commands.some((command) => command.kind === "inputWait")).toBe(true);
  expect(commands.some((command) => command.kind === "inputNumber" && command.variableId === "var_input" && command.digits === 3)).toBe(true);
  expect(commands.some((command) => command.kind === "timer" && command.action === "set" && command.seconds === 42)).toBe(true);
  expect(commands.some((command) => command.kind === "setFlag" && command.flag === "loop4_flag" && command.value === true)).toBe(true);
  expect(commands.some((command) => command.kind === "callCommonEvent" && command.commonEventId === "ce_loop4")).toBe(true);
  expect(commands.some((command) => command.kind === "gotoLabel" && command.name === "done")).toBe(true);
}

function assertPageConditionShapes(state: DebugState): void {
  const gate = state.project.maps.map_loop4?.events.find((event) => event.id === "ev_gate");
  expect(gate?.pages?.[1]?.conditions).toEqual([
    { kind: "switch", switchId: "sw_core", value: true },
    { kind: "variable", variableId: "var_input", op: ">=", value: 300 },
  ]);
}

function lowLevelProject(): Project {
  return {
    version: 3,
    meta: { title: "Loop4 Low Level Core", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        npc_loop4: {
          id: "npc_loop4",
          image: { type: "bundled", id: "tex_npc_loop4" },
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
    switches: [
      { id: "sw_core", name: "Core switch" },
      { id: "sw_common", name: "Common event switch" },
    ],
    variables: [
      { id: "var_score", name: "Score" },
      { id: "var_branch", name: "Branch" },
      { id: "var_input", name: "Number input" },
      { id: "var_common", name: "Common event variable" },
      { id: "var_else_score", name: "Else score" },
      { id: "var_else_branch", name: "Else branch" },
    ],
    commonEvents: [
      {
        id: "ce_loop4",
        name: "Loop4 common event",
        trigger: "none",
        commands: [
          { kind: "setVariable", variableId: "var_common", op: "+=", value: 5 },
          { kind: "setSwitch", switchId: "sw_common", value: true },
          { kind: "text", body: "COMMON EVENT FIRED" },
        ],
      },
    ],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_loop4: {
        id: "map_loop4",
        name: "Loop4",
        width: 6,
        height: 5,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 30 }, () => 0),
        upperTiles: Array.from({ length: 30 }, () => -1),
        events: [
          {
            id: "ev_core",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("ev_core_page", [], coreCommands())],
          },
          {
            id: "ev_gate",
            x: 3,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              eventPage("ev_gate_closed", [], [{ kind: "text", body: "GATE CLOSED" }]),
              eventPage("ev_gate_open", [
                { kind: "switch", switchId: "sw_core", value: true },
                { kind: "variable", variableId: "var_input", op: ">=", value: 300 },
              ], [{ kind: "text", body: "GATE PAGE ACTIVE" }]),
            ],
          },
          {
            id: "ev_else",
            x: 4,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("ev_else_page", [], elseProbeCommands())],
          },
        ],
      },
    },
    mapTree: { mapId: "map_loop4", children: [] },
    startMapId: "map_loop4",
    startPos: { x: 2, y: 3 },
    flags: {},
  };
}

function coreCommands(): Command[] {
  return [
    { kind: "text", body: "LOOP4 START" },
    { kind: "setSwitch", switchId: "sw_core", value: true },
    { kind: "setVariable", variableId: "var_score", op: "=", value: 2 },
    {
      kind: "fork",
      condition: { kind: "variable", variableId: "var_score", op: ">=", value: 2 },
      then: [
        { kind: "setVariable", variableId: "var_branch", op: "=", value: 1 },
        { kind: "text", body: "THEN BRANCH" },
      ],
      else: [
        { kind: "setVariable", variableId: "var_branch", op: "=", value: -1 },
        { kind: "text", body: "ELSE BRANCH" },
      ],
    },
    { kind: "inputWait" },
    { kind: "text", body: "AFTER INPUT WAIT" },
    { kind: "inputNumber", variableId: "var_input", digits: 3 },
    { kind: "timer", action: "set", seconds: 42 },
    { kind: "setFlag", flag: "loop4_flag", value: true },
    { kind: "callCommonEvent", commonEventId: "ce_loop4" },
    { kind: "gotoLabel", name: "done" },
    { kind: "text", body: "SHOULD NOT APPEAR" },
    { kind: "label", name: "done" },
    { kind: "text", body: "DONE AFTER LABEL" },
  ];
}

function elseProbeCommands(): Command[] {
  return [
    { kind: "setVariable", variableId: "var_else_score", op: "=", value: 0 },
    {
      kind: "fork",
      condition: { kind: "variable", variableId: "var_else_score", op: ">=", value: 1 },
      then: [
        { kind: "setVariable", variableId: "var_else_branch", op: "=", value: 1 },
        { kind: "text", body: "UNEXPECTED THEN BRANCH" },
      ],
      else: [
        { kind: "setVariable", variableId: "var_else_branch", op: "=", value: -1 },
        { kind: "text", body: "ELSE BRANCH CONFIRMED" },
      ],
    },
  ];
}

function eventPage(id: string, conditions: EventPage["conditions"], commands: Command[]): EventPage {
  return {
    id,
    name: id,
    conditions,
    graphic: { sprite: { type: "bundled", id: "npc_loop4" } },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
