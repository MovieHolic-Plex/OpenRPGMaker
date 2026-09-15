import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Command, EventPage, Project } from "@/project/types";
import { debugState, dismissDialogue, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop7-control-flow";
const PASSABLE = { up: true, down: true, left: true, right: true };

test.setTimeout(90_000);

test("loop7 certifies variable operand wait timer and label flow", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, controlProject());
  await writeJson("000-scenario.json", {
    scope: ["setVariable variable operand authoring", "wait blocking", "timer set", "gotoLabel skips command", "reload persistence"],
  });

  await screenshot(page, "001-editor-map-event-layer.png");
  await openEventEditor(page, "ev_control");
  const targetCommand = page.getByTestId("event-command-setVariable").nth(1);
  await openCommandEditor(targetCommand);
  await targetCommand.getByTestId("event-command-variable-value-source").selectOption("variable");
  const variableTargetCommand = page.getByTestId("event-command-setVariable").nth(1);
  await openCommandEditor(variableTargetCommand);
  await variableTargetCommand.getByTestId("event-command-variable-operand").locator("select").selectOption("var_source");
  await openCommandEditor(page.getByTestId("event-command-setVariable").nth(1));
  await screenshot(page, "002-editor-variable-operand-wait-timer-label.png");
  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertControlExport(editorExport);
  await writeJson("003-editor-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((project) => {
    window.__OPRN_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertControlExport(roundtrip);
  await writeJson("004-editor-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_control");
  const reloadedTargetCommand = page.getByTestId("event-command-setVariable").nth(1);
  await openCommandEditor(reloadedTargetCommand);
  await expect(reloadedTargetCommand.getByTestId("event-command-variable-value-source")).toHaveValue("variable");
  await expect(reloadedTargetCommand.getByTestId("event-command-variable-operand").locator("select")).toHaveValue("var_source");
  await screenshot(page, "005-editor-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await page.getByTestId("event-ev_control").click();
  await page.waitForTimeout(100);
  const duringWait = await runtimeState(page);
  expect(duringWait.running).toBe(true);
  expect(duringWait.variables.var_result).toBe(11);
  expect(duringWait.variables.var_after_wait ?? 0).toBe(0);
  await writeJson("006-runtime-during-wait.json", duringWait);
  await screenshot(page, "007-runtime-during-wait.png");

  await expect(page.getByTestId("dialogue-box")).toContainText("CONTROL DONE");
  const finalState = await runtimeState(page);
  expect(finalState.variables.var_result).toBe(11);
  expect(finalState.variables.var_after_wait).toBe(1);
  expect(finalState.variables.var_skipped ?? 0).toBe(0);
  expect(finalState.timers.default).toBe(12);
  await writeJson("008-runtime-final-before-dismiss.json", finalState);
  await screenshot(page, "009-runtime-control-done.png");
  await dismissDialogue(page);

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 7 control flow",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: variable operation using another variable as operand, wait blocking, timer set, label/goto label jump, export/reload/reopen persistence, and runtime state effects.",
    "- Scoped deviation: timer countdown UI/control-panel parity is not certified here; this loop certifies the event command that sets the default timer value.",
    "",
  ].join("\n"));
  await writeJson("cleanup-receipt.json", {
    ownedServerProcess: "playwright webServer",
    browserClosedBy: "playwright test runner",
    storageIsolation: "fresh browser context per test",
    generatedEvidenceRoot: EVIDENCE_DIR,
    status: "cleaned by runner",
  });
  await writeJson("manifest.json", {
    runId: "loop7-control-flow",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: [
      "001-editor-map-event-layer.png",
      "002-editor-variable-operand-wait-timer-label.png",
      "005-editor-after-reload.png",
      "007-runtime-during-wait.png",
      "009-runtime-control-done.png",
    ],
    json: [
      "000-scenario.json",
      "003-editor-export.json",
      "004-editor-roundtrip-after-reload.json",
      "006-runtime-during-wait.json",
      "008-runtime-final-before-dismiss.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function screenshot(page: Page, name: string): Promise<void> {
  await screenshotEvidence(page, EVIDENCE_DIR, name);
}

async function openCommandEditor(command: ReturnType<Page["getByTestId"]>): Promise<void> {
  if (!(await command.evaluate((node) => node.classList.contains("editing")).catch(() => false))) {
    await command.locator(".cmd-head").dblclick();
  }
  await expect(command).toHaveClass(/editing/);
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeEvidenceJson(EVIDENCE_DIR, name, value);
}

async function writeText(name: string, value: string): Promise<void> {
  await writeEvidenceText(EVIDENCE_DIR, name, value);
}

function assertControlExport(state: DebugState): void {
  const event = state.project.maps.map_loop7?.events.find((item) => item.id === "ev_control");
  expect(event?.pages?.[0]?.commands).toMatchObject([
    { kind: "setVariable", variableId: "var_source", op: "=", value: 11 },
    { kind: "setVariable", variableId: "var_result", op: "+=", value: { kind: "var", id: "var_source" } },
    { kind: "wait", ms: 800 },
    { kind: "setVariable", variableId: "var_after_wait", op: "=", value: 1 },
    { kind: "timer", action: "set", seconds: 12 },
    { kind: "gotoLabel", name: "done" },
    { kind: "setVariable", variableId: "var_skipped", op: "=", value: 99 },
    { kind: "label", name: "done" },
    { kind: "text", body: "CONTROL DONE" },
  ]);
}

function controlProject(): Project {
  return {
    version: 3,
    meta: { title: "Loop7 Control Flow", author: "e2e", terms: { gold: "G" } },
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
        passability: [PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE, PASSABLE],
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    switches: [],
    variables: [
      { id: "var_source", name: "Source" },
      { id: "var_result", name: "Result" },
      { id: "var_after_wait", name: "After Wait" },
      { id: "var_skipped", name: "Skipped" },
    ],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_loop7: {
        id: "map_loop7",
        name: "Loop7",
        width: 6,
        height: 5,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 30 }, () => 0),
        upperTiles: Array.from({ length: 30 }, () => -1),
        events: [{ id: "ev_control", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [eventPage()] }],
      },
    },
    mapTree: { mapId: "map_loop7", children: [] },
    startMapId: "map_loop7",
    startPos: { x: 2, y: 3 },
    flags: {},
  };
}

function eventPage(): EventPage {
  const commands: Command[] = [
    { kind: "setVariable", variableId: "var_source", op: "=", value: 11 },
    { kind: "setVariable", variableId: "var_result", op: "+=", value: 0 },
    { kind: "wait", ms: 800 },
    { kind: "setVariable", variableId: "var_after_wait", op: "=", value: 1 },
    { kind: "timer", action: "set", seconds: 12 },
    { kind: "gotoLabel", name: "done" },
    { kind: "setVariable", variableId: "var_skipped", op: "=", value: 99 },
    { kind: "label", name: "done" },
    { kind: "text", body: "CONTROL DONE" },
  ];
  return {
    id: "control_page",
    name: "control_page",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
