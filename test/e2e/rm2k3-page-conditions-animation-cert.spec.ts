import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Command, EventPage, Project } from "@/project/types";
import { debugState, dismissDialogue, dispatchChange, openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText, type DebugState } from "./eventEditorCertEvidence";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop6-page-conditions-animation";
const PASSABLE = { up: true, down: true, left: true, right: true };

test.setTimeout(90_000);

test("loop6 certifies second switch timer page conditions and animation type authoring", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, conditionProject());
  await writeJson("000-scenario.json", {
    runId: "loop6-page-conditions-animation",
    scope: [
      "second switch page condition authoring",
      "timer1 and timer2 page condition authoring",
      "animation type authoring",
      "save/export reload reopen persistence",
      "runtime page resolution with two switches and two timers",
    ],
  });

  await screenshot(page, "001-editor-map-event-layer.png");
  await openEventEditor(page, "ev_gate");
  await page.getByTestId("event-page-tab-2").click();
  await page.getByTestId("event-page-switch-condition-input").fill("sw_a");
  await dispatchChange(page.getByTestId("event-page-switch-condition-input"));
  await page.getByTestId("event-page-switch2-condition-input").fill("sw_b");
  await dispatchChange(page.getByTestId("event-page-switch2-condition-input"));
  await page.getByTestId("event-page-timer1-condition-seconds").fill("10");
  await dispatchChange(page.getByTestId("event-page-timer1-condition-seconds"));
  await page.getByTestId("event-page-timer2-condition-seconds").fill("3");
  await dispatchChange(page.getByTestId("event-page-timer2-condition-seconds"));
  await screenshot(page, "002-editor-second-switch-and-timer-conditions.png");
  await page.getByTestId("event-editor-apply").click();
  await page.getByTestId("event-editor-modal-close").click();

  await openEventEditor(page, "ev_anim");
  await page.getByTestId("event-page-animation-type").selectOption("fixedGraphic");
  await screenshot(page, "003-editor-animation-type-fixed-graphic.png");
  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertLoop6Export(editorExport);
  await writeJson("004-editor-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertLoop6Export(roundtrip);
  await writeJson("005-editor-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_gate");
  await page.getByTestId("event-page-tab-2").click();
  await expect(page.getByTestId("event-page-switch2-condition-input")).toHaveValue("sw_b");
  await expect(page.getByTestId("event-page-timer1-condition-seconds")).toHaveValue("10");
  await expect(page.getByTestId("event-page-timer2-condition-seconds")).toHaveValue("3");
  await screenshot(page, "006-editor-conditions-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();
  await openEventEditor(page, "ev_anim");
  await expect(page.getByTestId("event-page-animation-type")).toHaveValue("fixedGraphic");
  await screenshot(page, "007-editor-animation-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await writeJson("008-runtime-start-state.json", await runtimeState(page));
  await screenshot(page, "009-runtime-start.png");

  await page.getByTestId("event-ev_setup").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("SWITCHES SET");
  await dismissDialogue(page);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_a).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_b).toBe(true);
  await page.getByTestId("event-ev_gate").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("GATED PAGE ACTIVE");
  await expect.poll(async () => (await runtimeState(page)).events.ev_gate?.pageId).toBe("gate_page_open");
  const finalState = await runtimeState(page);
  await writeJson("010-runtime-gated-page-open.json", finalState);
  await screenshot(page, "011-runtime-gated-page-open.png");

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 6 page conditions and animation",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: authoring two switch page conditions, authoring Timer 1 and Timer 2 page conditions as seconds-or-less gates, authoring animation type, persistence through export/reload/reopen, and runtime page resolution using those gates.",
    "- Scoped deviation: timer page conditions read project/session timer values by `timer1` and `timer2`; this loop does not certify full countdown UI parity beyond page condition resolution.",
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
    runId: "loop6-page-conditions-animation",
    criticalGate: {
      minimumScore: 9,
      result: "PENDING_REVIEW",
      rubric: ".omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/E-critical-gate-rubric.md",
    },
    screenshots: [
      "001-editor-map-event-layer.png",
      "002-editor-second-switch-and-timer-conditions.png",
      "003-editor-animation-type-fixed-graphic.png",
      "006-editor-conditions-after-reload.png",
      "007-editor-animation-after-reload.png",
      "009-runtime-start.png",
      "011-runtime-gated-page-open.png",
    ],
    json: [
      "000-scenario.json",
      "004-editor-export.json",
      "005-editor-roundtrip-after-reload.json",
      "008-runtime-start-state.json",
      "010-runtime-gated-page-open.json",
      "cleanup-receipt.json",
    ],
    notes: ["rm2003-comparison-note.md"],
  });
});

async function screenshot(page: Page, name: string): Promise<void> {
  await screenshotEvidence(page, EVIDENCE_DIR, name);
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeEvidenceJson(EVIDENCE_DIR, name, value);
}

async function writeText(name: string, value: string): Promise<void> {
  await writeEvidenceText(EVIDENCE_DIR, name, value);
}

function assertLoop6Export(state: DebugState): void {
  const gate = state.project.maps.map_loop6?.events.find((event) => event.id === "ev_gate");
  const openPage = gate?.pages?.find((page) => page.id === "gate_page_open");
  expect(openPage?.conditions).toEqual([
    { kind: "switch", switchId: "sw_a", value: true },
    { kind: "switch", switchId: "sw_b", value: true },
    { kind: "timer", timerId: "timer1", seconds: 10 },
    { kind: "timer", timerId: "timer2", seconds: 3 },
  ]);
  const anim = state.project.maps.map_loop6?.events.find((event) => event.id === "ev_anim");
  expect(anim?.pages?.[0]?.animationType).toBe("fixedGraphic");
}

function conditionProject(): Project {
  return {
    version: 3,
    meta: { title: "Loop6 Page Conditions Animation", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        npc_loop6: {
          id: "npc_loop6",
          image: { type: "bundled", id: "tex_npc_loop6" },
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
      { id: "sw_a", name: "Switch A" },
      { id: "sw_b", name: "Switch B" },
    ],
    variables: [],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, timers: { timer1: 5, timer2: 3 }, inventory: {}, partyActorIds: [] },
    maps: {
      map_loop6: {
        id: "map_loop6",
        name: "Loop6",
        width: 6,
        height: 5,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 30 }, () => 0),
        upperTiles: Array.from({ length: 30 }, () => -1),
        events: [
          {
            id: "ev_setup",
            x: 1,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("setup_page", [{ kind: "setSwitch", switchId: "sw_a", value: true }, { kind: "setSwitch", switchId: "sw_b", value: true }, { kind: "text", body: "SWITCHES SET" }])],
          },
          {
            id: "ev_gate",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              eventPage("gate_page_closed", [{ kind: "text", body: "GATE CLOSED" }]),
              eventPage("gate_page_open", [{ kind: "text", body: "GATED PAGE ACTIVE" }]),
            ],
          },
          {
            id: "ev_anim",
            x: 3,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [eventPage("anim_page", [{ kind: "text", body: "ANIMATION EVENT" }])],
          },
        ],
      },
    },
    mapTree: { mapId: "map_loop6", children: [] },
    startMapId: "map_loop6",
    startPos: { x: 2, y: 3 },
    flags: {},
  };
}

function eventPage(id: string, commands: Command[]): EventPage {
  return {
    id,
    name: id,
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "npc_loop6" } },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}
