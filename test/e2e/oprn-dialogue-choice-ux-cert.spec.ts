import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { debugState, dispatchChange, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop12-dialogue-choice-ux";
const FIVE_OPTIONS = ["Alpha", "Beta", "Gamma", "Delta", "Omega"] as const;
const TWO_OPTIONS = ["Yes", "No"] as const;
const FACE_TEXT = "FACE MESSAGE READY";
const TOP_TEXT = "TOP TRANSPARENT READY";
const CHOICE_TEXT = "CHOICE FIVE BRANCH";
const CANCEL_TEXT = "CANCEL BRANCH";

test.setTimeout(120_000);

test("loop12 certifies dialogue face message settings and fixed-height choices", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, dialogueChoiceProject());
  await writeJson("000-scenario.json", { scope: ["text", "displayTextSettings", "changeFace", "choices", "choice branches", "choice cancel branch", "runtime UX"] });

  await authorDialogueEvent(page);
  await authorTopMessageEvent(page);
  await authorTwoChoiceEvent(page);
  const exported = await debugState(page);
  assertExport(exported);
  await writeJson("004-editor-export.json", exported);

  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, exported.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertExport(roundtrip);
  await writeJson("005-editor-roundtrip-after-reload.json", roundtrip);
  await verifyAfterReload(page);

  const fiveGeometry = await runFiveChoiceDialogue(page, roundtrip.project);
  const twoGeometry = await runTwoChoiceCancel(page, roundtrip.project);
  const topGeometry = await runTopTransparentMessage(page, roundtrip.project);
  expect(Math.abs(fiveGeometry.window.height - twoGeometry.window.height)).toBeLessThanOrEqual(1);
  expect(fiveGeometry.choicesBottom).toBeLessThanOrEqual(fiveGeometry.window.bottom);
  expect(twoGeometry.choicesBottom).toBeLessThanOrEqual(twoGeometry.window.bottom);
  await writeJson("015-runtime-dialogue-choice-geometry.json", { fiveGeometry, twoGeometry, topGeometry });
  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 12 dialogue and choices", "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: Show Text, Message Display Settings, Change Faceset, Show Choices with five options, option branch runtime, cancel branch runtime, and fixed-height dialogue-window choice UX.",
    "- Scoped deviation: this certifies one faceset, top transparent text, bottom framed text, two-option choice, five-option choice, one option branch, and one cancel branch. It does not certify every control character, every faceset asset, or every cancel behavior.", "",
  ].join("\n"));
  await writeJson("cleanup-receipt.json", { ownedServerProcess: "playwright webServer", browserClosedBy: "playwright test runner", storageIsolation: "fresh browser context per scenario; localStorage cleared before reloads", generatedEvidenceRoot: EVIDENCE_DIR, status: "cleaned by runner" });
  await writeJson("manifest.json", {
    runId: "loop12-dialogue-choice-ux",
    criticalGate: { minimumScore: 9, result: "PENDING_REVIEW", rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md" },
    screenshots: ["001-editor-dialogue-face-five-choices.png", "002-editor-top-transparent-message.png", "003-editor-two-choice-cancel.png", "006-editor-dialogue-after-reload.png", "007-editor-top-after-reload.png", "008-editor-two-choice-after-reload.png", "009-runtime-face-text.png", "010-runtime-five-choice-window.png", "011-runtime-choice-five-branch.png", "012-runtime-two-choice-window.png", "013-runtime-cancel-branch.png", "014-runtime-top-transparent-message.png"],
    json: ["000-scenario.json", "004-editor-export.json", "005-editor-roundtrip-after-reload.json", "011-runtime-choice-five-branch.json", "013-runtime-cancel-branch.json", "015-runtime-dialogue-choice-geometry.json", "cleanup-receipt.json"],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function authorDialogueEvent(page: Page): Promise<void> {
  await openEventEditor(page, "ev_loop12_dialogue");
  await setMessageSettings(page, "normal", "bottom", true, false);
  await setFace(page);
  await editText(page, "Loop12 NPC", FACE_TEXT);
  await editChoices(page, FIVE_OPTIONS, "Pick proof option");
  await screenshot(page, "001-editor-dialogue-face-five-choices.png");
  await applyAndClose(page);
}

async function authorTopMessageEvent(page: Page): Promise<void> {
  await openEventEditor(page, "ev_loop12_top");
  await setMessageSettings(page, "transparent", "top", false, true);
  await editText(page, "System", TOP_TEXT);
  await screenshot(page, "002-editor-top-transparent-message.png");
  await applyAndClose(page);
}

async function authorTwoChoiceEvent(page: Page): Promise<void> {
  await openEventEditor(page, "ev_loop12_two");
  await editChoices(page, TWO_OPTIONS, "Cancel proof?");
  await page.getByTestId("event-choice-cancel-branch").check();
  await screenshot(page, "003-editor-two-choice-cancel.png");
  await applyAndClose(page);
}

async function editText(page: Page, speaker: string, body: string): Promise<void> {
  await editCommand(page, "text", async (command) => fillAndChange(command.locator("input").first(), speaker));
  await editCommand(page, "text", async (command) => fillAndChange(command.locator("textarea").first(), body));
}

async function setMessageSettings(page: Page, format: "normal" | "transparent", position: "top" | "bottom", prevent: boolean, allow: boolean): Promise<void> {
  await editCommand(page, "displayTextSettings", async (command) => { await command.getByTestId("event-command-message-format").selectOption(format); });
  await editCommand(page, "displayTextSettings", async (command) => { await command.getByTestId("event-command-message-position").selectOption(position); });
  await editCommand(page, "displayTextSettings", async (command) => prevent ? command.getByTestId("event-command-message-prevent-obscuring").check() : command.getByTestId("event-command-message-prevent-obscuring").uncheck());
  await editCommand(page, "displayTextSettings", async (command) => allow ? command.getByTestId("event-command-message-allow-movement").check() : command.getByTestId("event-command-message-allow-movement").uncheck());
}

async function setFace(page: Page): Promise<void> {
  // 얼굴 한 칸 = 파일 한 장 — 칸 번호 입력은 사라졌고 낱장 얼굴 id 하나만 고른다
  // (…-02 = 예전 「얼굴 3」 = 0-based 2번 칸).
  await editCommand(page, "changeFace", async (command) => fillAndChange(command.getByTestId("event-command-face-resource"), "easyrpg-faceset-actor1-02"));
  await editCommand(page, "changeFace", async (command) => { await command.getByTestId("event-command-face-position").selectOption("right"); });
  await editCommand(page, "changeFace", async (command) => command.getByTestId("event-command-face-flip-horizontal").check());
}

async function editChoices(page: Page, options: readonly string[], prompt: string): Promise<void> {
  await editCommand(page, "choices", async (command) => fillAndChange(command.getByTestId("event-choice-prompt"), prompt));
  for (const [index, option] of options.entries()) await editCommand(page, "choices", async (command) => fillAndChange(command.getByTestId(`event-choice-option-${index + 1}`), option));
}

async function verifyAfterReload(page: Page): Promise<void> {
  await openEventEditor(page, "ev_loop12_dialogue");
  await screenshot(page, "006-editor-dialogue-after-reload.png");
  await closeEditor(page);
  await openEventEditor(page, "ev_loop12_top");
  await screenshot(page, "007-editor-top-after-reload.png");
  await closeEditor(page);
  await openEventEditor(page, "ev_loop12_two");
  await screenshot(page, "008-editor-two-choice-after-reload.png");
  await closeEditor(page);
}

async function runFiveChoiceDialogue(page: Page, project: Project): Promise<Geometry> {
  await startPlay(page, project);
  await page.getByTestId("event-ev_loop12_dialogue").click();
  await expect(page.getByTestId("dialogue-box")).toContainText(FACE_TEXT);
  await expect(page.getByTestId("dialogue-face")).toBeVisible();
  await screenshot(page, "009-runtime-face-text.png");
  await page.getByTestId("dialogue-box").click();
  await expect(page.getByTestId("runtime-choice-4")).toContainText("Omega");
  const geometry = await dialogueGeometry(page);
  await screenshot(page, "010-runtime-five-choice-window.png");
  await page.getByTestId("runtime-choice-4").click();
  await expect(page.getByTestId("dialogue-box")).toContainText(CHOICE_TEXT);
  await screenshot(page, "011-runtime-choice-five-branch.png");
  await writeJson("011-runtime-choice-five-branch.json", await runtimeState(page));
  return geometry;
}

async function runTwoChoiceCancel(page: Page, project: Project): Promise<Geometry> {
  await startPlay(page, project);
  await page.getByTestId("event-ev_loop12_two").click();
  await expect(page.getByTestId("runtime-choice-1")).toContainText("No");
  const geometry = await dialogueGeometry(page);
  await screenshot(page, "012-runtime-two-choice-window.png");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("dialogue-box")).toContainText(CANCEL_TEXT);
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await screenshot(page, "013-runtime-cancel-branch.png");
  await writeJson("013-runtime-cancel-branch.json", await runtimeState(page));
  return geometry;
}

async function runTopTransparentMessage(page: Page, project: Project): Promise<Geometry> {
  await startPlay(page, project);
  await page.getByTestId("event-ev_loop12_top").click();
  const box = page.getByTestId("dialogue-box");
  await expect(box).toContainText(TOP_TEXT);
  await expect(box).toHaveAttribute("data-message-format", "transparent");
  await expect(box).toHaveAttribute("data-message-position", "top");
  const geometry = await dialogueGeometry(page);
  await screenshot(page, "014-runtime-top-transparent-message.png");
  return geometry;
}

async function startPlay(page: Page, project: Project): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project); await page.getByTestId("mode-play").click(); await startNewGameFromTitle(page); await expect(page.getByTestId("runtime-state-json")).toBeVisible();
}

type Geometry = { readonly window: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly bottom: number }; readonly face?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }; readonly choicesBottom?: number };

async function dialogueGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const box = document.querySelector('[data-testid="dialogue-box"]');
    if (!(box instanceof HTMLElement)) throw new Error("missing dialogue box");
    const windowRect = box.getBoundingClientRect();
    const face = document.querySelector('[data-testid="dialogue-face"]');
    const choices = document.querySelector('[data-testid="runtime-choices"]');
    const rect = (bounds: DOMRect) => ({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom });
    return {
      window: rect(windowRect),
      face: face instanceof HTMLElement ? rect(face.getBoundingClientRect()) : undefined,
      choicesBottom: choices instanceof HTMLElement ? choices.getBoundingClientRect().bottom : undefined,
    };
  });
}

async function editCommand(page: Page, kind: Command["kind"], action: (command: Locator) => Promise<void>): Promise<void> {
  const command = page.getByTestId(`event-command-${kind}`).first();
  await command.scrollIntoViewIfNeeded();
  await command.evaluate((node) => node.classList.add("editing"));
  await expect(command).toHaveClass(/editing/);
  await action(command);
}

async function fillAndChange(locator: Locator, value: string): Promise<void> {
  await locator.fill(value);
  await dispatchChange(locator);
}

async function applyAndClose(page: Page): Promise<void> {
  await page.getByTestId("event-editor-apply").click();
  await closeEditor(page);
}

async function closeEditor(page: Page): Promise<void> {
  await page.getByTestId("event-editor-modal-close").click();
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

function assertExport(state: DebugState): void {
  const dialogue = commandsOf(state, "ev_loop12_dialogue");
  expect(dialogue).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "displayTextSettings", format: "normal", position: "bottom" }),
    expect.objectContaining({ kind: "changeFace", resourceId: "easyrpg-faceset-actor1-02", position: "right", flipHorizontally: true }),
    expect.objectContaining({ kind: "text", speaker: "Loop12 NPC", body: FACE_TEXT }),
    expect.objectContaining({ kind: "choices", options: expect.arrayContaining([expect.objectContaining({ text: "Omega" })]) }),
  ]));
  expect(commandsOf(state, "ev_loop12_top")).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "displayTextSettings", format: "transparent", position: "top" }), expect.objectContaining({ kind: "text", body: TOP_TEXT })]));
  expect(commandsOf(state, "ev_loop12_two")).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "choices", cancelBehavior: "branch" })]));
}

function commandsOf(state: DebugState, eventId: string): readonly Command[] {
  return state.project.maps[state.project.startMapId]?.events.find((event) => event.id === eventId)?.pages?.[0]?.commands ?? [];
}

function dialogueChoiceProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  map.events.push(
    event("ev_loop12_dialogue", 4, 5, [
      { kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: true, allowEventMovementDuringWait: false },
      { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-00", position: "left", flipHorizontally: false },
      { kind: "text", speaker: "Draft", body: "Draft" },
      { kind: "choices", prompt: "Draft", cancelBehavior: "choice2", options: FIVE_OPTIONS.map((text, index) => ({ text, branch: index === 4 ? [{ kind: "setVariable", variableId: "var_loop12_choice", op: "=", value: 5 }, { kind: "text", speaker: "Branch", body: CHOICE_TEXT }] : [] })) },
    ]),
    event("ev_loop12_top", 5, 5, [
      { kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: true, allowEventMovementDuringWait: false },
      { kind: "text", speaker: "System", body: "Draft" },
    ]),
    event("ev_loop12_two", 6, 5, [
      { kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: true, allowEventMovementDuringWait: false },
      { kind: "choices", prompt: "Draft", cancelBehavior: "branch", cancelBranch: [{ kind: "setVariable", variableId: "var_loop12_cancel", op: "=", value: -1 }, { kind: "text", speaker: "Cancel", body: CANCEL_TEXT }], options: TWO_OPTIONS.map((text) => ({ text, branch: [] })) },
    ])
  );
  return project;
}

function event(id: string, x: number, y: number, commands: Command[]): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: `${id}_page`,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
}
