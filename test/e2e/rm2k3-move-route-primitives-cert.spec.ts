import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Command, EventPage, MoveCommand, Project } from "@/project/types";
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
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

const EVIDENCE_DIR = "output/evidence/event-editor-cert/loop17-move-route-primitives";
const PASSABLE = { up: true, down: true, left: true, right: true };

test.setTimeout(100_000);

test("loop17 certifies move route primitive authoring persistence and runtime effects", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, moveRouteProject());
  await writeJson("000-scenario.json", {
    scope: [
      "moveEvent route editor authoring",
      "route primitive persistence after reload",
      "runtime route movement and jump",
      "runtime switch opacity speed frequency through direction-fix animation effects",
    ],
  });

  await screenshot(page, "001-editor-map-event-layer.png");
  await openEventEditor(page, "ev_route_controller");
  await configureRoute(page);
  await openCommandEditor(routeCommand(page));
  await screenshot(page, "002-editor-move-route-primitives-authoring.png");
  await page.getByTestId("event-editor-apply").click();
  const editorExport = await debugState(page);
  assertRouteExport(editorExport);
  await writeJson("003-editor-export.json", editorExport);
  await page.getByTestId("event-editor-modal-close").click();

  await page.addInitScript((project) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
  }, editorExport.project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const roundtrip = await debugState(page);
  assertRouteExport(roundtrip);
  await writeJson("004-editor-roundtrip-after-reload.json", roundtrip);
  await openEventEditor(page, "ev_route_controller");
  await openCommandEditor(routeCommand(page));
  await expect(routeCommand(page).getByTestId("move-route-event-id-input")).toHaveValue("ev_route_target");
  await expect(routeCommand(page).getByTestId("move-route-switch-id-input")).toHaveValue("sw_route_seen");
  await screenshot(page, "005-editor-move-route-after-reload.png");
  await page.getByTestId("event-editor-modal-close").click();

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  const before = await runtimeState(page);
  expect(before.events.ev_route_target).toMatchObject({ x: 2, y: 3 });
  await writeJson("006-runtime-before-route.json", before);
  await screenshot(page, "007-runtime-before-route.png");

  await page.getByTestId("event-ev_route_controller").click();
  await expect(page.getByTestId("audio-indicator")).toContainText("se_route_chime", { timeout: 15_000 });
  await expect.poll(async () => (await runtimeState(page)).events.ev_route_target?.x, { timeout: 20_000 }).toBe(3);
  await expect.poll(async () => (await runtimeState(page)).events.ev_route_target?.y, { timeout: 20_000 }).toBe(2);
  const throughState = await runtimeState(page);
  expect(throughState.player).toMatchObject({ x: 3, y: 2 });
  expect(throughState.events.ev_route_target).toMatchObject({ x: 3, y: 2 });
  await writeJson("008-runtime-through-player-overlap.json", throughState);
  await screenshot(page, "009-runtime-through-player-overlap.png");

  await expect.poll(async () => (await runtimeState(page)).events.ev_route_target?.x, { timeout: 20_000 }).toBe(3);
  await expect.poll(async () => (await runtimeState(page)).events.ev_route_target?.y, { timeout: 20_000 }).toBe(4);
  await expect.poll(async () => (await runtimeState(page)).movers?.ev_route_target?.activeMove, { timeout: 20_000 }).toBeNull();
  const after = await runtimeState(page);
  expect(after.switches.sw_route_seen).toBe(true);
  expect(after.movers?.ev_route_target).toMatchObject({
    directionFix: true,
    through: true,
    animationEnabled: false,
    opacity: 191,
    speedRank: 4,
    frequencyRank: 4,
    remainingMoveCount: 0,
    activeMove: null,
  });
  const sprite = await eventSpriteDebug(page, "ev_route_target");
  expect(sprite.alpha).toBeCloseTo(191 / 255, 2);
  expect(sprite.textureKey).toBe("tex_easyrpg_charset_actor1");
  await writeJson("010-runtime-after-route.json", after);
  await writeJson("011-runtime-route-audio.json", await audioState(page));
  await writeJson("012-runtime-route-sprite-debug.json", sprite);
  await screenshot(page, "013-runtime-after-route-visible.png");

  await writeText("rm2003-comparison-note.md", [
    "# RM2003 comparison note - Loop 17 move route primitives",
    "",
    "- Baseline source: `.omo/teams/019f135a-1dd7-7691-b6a1-0686a7ae9dbc/artifacts/A-rm2003-reference.md`.",
    "- Certified here: Move Event route editing, reload persistence, switch ON, direction fix ON, through ON into the player tile, animation OFF state, opacity decrease with sprite alpha proof, speed/frequency rank mutation, graphic change texture proof, SE playback state, diagonal movement, and default forward jump movement.",
    "- Scoped deviation: jump parameter editing is not certified here because the current low-level route editor exposes the RM-style Jump button but not a separate dx/dy dialog. Speed/frequency certification is rank/state based, not a frame-timing benchmark.",
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
    runId: "loop17-move-route-primitives",
    criticalGate: { minimumScore: 9, result: "PENDING_REVIEW" },
    screenshots: ["001-editor-map-event-layer.png", "002-editor-move-route-primitives-authoring.png", "005-editor-move-route-after-reload.png", "007-runtime-before-route.png", "009-runtime-through-player-overlap.png", "013-runtime-after-route-visible.png"],
    json: ["000-scenario.json", "003-editor-export.json", "004-editor-roundtrip-after-reload.json", "006-runtime-before-route.json", "008-runtime-through-player-overlap.json", "010-runtime-after-route.json", "011-runtime-route-audio.json", "012-runtime-route-sprite-debug.json", "cleanup-receipt.json"],
    notes: ["rm2003-comparison-note.md", "manifest.json"],
  });
});

async function configureRoute(page: Page): Promise<void> {
  await openCommandEditor(routeCommand(page));
  await fillAndChange(routeCommand(page).getByTestId("move-route-event-id-input"), "ev_route_target");
  await openCommandEditor(routeCommand(page));
  await routeCommand(page).getByTestId("move-route-repeat-checkbox").uncheck();
  await openCommandEditor(routeCommand(page));
  await routeCommand(page).getByTestId("move-route-switch-id-input").fill("sw_route_seen");
  await openCommandEditor(routeCommand(page));
  await routeCommand(page).getByTestId("move-route-graphic-id-input").fill("tex_easyrpg_charset_people1");
  await openCommandEditor(routeCommand(page));
  await routeCommand(page).getByTestId("move-route-sound-id-input").fill("se_route_chime");
  await openCommandEditor(routeCommand(page));
  await routeCommand(page).getByTestId("move-route-clear").click();
  for (const id of ["increase-speed", "increase-frequency", "direction-fix-on", "through-on", "animation-off", "decrease-opacity", "switch-on", "change-graphic", "play-se", "move-upper-right", "jump"]) {
    await openCommandEditor(routeCommand(page));
    await routeCommand(page).getByTestId(`move-route-add-${id}`).click();
  }
}

async function fillAndChange(locator: Locator, value: string): Promise<void> {
  await locator.fill(value);
  await dispatchChange(locator);
}

async function openCommandEditor(command: Locator): Promise<void> {
  const editor = command.locator(":scope > .cmd-inline-editor");
  if (!(await editor.isVisible())) await command.locator(":scope > .cmd-head").dblclick();
  await expect(command).toHaveClass(/editing/);
  await expect(editor).toBeVisible();
}

function routeCommand(page: Page): Locator {
  return page.getByTestId("event-command-moveEvent").first();
}

async function audioState(page: Page): Promise<unknown> {
  const text = await page.getByTestId("audio-state-json").textContent();
  if (!text) throw new Error("missing audio state");
  return JSON.parse(text);
}

async function eventSpriteDebug(page: Page, eventId: string): Promise<EventSpriteSample> {
  return page.evaluate((id) => {
    const isRecord = (value: unknown): value is Record<string, unknown> => {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    };
    const hook = Reflect.get(globalThis, "__rpgzzuCharacterSprites");
    if (typeof hook !== "function") throw new Error("missing character sprite hook");
    const state = hook();
    if (!isRecord(state) || !isRecord(state.events)) throw new Error("invalid character sprite hook state");
    const sprite = state.events[id];
    if (!isRecord(sprite)) throw new Error(`missing sprite ${id}`);
    const alpha = sprite.alpha;
    const frame = sprite.frame;
    const textureKey = sprite.textureKey;
    const x = sprite.x;
    const y = sprite.y;
    if (typeof alpha !== "number" || typeof textureKey !== "string" || typeof x !== "number" || typeof y !== "number") {
      throw new Error(`invalid sprite sample ${id}`);
    }
    return { alpha, frame: String(frame), textureKey, x, y };
  }, eventId);
}

type EventSpriteSample = {
  readonly alpha: number;
  readonly frame: string;
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
};

async function screenshot(page: Page, name: string): Promise<void> {
  await screenshotEvidence(page, EVIDENCE_DIR, name);
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeEvidenceJson(EVIDENCE_DIR, name, value);
}

async function writeText(name: string, value: string): Promise<void> {
  await writeEvidenceText(EVIDENCE_DIR, name, value);
}

function assertRouteExport(state: DebugState): void {
  const commands = state.project.maps.map_loop17?.events.find((event) => event.id === "ev_route_controller")?.pages?.[0]?.commands;
  expect(commands).toMatchObject([{ kind: "moveEvent", eventId: "ev_route_target", route: { repeat: false, moves: finalRoute() } }]);
}

function finalRoute(): MoveCommand[] {
  return [
    { kind: "changeSpeed", delta: 1 },
    { kind: "changeFrequency", delta: 1 },
    { kind: "setDirectionFix", enabled: true },
    { kind: "setThrough", enabled: true },
    { kind: "setAnimation", enabled: false },
    { kind: "changeOpacity", delta: -64 },
    { kind: "setSwitch", switchId: "sw_route_seen", value: true },
    { kind: "changeGraphic", spriteId: "tex_easyrpg_charset_people1" },
    { kind: "playSe", resourceId: "se_route_chime" },
    { kind: "moveDiagonal", horizontal: "right", vertical: "up" },
    { kind: "jump", dx: 0, dy: 0 },
  ];
}

function moveRouteProject(): Project {
  return {
    version: 3,
    meta: { title: "Loop17 Move Route", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: { npc_target: sprite("npc_target", "tex_easyrpg_charset_people1"), tex_easyrpg_charset_people1: sprite("tex_easyrpg_charset_people1", "tex_easyrpg_charset_actor1") }, uploaded: {} },
    resourceProfiles: [],
    tilesets: { tiles_default: { id: "tiles_default", name: "Default", image: { type: "bundled", id: "tex_tiles_default" }, tileSize: 16, tilesPerRow: 8, count: 8, passability: Array.from({ length: 8 }, () => PASSABLE), priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"], terrain: Array.from({ length: 8 }, () => 0) } },
    switches: [{ id: "sw_route_seen", name: "Route Seen" }],
    variables: [],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: { map_loop17: { id: "map_loop17", name: "Loop17", width: 7, height: 6, tilesetId: "tiles_default", tileSize: 16, lowerTiles: Array.from({ length: 42 }, () => 0), upperTiles: Array.from({ length: 42 }, () => -1), events: [
      event("ev_route_controller", 2, 4, [eventPage("controller_page", [{ kind: "moveEvent", eventId: "", route: { moves: [{ kind: "move", dir: "left" }], repeat: true } }])]),
      event("ev_route_target", 2, 3, [eventPage("target_page", [], "npc_target")]),
    ] } },
    mapTree: { mapId: "map_loop17", children: [] },
    startMapId: "map_loop17",
    startPos: { x: 3, y: 2 },
    flags: {},
  };
}

function sprite(id: string, textureId: string): Project["assets"]["sprites"][string] {
  return { id, image: { type: "bundled", id: textureId }, frames: 8, frameWidth: 32, frameHeight: 32 };
}

function event(id: string, x: number, y: number, pages: EventPage[]): Project["maps"][string]["events"][number] {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages };
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
