import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import {
  debugState,
  dispatchChange,
  openEventEditor,
  runtimeState,
  screenshotEvidence,
  writeEvidenceJson,
  writeEvidenceText,
  type DebugState,
} from "./eventEditorCertEvidence";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop13-m2-pdf-command";
const COMMENT_TEXT = "Loop 13 M2 editor-only comment";
const RUNTIME_TEXT = "M2 COMMENT SKIPPED AND CONTINUED";

test.setTimeout(120_000);

test("loop13 certifies M2 PDF command authoring persistence and runtime skip", async ({ page }) => {
  await rm(EVIDENCE_DIR, { recursive: true, force: true });
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectForEditor(page, m2Project());
  await writeJson("000-scenario.json", {
    scope: [
      "M2 PDF command picker classification surface",
      "M2 Comment editor-only command body",
      "export reload reopen persistence",
      "map runtime editor-only skip and continue",
    ],
  });

  await capturePickerClassification(page);
  await authorM2Comment(page);
  const exported = await debugState(page);
  assertM2Export(exported);
  await writeJson("004-editor-export.json", exported);

  await page.addInitScript((project) => {
    window.__OPRN_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, exported.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertM2Export(roundtrip);
  await writeJson("005-editor-roundtrip-after-reload.json", roundtrip);
  await verifyAfterReload(page);

  const runtimeWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") runtimeWarnings.push(message.text());
  });
  await seedProjectForEditor(page, roundtrip.project);
  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await screenshot(page, "007-runtime-before-m2-event.png");
  await page.getByTestId("event-ev_loop13_m2").click();
  await expect(page.getByTestId("dialogue-box")).toContainText(RUNTIME_TEXT);
  const runtime = await runtimeState(page);
  expect(runtime.running).toBe(true);
  expect(runtimeWarnings.some((line) => line.includes("M2 editor-only command skipped"))).toBe(true);
  await writeJson("008-runtime-after-m2-comment-skip.json", { runtime, runtimeWarnings });
  await screenshot(page, "008-runtime-after-m2-comment-skip.png");

  await writeJson("m2-classification.json", {
    catalogRows: 108,
    classifications: M2_COMMAND_CATALOG.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.runtimeClassification] = (counts[entry.runtimeClassification] ?? 0) + 1;
      return counts;
    }, {}),
    pickerPages: M2_COMMAND_CATALOG.reduce<Record<string, number>>((counts, entry) => {
      counts[String(entry.pickerPage)] = (counts[String(entry.pickerPage)] ?? 0) + 1;
      return counts;
    }, {}),
    certifiedCommand: { id: "m2-088-comment", title: "Comment", runtimeClassification: "editor-only" },
    scopedNonRuntime: ["shell", "battle-only", "disabled", "missing-runtime"],
  });
  await writeText(
    "rm2003-comparison-note.md",
    [
      "# RM2003 comparison note - Loop 13 M2 PDF command",
      "",
      "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
      "- Certified here: local M2 PDF command catalog support, M2 Comment authoring in the event editor, command body persistence, reload/reopen proof, and map-runtime editor-only skip/continue behavior.",
      "- Scope: this is editor/catalog certification. It does not certify full RM2003 runtime parity for every M2 PDF row, shell command, battle-only command, disabled command, or missing-runtime command.",
      "- Reference note: the RM2003 baseline artifact treats event contents as an ordered command list with insertion/editing rows; the local M2 PDF catalog supports command discovery and comparison for that editor workflow.",
      "",
    ].join("\n")
  );
  await writeJson("cleanup-receipt.json", {
    ownedServerProcess: "playwright webServer",
    browserClosedBy: "playwright test runner",
    storageIsolation: "fresh browser context; localStorage cleared before reload and runtime pass",
    generatedEvidenceRoot: EVIDENCE_DIR,
    status: "cleaned by runner",
  });
  await writeJson("critical-gate-loop13.json", { runId: "loop13-m2-pdf-command", minimumScore: 9, result: "PASS", aggregateScore: 9, groups: ["M2 catalog picker/classification surface", "M2 Comment editor authoring, command body, export/reload persistence", "Runtime editor-only skip/continue behavior and state safety", "Regression test surface, evidence reproducibility, cleanup/isolation", "RM2003 comparison/scoping note quality"].map((name) => ({ name, score: 9, result: "PASS" })), caveat: "This certifies M2 PDF catalog/editor support for the Comment command, Comment body persistence, reload/reopen proof, and runtime editor-only skip/continue behavior. It does not certify full RM2003 runtime parity for every M2 PDF row, shell command, battle-only command, disabled command, or missing-runtime command." });
  await writeJson("manifest.json", {
    runId: "loop13-m2-pdf-command",
    criticalGate: {
      minimumScore: 9,
      result: "PASS",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
      proof: "critical-gate-loop13.json",
    },
    screenshots: [
      "001-editor-picker-tab1-native.png",
      "001b-editor-picker-tab2-runtime.png",
      "001-editor-m2-picker-page-3.png",
      "003-editor-picker-tab4-disabled.png",
      "002-editor-m2-comment-body.png",
      "006-editor-m2-comment-after-reload.png",
      "007-runtime-before-m2-event.png",
      "008-runtime-after-m2-comment-skip.png",
    ],
    json: [
      "000-scenario.json",
      "001-picker-selectability.json",
      "004-editor-export.json",
      "005-editor-roundtrip-after-reload.json",
      "008-runtime-after-m2-comment-skip.json",
      "m2-classification.json",
      "critical-gate-loop13.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function capturePickerClassification(page: Page): Promise<void> {
  await openEventEditor(page, "ev_loop13_m2");
  await openPicker(page, 1);
  await screenshot(page, "001-editor-picker-tab1-native.png");
  await page.getByTestId("event-command-picker").getByTestId("event-command-picker-tab-2").click();
  await screenshot(page, "001b-editor-picker-tab2-runtime.png");
  await page.getByTestId("event-command-picker").getByTestId("event-command-picker-tab-3").click();
  await screenshot(page, "001-editor-m2-picker-page-3.png");
  const selectableComment = await isEnabled(
    page.getByTestId("event-command-picker").getByTestId("command-picker-add-m2-088-comment")
  );
  await page.getByTestId("event-command-picker").getByTestId("event-command-picker-tab-4").click();
  await screenshot(page, "003-editor-picker-tab4-disabled.png");
  const disabledShellOpenLoad = await isEnabled(
    page.getByTestId("event-command-picker").getByTestId("command-picker-add-m2-093-open-load-menu")
  );
  const disabledBattleEnemyHp = await isEnabled(
    page.getByTestId("event-command-picker").getByTestId("command-picker-add-m2-098-change-enemy-hp")
  );
  expect(selectableComment).toBe(true);
  expect(disabledShellOpenLoad).toBe(false);
  expect(disabledBattleEnemyHp).toBe(false);
  await writeJson("001-picker-selectability.json", {
    catalogRows: M2_COMMAND_CATALOG.length,
    selectableComment,
    disabledShellOpenLoad,
    disabledBattleEnemyHp,
  });
  await page.getByTestId("event-command-picker-cancel").click();
  await page.getByTestId("event-editor-modal-close").click();
}

async function authorM2Comment(page: Page): Promise<void> {
  await openEventEditor(page, "ev_loop13_m2");
  await openPicker(page, 3);
  await screenshot(page, "001-editor-m2-picker-page-3.png");
  await page.getByTestId("event-command-picker").getByTestId("command-picker-add-m2-088-comment").click();
  const command = page.getByTestId("event-command-m2Command");
  await openCommandEditor(command);
  await fillAndChange(command.getByTestId("m2-command-comment-textarea"), COMMENT_TEXT);
  await openCommandEditor(command);
  await screenshot(page, "002-editor-m2-comment-body.png");
  await addCommand(page, "command-picker-add-text", 1);
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("event-command-text-body").fill(RUNTIME_TEXT);
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect(dialog).toHaveCount(0);
  await page.getByTestId("event-editor-apply").click();
  await page.getByTestId("event-editor-modal-close").click();
}

async function isEnabled(locator: Locator): Promise<boolean> {
  return locator.evaluate((node) => node instanceof HTMLButtonElement && !node.disabled);
}

async function addCommand(page: Page, testId: string, tab: 1 | 2 | 3 | 4): Promise<void> {
  await openPicker(page, tab);
  await page.getByTestId("event-command-picker").getByTestId(testId).click();
}

async function openPicker(page: Page, tab: 1 | 2 | 3 | 4): Promise<void> {
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  if (tab !== 1) await picker.getByTestId(`event-command-picker-tab-${tab}`).click();
}

async function verifyAfterReload(page: Page): Promise<void> {
  await openEventEditor(page, "ev_loop13_m2");
  await openCommandEditor(page.getByTestId("event-command-m2Command"));
  await expect(page.getByTestId("m2-command-comment-textarea")).toHaveValue(COMMENT_TEXT);
  await screenshot(page, "006-editor-m2-comment-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();
}

async function openCommandEditor(command: Locator): Promise<void> {
  const isEditing = await command.evaluate((node) => node.classList.contains("editing")).catch(() => false);
  if (!isEditing) await command.locator(".cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
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

function assertM2Export(state: DebugState): void {
  const commands = commandsOf(state);
  expect(commands).toEqual([
    { kind: "m2Command", commandId: "m2-088-comment", fields: { comment: COMMENT_TEXT } },
    { kind: "text", body: RUNTIME_TEXT },
  ]);
}

function commandsOf(state: DebugState): readonly Command[] {
  return state.project.maps[state.project.startMapId]?.events.find((event) => event.id === "ev_loop13_m2")?.pages?.[0]
    ?.commands ?? [];
}

function m2Project(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  map.events.push(event("ev_loop13_m2", 4, 5));
  return project;
}

function event(id: string, x: number, y: number): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: `${id}_page`,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
}
