import { expect, test, type Page } from "@playwright/test";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const PASSABLE = { up: true, down: true, left: true, right: true };
const NPC_NAME = "Guide";
const NPC_BODY = "Welcome. The north forest is still dangerous.";

type RuntimeState = {
  readonly player: { readonly x: number; readonly y: number };
};

type AuthoredCommand = {
  readonly kind: string;
  readonly speaker?: string;
  readonly body?: string;
};

type AuthoredPage = {
  readonly name: string;
  readonly graphic: { readonly sprite?: { readonly id: string } };
  readonly trigger: { readonly kind: string };
  readonly priority: string;
  readonly commands: readonly AuthoredCommand[];
};

type AuthoredEvent = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly pages?: readonly AuthoredPage[];
};

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly width: number; readonly height: number; readonly events: readonly AuthoredEvent[] }>;
  };
};

async function seedProject(page: Page, project: Project): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project);
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function tapKey(page: Page, key: string, holdMs = 40): Promise<void> {
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await runtimeTapKey(page, key, holdMs);
}

async function clickMapTile(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const zoom = 2;
  const tileSize = 16 * zoom;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  await canvas.dblclick({ position: { x: mapLeft + x * tileSize + tileSize / 2, y: mapTop + y * tileSize + tileSize / 2 } });
}

async function createEventAtMapCenter(page: Page): Promise<void> {
  await clickMapTile(page, 2, 2);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-editor-diff")).toBeVisible();
  await expect(page.getByTestId("event-editor-diff")).toContainText("생성 예정");
  await expect.poll(async () => {
    const state = await debugState(page);
    const map = state.project.maps[state.project.startMapId];
    return map.events.length;
  }).toBe(0);
}

async function openSelectedEventEditor(page: Page): Promise<void> {
  const modal = page.getByTestId("event-editor-modal");
  try {
    await expect(modal).toBeVisible({ timeout: 1000 });
  } catch {
    await expect(page.getByTestId("event-editor-open")).toBeVisible();
    await page.getByTestId("event-editor-open").click();
    await expect(modal).toBeVisible();
  }
}

async function addTextCommand(page: Page, speaker: string, body: string): Promise<void> {
  const emptyLine = page.getByTestId("event-command-empty-line");
  await expect(emptyLine).toBeVisible();
  await emptyLine.dblclick();

  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("command-picker-add-text").click();

  const dialog = page.getByTestId("event-command-text-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("event-command-text-speaker").fill(speaker);
  await dialog.getByTestId("event-command-text-body").fill(body);
  await dialog.getByTestId("event-command-text-ok").click();
  await expect(dialog).toBeHidden();
  await expect(picker).toBeHidden();
}

function baseProject(): Project {
  return {
    version: 3,
    meta: { title: "Playable NPC Authoring", author: "e2e", terms: { gold: "G" } },
    assets: {
      sprites: {
        tex_easyrpg_charset_people1: {
          id: "tex_easyrpg_charset_people1",
          image: { type: "bundled", id: "tex_easyrpg_charset_people1" },
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
    switches: [],
    variables: [],
    commonEvents: [],
    database: {
      actors: [],
      classes: [],
      skills: [],
      items: [],
      equipment: [],
      enemies: [],
      troops: [],
      states: [],
      battleAnimations: [],
    },
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_play: {
        id: "map_play",
        name: "Playable",
        width: 5,
        height: 4,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(20).fill(0),
        upperTiles: new Array<number>(20).fill(-1),
        events: [],
      },
    },
    mapTree: { mapId: "map_play", children: [] },
    startMapId: "map_play",
    startPos: { x: 1, y: 1 },
    flags: {},
  };
}

function npcPage(page: AuthoredPage): boolean {
  return page.name === NPC_NAME &&
    page.graphic.sprite?.id === "tex_easyrpg_charset_people1" &&
    page.trigger.kind === "action" &&
    page.priority === "same" &&
    page.commands.some((command) => command.kind === "text" && command.speaker === NPC_NAME && command.body === NPC_BODY);
}

test("play mode lets the user control the protagonist", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, baseProject());

  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).player).toEqual({ x: 1, y: 1 });

  await tapKey(page, "ArrowRight");
  await expect.poll(async () => (await runtimeState(page)).player).toEqual({ x: 2, y: 1 });

  await page.screenshot({ path: testInfo.outputPath("playable-protagonist.png"), fullPage: true });
});

test("event tool creates an RM2003-style NPC event that persists and plays", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await seedProject(page, baseProject());

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await createEventAtMapCenter(page);
  await openSelectedEventEditor(page);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-npc-quick-author")).toHaveCount(0);
  await expect(page.getByTestId("event-npc-name-input")).toHaveCount(0);
  await expect(page.getByTestId("event-npc-dialogue-input")).toHaveCount(0);

  await page.getByTestId("event-page-name-input").fill(NPC_NAME);
  await page.getByTestId("event-page-name-input").blur();
  await page.getByTestId("event-page-sprite-input").fill("tex_easyrpg_charset_people1");
  await page.getByTestId("event-page-sprite-input").blur();
  await addTextCommand(page, NPC_NAME, NPC_BODY);

  await expect.poll(async () => {
    const state = await debugState(page);
    const map = state.project.maps[state.project.startMapId];
    return map.events.length;
  }).toBe(0);
  await page.getByTestId("event-editor-ok").click();

  await expect.poll(async () => {
    const state = await debugState(page);
    const map = state.project.maps[state.project.startMapId];
    return map.events.find((event) => event.pages?.some(npcPage));
  }).not.toBeUndefined();

  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  const event = map.events.find((entry) => entry.pages?.some(npcPage));
  if (!event) throw new Error("missing authored NPC event");
  await page.screenshot({ path: testInfo.outputPath("npc-authoring-editor.png"), fullPage: true });

  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-page-name-input")).toHaveValue(NPC_NAME);
  await expect(page.getByTestId("event-page-sprite-input")).toHaveValue("tex_easyrpg_charset_people1");
  await expect(page.getByTestId("event-command-text")).toContainText(NPC_BODY);
  await page.getByTestId("event-editor-modal-close").click();
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId(`event-${event.id}`)).toBeVisible();
  await page.getByTestId(`event-${event.id}`).click();
  await expect(page.getByTestId("dialogue-box")).toContainText(NPC_NAME);
  await expect(page.getByTestId("dialogue-box")).toContainText("north forest");
  await page.screenshot({ path: testInfo.outputPath("npc-authoring-play.png"), fullPage: true });
});
