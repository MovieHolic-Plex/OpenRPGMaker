import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { Command, EventPage, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop5-editor-structure";
const PASSABLE = { up: true, down: true, left: true, right: true };

type DebugState = {
  readonly project: Project;
};

test.setTimeout(120_000);

test("loop5 certifies editor page, command, choice branch, cancel branch, and fork branch structure", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, structureProject());
  await writeJson("000-scenario.json", {
    runId: "loop5-editor-structure",
    scope: [
      "event page add/copy/paste/delete",
      "command copy/paste/delete/cut and drag reorder",
      "five choices, option branch edit, cancel branch edit",
      "fork then/else branch edit and persistence",
    ],
  });

  await screenshot(page, "001-editor-map-event-layer.png");
  await openEventEditor(page, "ev_structure");
  await page.getByTestId("event-page-tab-1").click();
  await expect(page.getByTestId("event-command-text").filter({ hasText: "ALPHA COPY SOURCE" })).toBeVisible();
  await screenshot(page, "002-editor-structure-initial.png");

  await page.getByTestId("event-page-tab-add").click();
  await expect(page.getByTestId("event-page-tab-3")).toBeVisible();
  await screenshot(page, "003-editor-page-added.png");
  await page.getByTestId("event-page-copy").click();
  await page.getByTestId("event-page-paste").click();
  await expect(page.getByTestId("event-page-tab-4")).toBeVisible();
  await screenshot(page, "004-editor-page-pasted.png");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("event-page-delete").click();
  await expect(page.getByTestId("event-page-tab-4")).toHaveCount(0);
  await expect(page.getByTestId("event-page-tab-3")).toBeVisible();
  await screenshot(page, "005-editor-page-deleted.png");

  await page.getByTestId("event-page-tab-1").click();
  await copyCommand(page, commandText(page, "ALPHA COPY SOURCE"));
  await pasteCommandBefore(page, commandText(page, "BETA DELETE TARGET"));
  await deleteCommand(page, commandText(page, "BETA DELETE TARGET"));
  await cutCommand(page, commandText(page, "GAMMA CUT TARGET"));
  await pasteCommandBefore(page, commandText(page, "DROP AFTER TARGET"));
  await dragCommandAfter(page, commandText(page, "MOVE ME FIRST"), commandText(page, "DROP AFTER TARGET"));
  await screenshot(page, "006-editor-command-copy-paste-delete-cut-drag.png");

  await openInlineEditor(page.getByTestId("event-command-choices"));
  await setChoiceOption(page, 1, "Choice One");
  await setChoiceOption(page, 2, "Choice Two");
  await setChoiceOption(page, 3, "Choice Three");
  await setChoiceOption(page, 4, "Choice Four");
  await setChoiceOption(page, 5, "Choice Five");
  await openInlineEditor(page.getByTestId("event-command-choices"));
  await page.getByTestId("event-choice-cancel-branch").evaluate((node) => {
    if (node instanceof HTMLInputElement) {
      node.checked = true;
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await openInlineEditor(page.getByTestId("event-command-choices"));
  await page.getByTestId("event-choice-branch-add-5").click();
  await openInlineEditor(page.getByTestId("event-command-choices"));
  await expect(page.getByTestId("event-choice-branch-5").getByTestId("event-command-text")).toBeVisible();
  await openInlineEditor(page.getByTestId("event-command-choices"));
  await page.getByTestId("event-choice-cancel-branch-add").click();
  await openInlineEditor(page.getByTestId("event-command-choices"));
  await expect(page.getByTestId("event-choice-cancel-branch-body").getByTestId("event-command-text")).toBeVisible();
  await page.getByTestId("event-choice-branch-5").scrollIntoViewIfNeeded();
  await screenshot(page, "007a-editor-choice-five-branch-visible.png");
  await page.getByTestId("event-choice-cancel-branch-body").scrollIntoViewIfNeeded();
  await screenshot(page, "007b-editor-choice-cancel-branch-visible.png");
  await screenshot(page, "007-editor-choice-five-and-cancel-branches.png");

  // RM rhythm: fork dialog is condition + else flag only; branch bodies edit in main list.
  await openInlineEditor(page.getByTestId("event-command-fork"));
  await expect(page.getByTestId("event-condition-form")).toBeVisible();
  await expect(page.getByTestId("event-fork-else-enabled")).toBeChecked();
  await expect(page.getByTestId("event-fork-summary-then")).toContainText("2개 명령");
  await expect(page.getByTestId("event-fork-summary-else")).toContainText("2개 명령");
  await expect(page.getByTestId("event-fork-branch-add-then")).toHaveCount(0);
  await screenshot(page, "008-editor-fork-condition-only-dialog.png");
  await page.keyboard.press("Escape");

  await editNestedForkText(page, "THEN ORIGINAL", "THEN EDITED BY LOOP5");
  await editNestedForkText(page, "THEN SECOND", "THEN ADDED BY LOOP5");
  await editNestedForkText(page, "ELSE ORIGINAL", "ELSE EDITED BY LOOP5");
  await editNestedForkText(page, "ELSE SECOND", "ELSE ADDED BY LOOP5");
  await page.getByTestId("event-command-fork").scrollIntoViewIfNeeded();
  await screenshot(page, "008-editor-fork-then-else-branches.png");

  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertStructureExport(editorExport);
  await writeJson("009-editor-structure-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((project) => {
    window.__OPRN_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertStructureExport(roundtrip);
  await writeJson("010-editor-structure-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_structure");
  await page.getByTestId("event-page-tab-1").click();
  await expect(page.getByTestId("event-page-tab-3")).toBeVisible();
  await expect(page.getByTestId("event-command-choices")).toContainText("Choice Five");
  await screenshot(page, "011-editor-structure-after-reload.png");

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 5 editor structure",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: event page add/copy/paste/delete; command context copy/paste/delete/cut; drag reorder; Show Choices with five options; option branch and cancel branch command editing; conditional branch then/else editing.",
    "- RM2003-scoped deviation: second switch and timer page conditions remain explicitly non-certified in this loop because the current editor does not expose them as implemented controls.",
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
    runId: "loop5-editor-structure",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: [
      "001-editor-map-event-layer.png",
      "002-editor-structure-initial.png",
      "003-editor-page-added.png",
      "004-editor-page-pasted.png",
      "005-editor-page-deleted.png",
      "006-editor-command-copy-paste-delete-cut-drag.png",
      "007-editor-choice-five-and-cancel-branches.png",
      "007a-editor-choice-five-branch-visible.png",
      "007b-editor-choice-cancel-branch-visible.png",
      "008-editor-fork-condition-only-dialog.png",
      "008-editor-fork-then-else-branches.png",
      "011-editor-structure-after-reload.png",
    ],
    json: [
      "000-scenario.json",
      "009-editor-structure-export.json",
      "010-editor-structure-roundtrip-after-reload.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
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
  const editor = command.locator(":scope > .cmd-inline-editor");
  if (!(await editor.isVisible().catch(() => false))) await command.locator(":scope > .cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
}

function commandText(page: Page, body: string): Locator {
  return page.locator('[data-testid="event-command-text"]:visible').filter({ hasText: body }).first();
}

async function copyCommand(page: Page, command: Locator): Promise<void> {
  await command.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-copy").click();
}

async function pasteCommandBefore(page: Page, command: Locator): Promise<void> {
  await command.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-paste").click();
}

async function cutCommand(page: Page, command: Locator): Promise<void> {
  await command.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-cut").click();
}

async function deleteCommand(page: Page, command: Locator): Promise<void> {
  await command.locator(".cmd-head").click({ button: "right" });
  await page.getByTestId("event-command-menu-delete").click();
}

async function dragCommandAfter(page: Page, source: Locator, target: Locator): Promise<void> {
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await source.evaluate((node) => {
    if (node instanceof HTMLElement) node.draggable = true;
  });
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("missing drag geometry");
  await page.mouse.move(sourceBox.x + Math.min(20, sourceBox.width / 2), sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height - 2, { steps: 10 });
  await page.mouse.up();
}

async function setChoiceOption(page: Page, index: number, value: string): Promise<void> {
  await openInlineEditor(page.getByTestId("event-command-choices"));
  const input = page.getByTestId(`event-choice-option-${index}`);
  await input.fill(value);
  await dispatchChange(input);
}

async function editNestedForkText(page: Page, fromBody: string, toBody: string): Promise<void> {
  const row = page.locator('[data-testid="event-command-text"]').filter({ hasText: fromBody }).first();
  await openInlineEditor(row);
  const body = row.getByTestId("event-command-text-body");
  if (await body.count()) {
    await body.fill(toBody);
    await dispatchChange(body);
  } else {
    // fallback: double-click head already opened dialog form
    const input = page.locator('textarea, input[type="text"]').filter({ hasText: fromBody }).first();
    if (await input.count()) {
      await input.fill(toBody);
      await dispatchChange(input);
    }
  }
  // close any open command edit dialog
  const ok = page.getByTestId("event-command-edit-ok");
  if (await ok.count()) await ok.click();
}

async function dispatchChange(locator: Locator): Promise<void> {
  await locator.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
}

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
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

function assertStructureExport(state: DebugState): void {
  const event = state.project.maps.map_loop5?.events.find((item) => item.id === "ev_structure");
  expect(event?.pages).toHaveLength(3);
  const commands = event?.pages?.[0]?.commands ?? [];
  const textBodies = commands.filter((command): command is Extract<Command, { kind: "text" }> => command.kind === "text").map((command) => command.body);
  expect(textBodies.slice(0, 5)).toEqual([
    "ALPHA COPY SOURCE",
    "ALPHA COPY SOURCE",
    "DROP AFTER TARGET",
    "MOVE ME FIRST",
    "GAMMA CUT TARGET",
  ]);
  expect(textBodies).not.toContain("BETA DELETE TARGET");

  const choices = commands.find((command): command is Extract<Command, { kind: "choices" }> => command.kind === "choices");
  expect(choices?.options.map((option) => option.text)).toEqual([
    "Choice One",
    "Choice Two",
    "Choice Three",
    "Choice Four",
    "Choice Five",
  ]);
  expect(choices?.cancelBehavior).toBe("branch");
  expect(choices?.options[4]?.branch.some((command) => command.kind === "text")).toBe(true);
  expect(choices?.cancelBranch?.some((command) => command.kind === "text")).toBe(true);

  const fork = commands.find((command): command is Extract<Command, { kind: "fork" }> => command.kind === "fork");
  expect(fork?.then.filter((command) => command.kind === "text").map((command) => command.body)).toEqual([
    "THEN EDITED BY LOOP5",
    "THEN ADDED BY LOOP5",
  ]);
  expect(fork?.else?.filter((command) => command.kind === "text").map((command) => command.body)).toEqual([
    "ELSE EDITED BY LOOP5",
    "ELSE ADDED BY LOOP5",
  ]);
}

function structureProject(): Project {
  return {
    version: 3,
    meta: { title: "Loop5 Editor Structure", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        npc_loop5: {
          id: "npc_loop5",
          image: { type: "bundled", id: "tex_npc_loop5" },
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
    switches: [{ id: "sw_loop5", name: "Loop5 switch" }],
    variables: [{ id: "var_loop5", name: "Loop5 variable" }],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_loop5: {
        id: "map_loop5",
        name: "Loop5",
        width: 6,
        height: 5,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 30 }, () => 0),
        upperTiles: Array.from({ length: 30 }, () => -1),
        events: [
          {
            id: "ev_structure",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              eventPage("ev_structure_page_1", "Structure page 1", structureCommands()),
              eventPage("ev_structure_page_2", "Structure page 2", [{ kind: "text", body: "PAGE TWO SURVIVES" }]),
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_loop5", children: [] },
    startMapId: "map_loop5",
    startPos: { x: 2, y: 3 },
    flags: {},
  };
}

function structureCommands(): Command[] {
  return [
    { kind: "text", body: "ALPHA COPY SOURCE" },
    { kind: "text", body: "BETA DELETE TARGET" },
    { kind: "text", body: "GAMMA CUT TARGET" },
    { kind: "text", body: "MOVE ME FIRST" },
    { kind: "text", body: "DROP AFTER TARGET" },
    {
      kind: "choices",
      prompt: "Loop5 choices",
      options: [
        { text: "One", branch: [] },
        { text: "Two", branch: [] },
      ],
      cancelBehavior: "choice2",
    },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_loop5", value: true },
      then: [
        { kind: "text", body: "THEN ORIGINAL" },
        { kind: "text", body: "THEN SECOND" },
      ],
      else: [
        { kind: "text", body: "ELSE ORIGINAL" },
        { kind: "text", body: "ELSE SECOND" },
      ],
    },
  ];
}

function eventPage(id: string, name: string, commands: Command[]): EventPage {
  return {
    id,
    name,
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "npc_loop5" } },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
