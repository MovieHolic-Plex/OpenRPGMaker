import { expect, test, type Page } from "@playwright/test";
import type { Project } from "@/project/types";

type CommandExport = { kind: string; troopId?: string };
type SeedProject = Project;

type DebugState = {
  project: {
    startMapId: string;
    maps: Record<string, { events: { pages?: { commands: CommandExport[] }[] }[] }>;
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.click({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  await page.keyboard.press(key, { delay: holdMs });
}

async function seedProject(page: Page, project: SeedProject): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (seed) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rpg-zzu", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").put(seed, "current");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
}

function makeBattleProject(): SeedProject {
  return {
    version: 3,
    meta: { title: "Battle Command", author: "e2e", terms: { gold: "G" } },
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
        passability: [
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: true, down: true, left: true, right: true },
          { up: false, down: false, left: false, right: false },
          { up: true, down: true, left: true, right: true },
        ],
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
      troops: [{ id: "troop_slime", name: "Slime", enemyIds: [], members: [], autoAlign: true, battleEventPages: [] }],
      states: [],
      battleAnimations: [],
    },
    system: { startActorIds: [], initialTroopId: "troop_slime" },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_cmd: {
        id: "map_cmd",
        name: "Commands",
        width: 2,
        height: 2,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: [0, 0, 1, 0],
        upperTiles: [-1, -1, -1, -1],
        events: [
          {
            id: "ev_battle",
            x: 0,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page_battle",
                name: "Battle",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: false }],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_cmd", children: [] },
    startMapId: "map_cmd",
    startPos: { x: 0, y: 0 },
    flags: {},
  };
}

test("event command catalog adds typed commands to the active page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);
  await expect(page.getByTestId("page-command-catalog")).toBeVisible();

  const buttons = [
    "command-add-text",
    "command-add-choice",
    "command-add-switch",
    "command-add-variable",
    "command-add-branch",
    "command-add-timer",
    "command-add-move-route",
    "command-add-picture",
    "command-add-audio",
    "command-add-battle",
    "command-add-game-over",
  ];
  for (const id of buttons) await page.getByTestId(id).click();

  await expect(page.getByTestId("page-command-summary")).toContainText("battleProcessing");
  const state = await debugState(page);
  const commands = state.project.maps[state.project.startMapId].events[0].pages?.[0].commands ?? [];
  for (const kind of [
    "text",
    "choices",
    "setSwitch",
    "setVariable",
    "fork",
    "timer",
    "moveEvent",
    "showPicture",
    "playAudio",
    "battleProcessing",
    "gameOver",
  ]) {
    expect(commands.some((command) => command.kind === kind)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("event-command-catalog.png"), fullPage: true });
});

test("battleProcessing command hands off to a battle scene marker in play mode", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, makeBattleProject());
  await page.getByTestId("mode-play").click();
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await page.getByTestId("play-canvas").locator("canvas").click();
  await tapKey(page, "Space");
  await expect(page.getByTestId("battle-scene")).toContainText("troop_slime");
  await page.screenshot({ path: testInfo.outputPath("battle-command.png"), fullPage: true });
});
