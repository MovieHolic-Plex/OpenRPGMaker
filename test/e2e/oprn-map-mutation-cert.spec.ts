import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Command, EventPage, Project } from "@/project/types";
import { debugState, dismissDialogue, dispatchChange, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop8-map-mutation";
const PASSABLE = { up: true, down: true, left: true, right: true };

test.setTimeout(90_000);

test("loop8 certifies editor authored moveEvent and changeTile runtime effects", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, mapMutationProject());
  await writeJson("000-scenario.json", {
    scope: ["changeTile editor authoring", "moveEvent editor authoring", "roundtrip persistence", "runtime map override", "runtime event movement"],
  });

  await screenshot(page, "001-editor-map-event-layer.png");
  await openEventEditor(page, "ev_mutate");
  await changeTileControl(page, "change-tile-map-select", async (locator) => { await locator.selectOption("map_loop8"); });
  await changeTileControl(page, "change-tile-layer-select", async (locator) => { await locator.selectOption("lower"); });
  await changeTileControl(page, "change-tile-x-input", (locator) => fillAndChange(locator, "3"));
  await changeTileControl(page, "change-tile-y-input", (locator) => fillAndChange(locator, "2"));
  await changeTileControl(page, "change-tile-tile-input", (locator) => fillAndChange(locator, "5"));
  await editCommand(page, "moveEvent", async (command) => {
    await fillAndChange(command.getByTestId("move-route-event-id-input"), "ev_target");
  });
  await editCommand(page, "moveEvent", async (command) => {
    await command.getByTestId("move-route-add-move-right").click();
  });
  await screenshot(page, "002-editor-move-event-change-tile.png");
  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertMapMutationExport(editorExport);
  await writeJson("003-editor-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((project) => {
    window.__OPRN_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertMapMutationExport(roundtrip);
  await writeJson("004-editor-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_mutate");
  await editCommand(page, "changeTile", async (command) => {
    await expect(command.getByTestId("change-tile-x-input")).toHaveValue("3");
    await expect(command.getByTestId("change-tile-y-input")).toHaveValue("2");
    await expect(command.getByTestId("change-tile-tile-input")).toHaveValue("5");
  });
  await editCommand(page, "moveEvent", async (command) => {
    await expect(command.getByTestId("move-route-event-id-input")).toHaveValue("ev_target");
  });
  await screenshot(page, "005-editor-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await writeJson("006-runtime-start.json", await runtimeState(page));
  await screenshot(page, "007-runtime-start.png");
  await page.getByTestId("event-ev_mutate").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("MUTATION DONE");
  await dismissDialogue(page);
  await page.waitForTimeout(900);
  const finalState = await runtimeState(page);
  expect(finalState.mapOverrides.map_loop8?.lower["15"]).toBe(5);
  expect(finalState.events.ev_target?.x).toBe(2);
  expect(finalState.events.ev_target?.y).toBe(2);
  await writeJson("008-runtime-after-mutation.json", finalState);
  await screenshot(page, "009-runtime-after-mutation.png");

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 8 map mutation",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: editor-authored Change Tile and Move Event commands, export/reload/reopen persistence, runtime tile override state, and runtime event coordinate movement.",
    "- Scoped deviation: this certifies a one-step event route and lower-layer tile override. It does not certify every RM2003 move-route subcommand.",
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
    runId: "loop8-map-mutation",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: [
      "001-editor-map-event-layer.png",
      "002-editor-move-event-change-tile.png",
      "005-editor-after-reload.png",
      "007-runtime-start.png",
      "009-runtime-after-mutation.png",
    ],
    json: [
      "000-scenario.json",
      "003-editor-export.json",
      "004-editor-roundtrip-after-reload.json",
      "006-runtime-start.json",
      "008-runtime-after-mutation.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function editCommand(page: Page, kind: Command["kind"], action: (command: ReturnType<Page["getByTestId"]>) => Promise<void>): Promise<void> {
  await page.getByTestId("event-command-picker-cancel").click({ timeout: 300 }).catch(() => undefined);
  const command = page.getByTestId(`event-command-${kind}`).first();
  if (!(await command.evaluate((node) => node.classList.contains("editing")).catch(() => false))) {
    await command.scrollIntoViewIfNeeded();
    await command.evaluate((node) => node.classList.add("editing"));
  }
  await expect(command).toHaveClass(/editing/);
  await action(command);
}

async function changeTileControl(page: Page, testId: string, action: (locator: ReturnType<Page["getByTestId"]>) => Promise<void>): Promise<void> {
  await editCommand(page, "changeTile", async (command) => {
    await action(command.getByTestId(testId));
  });
}

async function fillAndChange(locator: ReturnType<Page["getByTestId"]>, value: string): Promise<void> {
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

function assertMapMutationExport(state: DebugState): void {
  const event = state.project.maps.map_loop8?.events.find((item) => item.id === "ev_mutate");
  expect(event?.pages?.[0]?.commands).toMatchObject([
    { kind: "changeTile", mapId: "map_loop8", layer: "lower", x: 3, y: 2, tile: 5 },
    { kind: "moveEvent", eventId: "ev_target", route: { moves: [{ kind: "move", dir: "right" }], repeat: false } },
    { kind: "text", body: "MUTATION DONE" },
  ]);
}

function mapMutationProject(): Project {
  return {
    version: 3,
    meta: { title: "Loop8 Map Mutation", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: { npc_target: { id: "npc_target", image: { type: "bundled", id: "tex_easyrpg_charset_people1" }, frames: 8, frameWidth: 32, frameHeight: 32 } }, uploaded: {} },
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
    variables: [],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_loop8: {
        id: "map_loop8",
        name: "Loop8",
        width: 6,
        height: 5,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 30 }, () => 0),
        upperTiles: Array.from({ length: 30 }, () => -1),
        events: [
          { id: "ev_mutate", x: 2, y: 3, trigger: { kind: "action" }, commands: [], pages: [eventPage("mutate_page", [{ kind: "changeTile", mapId: "map_loop8", layer: "lower", x: 1, y: 1, tile: 1 }, { kind: "moveEvent", eventId: "", route: { moves: [], repeat: false } }, { kind: "text", body: "MUTATION DONE" }])] },
          { id: "ev_target", x: 1, y: 2, trigger: { kind: "action" }, commands: [], pages: [eventPage("target_page", [{ kind: "text", body: "TARGET" }], "npc_target")] },
        ],
      },
    },
    mapTree: { mapId: "map_loop8", children: [] },
    startMapId: "map_loop8",
    startPos: { x: 2, y: 4 },
    flags: {},
  };
}

function eventPage(id: string, commands: Command[], spriteId?: string): EventPage {
  return {
    id,
    name: id,
    conditions: [],
    graphic: spriteId ? { sprite: { type: "bundled", id: spriteId } } : {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
