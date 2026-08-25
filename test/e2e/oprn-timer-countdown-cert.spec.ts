import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";
import { debugState, dispatchChange, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop16-timer-countdown";

test.setTimeout(90_000);

test("loop16 certifies timer set start stop countdown hud and state", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await seedProjectFromSupabaseCanonical(page, timerProject());
  await writeJson("000-scenario.json", {
    scope: ["Timer set/start/stop authoring", "save/reload persistence", "runtime countdown HUD", "stop leaves paused remaining state"],
  });
  const initialExport = await debugState(page);
  assertInitialTimerCommands(initialExport);
  await writeJson("000a-editor-initial-nonfinal.json", initialExport);

  await screenshot(page, "001-editor-seeded-map.png");
  await openEventEditor(page, "ev_timer");
  await expect(page.getByTestId("event-command-timer")).toHaveCount(3);
  await configureTimerCommand(page.getByTestId("event-command-timer").nth(0), "set", "5");
  await configureTimerCommand(page.getByTestId("event-command-timer").nth(1), "start", "5");
  await configureTimerCommand(page.getByTestId("event-command-timer").nth(2), "stop", "0");
  await openCommandEditor(page.getByTestId("event-command-timer").nth(1));
  await screenshot(page, "002-editor-timer-set-start-stop-authoring.png");
  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertTimerCommands(editorExport);
  await writeJson("003-editor-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertTimerCommands(roundtrip);
  await writeJson("004-editor-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_timer");
  await expect(page.getByTestId("event-command-timer")).toHaveCount(3);
  const reloadedStart = page.getByTestId("event-command-timer").nth(1);
  await openCommandEditor(reloadedStart);
  await expect(reloadedStart.getByTestId("event-command-timer-action")).toHaveValue("start");
  await expect(reloadedStart.getByTestId("event-command-timer-seconds")).toHaveValue("5");
  await screenshot(page, "005-editor-timer-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await screenshot(page, "006-runtime-before-timer-event.png");

  await page.getByTestId("event-ev_timer").click();
  await expect(page.getByTestId("runtime-timer-hud")).toBeVisible();
  await expect(page.getByTestId("runtime-timer-hud")).toContainText("default: 00:");
  await expect.poll(async () => (await runtimeState(page)).timerActive?.default).toBe(true);
  await page.waitForTimeout(1100);
  const activeState = await runtimeState(page);
  expect(activeState.timers.default).toBeGreaterThan(0);
  expect(activeState.timers.default).toBeLessThan(5);
  expect(activeState.timerActive?.default).toBe(true);
  await writeJson("007-runtime-countdown-active.json", activeState);
  await screenshot(page, "008-runtime-countdown-hud-active.png");

  await expect(page.getByTestId("dialogue-box")).toContainText("TIMER STOPPED");
  const stoppedState = await runtimeState(page);
  expect(stoppedState.timerActive?.default).toBe(false);
  expect(stoppedState.timers.default).toBeGreaterThan(0);
  expect(stoppedState.timers.default).toBeLessThan(5);
  await expect(page.getByTestId("runtime-timer-hud")).toContainText("paused");
  await writeJson("009-runtime-stopped-paused.json", stoppedState);
  await screenshot(page, "010-runtime-timer-stopped-paused.png");

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 16 timer countdown",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: Timer Operation set/start/stop command authoring, reload persistence, visible countdown HUD, state countdown, and stop retaining the remaining value as paused.",
    "- Scoped deviation: this certifies the default map timer countdown surface. It does not certify every RM2003 Timer 1/Timer 2 UI skin, battle timer edge, or timeout-triggered game-over policy.",
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
    runId: "loop16-timer-countdown",
    criticalGate: { minimumScore: 9, result: "PENDING_REVIEW" },
    screenshots: ["001-editor-seeded-map.png", "002-editor-timer-set-start-stop-authoring.png", "005-editor-timer-after-reload.png", "006-runtime-before-timer-event.png", "008-runtime-countdown-hud-active.png", "010-runtime-timer-stopped-paused.png"],
    json: ["000-scenario.json", "000a-editor-initial-nonfinal.json", "003-editor-export.json", "004-editor-roundtrip-after-reload.json", "007-runtime-countdown-active.json", "009-runtime-stopped-paused.json", "cleanup-receipt.json"],
    notes: [
      "rm2003-comparison-note.md",
      "manual-qa-loop16-result.json",
      "manual-qa-loop16-typecheck.txt",
      "manual-qa-loop16-vitest.txt",
      "manual-qa-loop16-playwright.txt",
      "code-review-loop16-result.md",
      "critical-gate-loop16.json",
      "manifest.json",
    ],
  });
});

async function configureTimerCommand(command: Locator, action: "set" | "start" | "stop", seconds: string): Promise<void> {
  await openCommandEditor(command);
  const actionSelect = command.getByTestId("event-command-timer-action");
  if (await actionSelect.inputValue() !== action) {
    await actionSelect.selectOption(action);
    await openCommandEditor(command);
  }
  const secondsInput = command.getByTestId("event-command-timer-seconds");
  await secondsInput.fill(seconds);
  await dispatchChange(secondsInput);
}

async function openCommandEditor(command: Locator): Promise<void> {
  const editor = command.locator(":scope > .cmd-inline-editor");
  if (!(await editor.isVisible().catch(() => false))) await command.locator(":scope > .cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
  await expect(editor).toBeVisible();
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

function assertTimerCommands(state: DebugState): void {
  const commands = state.project.maps.map_loop16?.events.find((event) => event.id === "ev_timer")?.pages?.[0]?.commands;
  expect(commands).toMatchObject(timerCommands());
}

function assertInitialTimerCommands(state: DebugState): void {
  const commands = state.project.maps.map_loop16?.events.find((event) => event.id === "ev_timer")?.pages?.[0]?.commands;
  expect(commands).toMatchObject(initialTimerCommands());
  expect(commands).not.toMatchObject(timerCommands());
}

function timerProject(): Project {
  const project = createBlankProject();
  const tilesetId = project.maps[project.startMapId]?.tilesetId ?? Object.keys(project.tilesets)[0] ?? "";
  project.meta = { ...project.meta, title: "Loop16 Timer Countdown" };
  project.startMapId = "map_loop16";
  project.startPos = { x: 2, y: 3 };
  project.maps = {
    map_loop16: {
      id: "map_loop16",
      name: "Loop16",
      width: 6,
      height: 5,
      tilesetId,
      tileSize: 16,
      lowerTiles: Array.from({ length: 30 }, () => 0),
      upperTiles: Array.from({ length: 30 }, () => -1),
      events: [{ id: "ev_timer", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [timerPage()] }],
    },
  };
  project.mapTree = { mapId: "map_loop16", children: [] };
  return project;
}

function timerPage(): EventPage {
  return {
    id: "timer_page",
    name: "timer_page",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: initialTimerCommands(),
  };
}

function timerCommands(): Command[] {
  return [
    { kind: "timer", action: "set", seconds: 5 },
    { kind: "timer", action: "start", seconds: 5 },
    { kind: "wait", ms: 1400 },
    { kind: "timer", action: "stop", seconds: 0 },
    { kind: "text", body: "TIMER STOPPED" },
  ];
}

function initialTimerCommands(): Command[] {
  return [
    { kind: "timer", action: "start", seconds: 1 },
    { kind: "timer", action: "stop", seconds: 0 },
    { kind: "wait", ms: 1400 },
    { kind: "timer", action: "set", seconds: 9 },
    { kind: "text", body: "TIMER STOPPED" },
  ];
}
