import { expect, test, type Page } from "@playwright/test";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";

test.use({ trace: "on" });

type EventPageExport = {
  id: string;
  name: string;
  conditions: { kind: string; switchId?: string; value?: boolean }[];
  graphic: { sprite?: { id: string } };
  trigger: { kind: string };
  priority: string;
  commands: { kind: string; body?: string }[];
};

type DebugState = {
  project: {
    startMapId: string;
    maps: Record<string, { events: { pages?: EventPageExport[] }[] }>;
  };
};

type RuntimeState = {
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
};

type SeedProject = Project;
type MutableEvent = GameEvent & { pages: EventPage[] };
type MutableEventFixture = Project & {
  readonly maps: Project["maps"] & {
    readonly map_page: GameMap & {
      readonly events: MutableEvent[];
    };
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

// freshProject 사용 시 시작 맵에 사전 정의된 이벤트(starterMapObjects)가 있을 수 있다.
// 클릭으로 새로 만든 이벤트(ev_ 접두사)를 우선 반환한다.
function authoredEvent(state: DebugState): DebugState["project"]["maps"][string]["events"][number] | undefined {
  const events = state.project.maps[state.project.startMapId].events;
  return events.find((event) => "id" in event && typeof event.id === "string" && event.id.startsWith("ev_")) ?? events[0];
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function clickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.click({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

async function tapKey(page: Page, key: string, holdMs = 80): Promise<void> {
  // 공유 헬퍼로 위임 — headless 입력 주입 + 브라우저 폴백.
  const { tapKey: runtimeTapKey } = await import("./runtimeInput");
  await runtimeTapKey(page, key, holdMs);
}

function loadEventFixture(): MutableEventFixture {
  return {
    version: 3,
    meta: { title: "Runtime Event Pages", author: "e2e", terms: { gold: "G" } },
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
    switches: [{ id: "sw_page", name: "Page switch" }],
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
      map_page: {
        id: "map_page",
        name: "Pages",
        width: 2,
        height: 2,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: [0, 0, 1, 0],
        upperTiles: [-1, -1, -1, -1],
        events: [
          {
            id: "ev_page",
            x: 0,
            y: 1,
            trigger: { kind: "action" },
            commands: [{ kind: "text", body: "legacy" }],
            pages: [
              {
                id: "page_1",
                name: "Base page",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [
                  { kind: "setSwitch", switchId: "sw_page", value: true },
                  { kind: "text", body: "page 1" },
                ],
              },
              {
                id: "page_2",
                name: "Switch page",
                conditions: [{ kind: "switch", switchId: "sw_page", value: true }],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [{ kind: "text", body: "page 2" }],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_page", children: [] },
    startMapId: "map_page",
    startPos: { x: 0, y: 0 },
    flags: {},
  } satisfies MutableEventFixture;
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

test("event editor manages RM2K3-style pages with conditions and page-owned text", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapCenter(page);
  await expect(page.getByTestId("event-page-tabs")).toBeVisible();
  await expect(page.getByTestId("event-page-tab-1")).toBeVisible();

  await page.getByTestId("event-page-textarea").fill("Page one");
  await page.getByTestId("event-page-textarea").blur();

  await page.getByTestId("event-page-add").click();
  await expect(page.getByTestId("event-page-tab-2")).toBeVisible();
  await page.getByTestId("event-page-name-input").fill("Switch Page");
  await page.getByTestId("event-page-name-input").blur();
  await page.getByTestId("event-page-trigger-select").selectOption("action");
  await page.getByTestId("event-page-priority-select").selectOption("above");
  await page.getByTestId("event-page-sprite-input").fill("npc_villager");
  await page.getByTestId("event-page-sprite-input").blur();
  await page.getByTestId("event-page-switch-condition-input").fill("sw_page");
  await page.getByTestId("event-page-switch-condition-input").blur();
  await page.getByTestId("event-page-textarea").fill("Page two");
  await page.getByTestId("event-page-textarea").blur();

  await page.getByTestId("event-page-copy").click();
  await expect(page.getByTestId("event-page-tab-3")).toBeVisible();
  await page.getByTestId("event-page-move-up").click();

  await expect.poll(async () => {
    const state = await debugState(page);
    const event = authoredEvent(state);
    return event?.pages?.length ?? 0;
  }).toBe(3);

  const state = await debugState(page);
  const event = authoredEvent(state);
  if (!event) throw new Error("authored event not found");
  const pages = event.pages ?? [];
  expect(pages.some((item) => item.commands.some((command) => command.body === "Page one"))).toBe(true);
  expect(pages.some((item) =>
    item.name.includes("Switch Page") &&
    item.conditions.some((condition) => condition.kind === "switch" && condition.switchId === "sw_page") &&
    item.graphic.sprite?.id === "npc_villager" &&
    item.priority === "above" &&
    item.commands.some((command) => command.body === "Page two")
  )).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("event-pages.png"), fullPage: true });
});

test("play mode resolves the highest matching event page", async ({ page }, testInfo) => {
  const seeded = loadEventFixture();
  const event = seeded.maps.map_page.events[0];
  event.x = 0;
  event.y = 1;
  seeded.maps.map_page.lowerTiles[2] = 1;
  event.pages[0].commands = [
    { kind: "setSwitch", switchId: "sw_page", value: true },
    { kind: "text", body: "page 1" },
  ];
  event.pages[1].commands = [{ kind: "text", body: "page 2" }];

  await seedProject(page, seeded);
  const seededState = await debugState(page);
  expect(seededState.project.startMapId).toBe("map_page");
  expect(seededState.project.maps.map_page.events[0].pages?.length).toBe(2);
  await page.click('[data-testid="mode-play"]');
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  await page.getByTestId("play-canvas").locator("canvas").click();

  await tapKey(page, "Space");
  await expect(page.getByTestId("dialogue-box")).toContainText("page 1");
  await page.getByTestId("dialogue-box").click();
  await expect(page.getByTestId("dialogue-box")).toHaveCount(0);

  await tapKey(page, "ArrowRight");
  await expect.poll(async () => (await runtimeState(page)).player.x).toBe(1);
  await tapKey(page, "ArrowLeft");
  await expect.poll(async () => (await runtimeState(page)).player.x).toBe(0);
  await tapKey(page, "ArrowDown");
  await expect.poll(async () => (await runtimeState(page)).inputEnabled).toBe(true);
  await tapKey(page, "Space");
  await expect(page.getByTestId("dialogue-box")).toContainText("page 2");
  await page.screenshot({ path: testInfo.outputPath("event-pages-play.png"), fullPage: true });
  await page.click('[data-testid="mode-edit"]');
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
});
