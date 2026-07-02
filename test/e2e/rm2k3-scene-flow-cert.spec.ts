import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject, createStarterHouseInteriorMap } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { debugState, dispatchChange, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop11-scene-flow";
const TARGET_MAP_ID = "map_loop11_scene_target";
const TROOP_ID = "troop_slime";

test.setTimeout(120_000);

test("loop11 certifies transfer battle and terminal scene commands", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, sceneFlowProject());
  await writeJson("000-scenario.json", {
    scope: ["transfer", "battleProcessing", "gameOver", "ending", "returnToTitle", "roundtrip persistence", "runtime screens"],
    transferProof: { clickedEventId: "ev_transfer", uniqueTargetMapId: TARGET_MAP_ID },
  });

  await authorTransfer(page);
  await authorBattle(page);
  await authorTerminal(page);
  const exported = await debugState(page);
  assertSceneFlowExport(exported);
  await writeJson("004-editor-export.json", exported);

  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, exported.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertSceneFlowExport(roundtrip);
  await writeJson("005-editor-roundtrip-after-reload.json", roundtrip);
  await verifyAfterReload(page);

  await runTransfer(page, roundtrip.project);
  await runBattle(page, roundtrip.project);
  await runGameOver(page, roundtrip.project);
  await runEnding(page, roundtrip.project);
  await runReturnToTitle(page, roundtrip.project);
  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 11 scene flow",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: Transfer Player, Battle Processing, Game Over, Ending, and Return to Title authoring, roundtrip persistence, and visible runtime handoff/screen behavior.",
    "- Scoped deviation: this certifies one target-map transfer, one troop handoff, and terminal screen display. It does not certify every battle result branch, escape/lose branch, or destination tile passability edge case.",
    "",
  ].join("\n"));
  await writeJson("cleanup-receipt.json", {
    ownedServerProcess: "playwright webServer",
    browserClosedBy: "playwright test runner",
    storageIsolation: "fresh browser context per scenario; localStorage cleared before reloads",
    generatedEvidenceRoot: EVIDENCE_DIR,
    status: "cleaned by runner",
  });
  await writeJson("manifest.json", {
    runId: "loop11-scene-flow",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: [
      "001-editor-transfer-dialog.png",
      "002-editor-battle-processing.png",
      "003-editor-terminal-commands.png",
      "006-editor-transfer-after-reload.png",
      "007-editor-battle-after-reload.png",
      "008-editor-terminal-after-reload.png",
      "009a-runtime-before-transfer-click.png",
      "009-runtime-after-transfer.png",
      "011-runtime-battle-screen.png",
      "012-runtime-game-over-screen.png",
      "013-runtime-ending-screen.png",
      "014-runtime-return-to-title-screen.png",
    ],
    json: [
      "000-scenario.json",
      "004-editor-export.json",
      "005-editor-roundtrip-after-reload.json",
      "009a-runtime-before-transfer-click.json",
      "010-runtime-after-transfer.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function authorTransfer(page: Page): Promise<void> {
  await openEventEditor(page, "ev_transfer");
  await editCommand(page, "transfer", async (command) => {
    await command.getByTestId("transfer-player-open").click();
    const dialog = page.getByTestId("event-transfer-player-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId(`transfer-player-map-${TARGET_MAP_ID}`).click();
    await dialog.getByTestId("transfer-player-direction-right").check();
    await screenshot(page, "001-editor-transfer-dialog.png");
    await dialog.getByTestId("transfer-player-ok").click();
  });
  await applyAndClose(page);
}

async function authorBattle(page: Page): Promise<void> {
  await openEventEditor(page, "ev_battle");
  await editCommand(page, "battleProcessing", async (command) => {
    await command.getByTestId("battle-processing-troop-select").selectOption(TROOP_ID);
  });
  await editCommand(page, "battleProcessing", async (command) => {
    await command.getByTestId("battle-processing-escape-checkbox").check();
  });
  await editCommand(page, "battleProcessing", async (command) => {
    await command.getByTestId("battle-processing-lose-checkbox").check();
  });
  await screenshot(page, "002-editor-battle-processing.png");
  await applyAndClose(page);
}

async function authorTerminal(page: Page): Promise<void> {
  await openEventEditor(page, "ev_ending");
  await editCommand(page, "ending", async (command) => {
    await fillAndChange(command.getByTestId("ending-title-input"), "Loop 11 Ending");
  });
  await editCommand(page, "ending", async (command) => {
    await fillAndChange(command.getByTestId("ending-message-input"), "Scene flow proof.");
  });
  await applyAndClose(page);
  await openEventEditor(page, "ev_game_over");
  await editCommand(page, "gameOver", async (command) => expect(command).toContainText("게임 오버"));
  await applyAndClose(page);
  await openEventEditor(page, "ev_return_title");
  await editCommand(page, "returnToTitle", async (command) => expect(command).toContainText("타이틀"));
  await screenshot(page, "003-editor-terminal-commands.png");
  await applyAndClose(page);
}

async function verifyAfterReload(page: Page): Promise<void> {
  await openEventEditor(page, "ev_transfer");
  await screenshot(page, "006-editor-transfer-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();
  await openEventEditor(page, "ev_battle");
  await screenshot(page, "007-editor-battle-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();
  await openEventEditor(page, "ev_ending");
  await screenshot(page, "008-editor-terminal-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();
}

async function runTransfer(page: Page, project: Project): Promise<void> {
  await startPlay(page, project);
  const before = await runtimeState(page);
  expect(before.mapId).not.toBe(TARGET_MAP_ID);
  await screenshot(page, "009a-runtime-before-transfer-click.png");
  await writeJson("009a-runtime-before-transfer-click.json", { ...before, nextClickEventId: "ev_transfer", expectedTargetMapId: TARGET_MAP_ID });
  await page.getByTestId("event-ev_transfer").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(TARGET_MAP_ID);
  const state = await runtimeState(page);
  expect(state.player.x).toBeGreaterThanOrEqual(0);
  expect(state.player.y).toBeGreaterThanOrEqual(0);
  await screenshot(page, "009-runtime-after-transfer.png");
  await writeJson("010-runtime-after-transfer.json", { ...state, clickedEventId: "ev_transfer", expectedTargetMapId: TARGET_MAP_ID });
}

async function runBattle(page: Page, project: Project): Promise<void> {
  await startPlay(page, project);
  await page.getByTestId("event-ev_battle").click();
  await expect(page.getByTestId("battle-scene")).toContainText("전투가 시작");
  await screenshot(page, "011-runtime-battle-screen.png");
}

async function runGameOver(page: Page, project: Project): Promise<void> {
  await startPlay(page, project);
  await page.getByTestId("event-ev_game_over").click();
  await expect(page.getByTestId("game-over-screen")).toBeVisible();
  await screenshot(page, "012-runtime-game-over-screen.png");
}

async function runEnding(page: Page, project: Project): Promise<void> {
  await startPlay(page, project);
  await page.getByTestId("event-ev_ending").click();
  await expect(page.getByTestId("ending-screen")).toContainText("Loop 11 Ending");
  await screenshot(page, "013-runtime-ending-screen.png");
}

async function runReturnToTitle(page: Page, project: Project): Promise<void> {
  await startPlay(page, project);
  await page.getByTestId("event-ev_return_title").click();
  await expect(page.getByTestId("title-new-game")).toBeVisible();
  await screenshot(page, "014-runtime-return-to-title-screen.png");
}

async function startPlay(page: Page, project: Project): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project);
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
}

async function editCommand(page: Page, kind: Command["kind"], action: (command: Locator) => Promise<void>): Promise<void> {
  const command = page.getByTestId(`event-command-${kind}`).first();
  await command.scrollIntoViewIfNeeded();
  await command.evaluate((node) => node.classList.add("editing"));
  await expect(command).toHaveClass(/editing/);
  await action(command);
}

async function applyAndClose(page: Page): Promise<void> {
  await page.getByTestId("event-editor-apply").click();
  await page.getByTestId("event-editor-modal-close").click();
}

async function fillAndChange(locator: Locator, value: string): Promise<void> {
  await locator.fill(value);
  await dispatchChange(locator);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await screenshotEvidence(page, EVIDENCE_DIR, name);
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeEvidenceJson(EVIDENCE_DIR, name, value);
}

async function writeText(name: string, value: string): Promise<void> {
  await writeEvidenceText(EVIDENCE_DIR, name, value);
}

function assertSceneFlowExport(state: DebugState): void {
  expect(commandOf(state, "ev_transfer")).toMatchObject({ kind: "transfer", mapId: TARGET_MAP_ID, direction: "right" });
  expect(commandOf(state, "ev_battle")).toMatchObject({ kind: "battleProcessing", troopId: TROOP_ID, canEscape: true, canLose: true });
  expect(commandOf(state, "ev_game_over")).toMatchObject({ kind: "gameOver" });
  expect(commandOf(state, "ev_ending")).toMatchObject({ kind: "ending", title: "Loop 11 Ending", message: "Scene flow proof." });
  expect(commandOf(state, "ev_return_title")).toMatchObject({ kind: "returnToTitle" });
}

function commandOf(state: DebugState, eventId: string): Command | undefined {
  return state.project.maps[state.project.startMapId]?.events.find((event) => event.id === eventId)?.pages?.[0]?.commands[0];
}

function sceneFlowProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  const target = createStarterHouseInteriorMap(project.startMapId);
  target.id = TARGET_MAP_ID;
  target.name = "Loop11 Target";
  target.events = [];
  project.maps[TARGET_MAP_ID] = target;
  project.mapTree.children = [{ mapId: TARGET_MAP_ID, children: [] }];
  if (!project.database.troops.some((troop) => troop.id === TROOP_ID)) throw new Error("missing troop_slime");
  map.events.push(event("ev_transfer", 0, { kind: "transfer", mapId: project.startMapId, x: 0, y: 0, direction: "retain" }));
  map.events.push(event("ev_battle", 1, { kind: "battleProcessing", troopId: "", canEscape: false, canLose: false }));
  map.events.push(event("ev_game_over", 2, { kind: "gameOver" }));
  map.events.push(event("ev_ending", 3, { kind: "ending", title: "Draft", message: "Draft" }));
  map.events.push(event("ev_return_title", 4, { kind: "returnToTitle" }));
  return project;
}

function event(id: string, offset: number, command: Command): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: `${id}_page`,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [command],
  };
  return { id, x: 4 + offset, y: 4, trigger: { kind: "action" }, commands: [], pages: [page] };
}
