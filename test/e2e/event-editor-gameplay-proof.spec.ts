import { expect, test, type Page } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import type { Command, EventPage, Project } from "@/project/types";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { openEventEditor, runtimeState, screenshotEvidence, writeEvidenceJson, writeEvidenceText } from "./eventEditorCertEvidence";
import { tapKey, startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "evidence/browser-screenshots/event-editor-gameplay-proof";
const PASSABLE = { up: true, down: true, left: true, right: true };
const SCREENSHOTS = [
  "01-editor-text-create-popup.png",
  "02-editor-text-edit-same-popup.png",
  "03-editor-transfer-direction-popup.png",
  "04-play-text-command-dialogue.png",
  "05-play-transfer-direction-right.png",
  "06-play-custom-route-right.png",
  "07-play-custom-route-down.png",
  "08-play-frequency-sample-start.png",
  "09-play-frequency-sample-end.png",
] as const;

type PlayerSpriteDebug = {
  readonly frame: string | number;
  readonly kind: string;
  readonly moving: boolean;
  readonly resourceId: string;
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
};

type FrequencySample = {
  readonly frames: number;
  readonly slowTransitions: number;
  readonly fastTransitions: number;
  readonly slowUniqueTiles: readonly string[];
  readonly fastUniqueTiles: readonly string[];
};

test.setTimeout(120_000);

test("event editor popups produce real gameplay direction route and frequency proof", async ({ page }) => {
  await resetEvidence();
  await page.setViewportSize({ width: 1478, height: 926 });
  await seedProjectFromSupabaseCanonical(page, gameplayProofProject());

  await openEventEditor(page, "ev_text");
  await authorAndEditTextCommand(page);
  await page.getByTestId("event-editor-modal-close").click();

  await openEventEditor(page, "ev_transfer");
  await authorTransferCommand(page);
  await page.getByTestId("event-editor-modal-close").click();

  const editorExport = await projectExport(page);
  assertEditorCommands(editorExport);
  await writeJson("00-editor-export.json", editorExport);

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await waitReady(page);
  await page.getByTestId("play-canvas").locator("canvas").click({ force: true });

  await tapKey(page, "ArrowRight", 120);
  await tapKey(page, "Space", 90);
  await expect(page.getByTestId("dialogue-box")).toContainText("수정된 팝업 명령이 플레이까지 도착했다");
  await screenshot(page, "04-play-text-command-dialogue.png");
  await page.getByTestId("dialogue-box").click();
  await waitReady(page);

  await tapKey(page, "ArrowDown", 60);
  await expect.poll(async () => (await runtimeState(page)).mapId, { timeout: 8_000 }).toBe("map_route");
  await expect.poll(async () => (await playerDirection(page))).toBe("right");
  await screenshot(page, "05-play-transfer-direction-right.png");

  await expect.poll(async () => (await runtimeState(page)).movers.ev_route?.activeMove?.dir ?? null, { timeout: 8_000 }).toBe("right");
  await screenshot(page, "06-play-custom-route-right.png");
  await expect.poll(async () => (await runtimeState(page)).movers.ev_route?.activeMove?.dir ?? null, { timeout: 8_000 }).toBe("down");
  await screenshot(page, "07-play-custom-route-down.png");

  const beforeFrequency = await runtimeState(page);
  await screenshot(page, "08-play-frequency-sample-start.png");
  const sample = await frequencySample(page, 1_800);
  const afterFrequency = await runtimeState(page);
  await screenshot(page, "09-play-frequency-sample-end.png");

  expect(afterFrequency.events.ev_route).toMatchObject({ x: 4, y: 3 });
  expect(afterFrequency.movers.ev_route).toMatchObject({ frequencyRank: 6, remainingMoveCount: 0, activeMove: null });
  expect(afterFrequency.movers.ev_freq_slow).toMatchObject({ frequencyRank: 1, moveIntervalMs: 880 });
  expect(afterFrequency.movers.ev_freq_fast).toMatchObject({ frequencyRank: 6, moveIntervalMs: 80 });
  expect(sample.fastTransitions).toBeGreaterThan(sample.slowTransitions);

  const report = {
    generatedAt: new Date().toISOString(),
    screenshots: [...SCREENSHOTS],
    assertions: {
      textCommandReachedGameplay: true,
      transferMap: afterFrequency.mapId,
      transferDirection: await playerDirection(page),
      routeFinalTile: afterFrequency.events.ev_route,
      routeMover: afterFrequency.movers.ev_route,
      slowFrequency: afterFrequency.movers.ev_freq_slow,
      fastFrequency: afterFrequency.movers.ev_freq_fast,
      fastMovedMoreOftenThanSlow: sample.fastTransitions > sample.slowTransitions,
    },
    beforeFrequency,
    afterFrequency,
    frequencySample: sample,
  };
  await writeJson("10-gameplay-proof-report.json", report);
  await writeText("manifest.md", [
    "# Event Editor Gameplay Proof",
    "",
    "Nine browser screenshots prove the modern event command popup flow reaches actual gameplay.",
    "",
    ...SCREENSHOTS.map((name) => `- ${name}`),
    "",
    "Checks: edited text command rendered in play mode, transfer command faced the player right, custom autonomous route moved right then down, and frequency 6 produced more movement transitions than frequency 1 in the same sampling window.",
    "",
  ].join("\n"));
});

async function authorAndEditTextCommand(page: Page): Promise<void> {
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("command-picker-add-text").click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("textarea").fill("초안 팝업 명령");
  await screenshot(page, "01-editor-text-create-popup.png");
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect(dialog).toBeHidden();

  const command = page.getByTestId("event-command-text").first();
  await command.locator(".cmd-head").dblclick();
  await expect(dialog).toBeVisible();
  await dialog.locator("textarea").fill("수정된 팝업 명령이 플레이까지 도착했다");
  await screenshot(page, "02-editor-text-edit-same-popup.png");
  await dialog.getByTestId("event-command-edit-ok").click();
  await expect(dialog).toBeHidden();
  await page.getByTestId("event-editor-apply").click();
}

async function authorTransferCommand(page: Page): Promise<void> {
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("event-command-picker-tab-2").click();
  await picker.getByTestId("command-picker-add-transfer").click();
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  await commandDialog.getByTestId("transfer-player-open").click();
  const dialog = page.getByTestId("event-transfer-player-dialog");
  await dialog.getByTestId("transfer-player-map-map_route").click();
  await dialog.getByTestId("transfer-player-map-preview").click({ position: { x: 2 * 16 + 8, y: 2 * 16 + 8 } });
  await dialog.getByTestId("transfer-player-direction-right").check();
  await screenshot(page, "03-editor-transfer-direction-popup.png");
  await dialog.getByTestId("transfer-player-ok").click();
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect(commandDialog).toBeHidden();
  await page.getByTestId("event-editor-apply").click();
}

async function waitReady(page: Page): Promise<void> {
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
}

async function playerSprite(page: Page): Promise<PlayerSpriteDebug> {
  const sprite = await page.evaluate(() => {
    type HookedWindow = Window & { readonly __rpgzzuPlayerSprite?: () => PlayerSpriteDebug | null };
    return (window as HookedWindow).__rpgzzuPlayerSprite?.() ?? null;
  });
  if (!sprite) throw new Error("missing player sprite debug hook");
  return sprite;
}

async function playerDirection(page: Page): Promise<string> {
  const sprite = await playerSprite(page);
  const frame = Number(sprite.frame);
  if (sprite.kind === "charset" && Number.isFinite(frame)) {
    return ["up", "right", "down", "left"][Math.floor(frame / 12) % 4] ?? "unknown";
  }
  if (Number.isFinite(frame)) return ["down", "left", "right", "up"][Math.floor(frame / 3)] ?? "unknown";
  return "unknown";
}

async function frequencySample(page: Page, durationMs: number): Promise<FrequencySample> {
  return page.evaluate(async (sampleDurationMs) => {
    type SpriteState = { readonly events?: Record<string, { readonly x?: number; readonly y?: number }> };
    type HookedWindow = Window & { readonly __rpgzzuCharacterSprites?: () => SpriteState | null };
    const hook = (window as HookedWindow).__rpgzzuCharacterSprites;
    if (typeof hook !== "function") throw new Error("missing character sprite hook");
    const samples: Array<{ slow: string; fast: string }> = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < sampleDurationMs) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const events = hook()?.events ?? {};
      const slow = events.ev_freq_slow;
      const fast = events.ev_freq_fast;
      if (typeof slow?.x === "number" && typeof slow.y === "number" && typeof fast?.x === "number" && typeof fast.y === "number") {
        samples.push({ slow: `${slow.x.toFixed(1)},${slow.y.toFixed(1)}`, fast: `${fast.x.toFixed(1)},${fast.y.toFixed(1)}` });
      }
    }
    const transitions = (values: readonly string[]) => values.slice(1).filter((value, index) => value !== values[index]).length;
    const slowValues = samples.map((sample) => sample.slow);
    const fastValues = samples.map((sample) => sample.fast);
    return {
      frames: samples.length,
      slowTransitions: transitions(slowValues),
      fastTransitions: transitions(fastValues),
      slowUniqueTiles: [...new Set(slowValues)],
      fastUniqueTiles: [...new Set(fastValues)],
    };
  }, durationMs);
}

async function projectExport(page: Page): Promise<{ readonly project: Project }> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as { readonly project: Project };
}

function assertEditorCommands(state: { readonly project: Project }): void {
  const textCommands = state.project.maps.map_start?.events.find((event) => event.id === "ev_text")?.pages?.[0]?.commands;
  expect(textCommands).toMatchObject([{ kind: "text", body: "수정된 팝업 명령이 플레이까지 도착했다" }]);
  const transferCommands = state.project.maps.map_start?.events.find((event) => event.id === "ev_transfer")?.pages?.[0]?.commands;
  expect(transferCommands).toMatchObject([{ kind: "transfer", mapId: "map_route", x: 2, y: 2, direction: "right" }]);
}

async function resetEvidence(): Promise<void> {
  await rm(EVIDENCE_DIR, { recursive: true, force: true });
  await mkdir(EVIDENCE_DIR, { recursive: true });
}

async function screenshot(page: Page, name: typeof SCREENSHOTS[number]): Promise<void> {
  await screenshotEvidence(page, EVIDENCE_DIR, name);
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeEvidenceJson(EVIDENCE_DIR, name, value);
}

async function writeText(name: string, value: string): Promise<void> {
  await writeEvidenceText(EVIDENCE_DIR, name, value);
}

function gameplayProofProject(): Project {
  const database = defaultDatabase();
  return {
    version: 3,
    meta: { title: "Event Editor Gameplay Proof", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "Proof tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: Array.from({ length: 8 }, () => PASSABLE),
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: Array.from({ length: 8 }, () => 0),
      },
    },
    switches: [],
    variables: [],
    commonEvents: [],
    database,
    system: { startActorIds: ["actor_hero"] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: ["actor_hero"] },
    maps: {
      map_start: {
        id: "map_start",
        name: "Popup Start",
        width: 8,
        height: 6,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 48 }, () => 0),
        upperTiles: Array.from({ length: 48 }, () => -1),
        events: [
          event("ev_text", 2, 1, [eventPage("text_page", { trigger: { kind: "action" }, priority: "same", commands: [] })]),
          event("ev_transfer", 1, 2, [eventPage("transfer_page", { trigger: { kind: "playerTouch" }, priority: "below", commands: [] })]),
        ],
      },
      map_route: {
        id: "map_route",
        name: "Route Proof",
        width: 12,
        height: 9,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 108 }, () => 0),
        upperTiles: Array.from({ length: 108 }, () => -1),
        events: [
          event("ev_route", 4, 2, [eventPage("route_page", { movement: { type: "custom", speed: 3, frequency: 6, route: { repeat: false, moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "down" }, { kind: "move", dir: "left" }] } } })]),
          event("ev_freq_slow", 2, 5, [eventPage("slow_page", { movement: { type: "custom", speed: 6, frequency: 1, route: { repeat: true, moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }] } } })]),
          event("ev_freq_fast", 2, 7, [eventPage("fast_page", { movement: { type: "custom", speed: 6, frequency: 6, route: { repeat: true, moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }] } } })]),
        ],
      },
    },
    mapTree: { mapId: "map_start", children: [{ mapId: "map_route", children: [] }] },
    startMapId: "map_start",
    startPos: { x: 1, y: 1 },
    flags: {},
  };
}

function event(id: string, x: number, y: number, pages: EventPage[]): Project["maps"][string]["events"][number] {
  return { id, x, y, trigger: pages[0]?.trigger ?? { kind: "action" }, commands: [], pages };
}

function eventPage(
  id: string,
  config: Partial<Pick<EventPage, "commands" | "movement" | "priority" | "trigger">> = {},
): EventPage {
  return {
    id,
    name: id,
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" } },
    trigger: config.trigger ?? { kind: "action" },
    priority: config.priority ?? "same",
    movement: config.movement ?? { type: "fixed", speed: 3, frequency: 3 },
    commands: [...(config.commands ?? [])] as Command[],
  };
}
