import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createTownArchitectureCityProject, createStarterHouseInteriorMap } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { tapKey, startNewGameFromTitle } from "./runtimeInput";

declare const process: {
  readonly env: {
    readonly RPG_ZZU_EVIDENCE_URL?: string;
  };
};

const EVIDENCE_DIR = "output/evidence/city-start-editor";
const APP_URL = process.env.RPG_ZZU_EVIDENCE_URL ?? "/";
const INTERIOR_MAP_ID = "map_starter_house_interior";
const CITY_DOOR = { x: 33, y: 38 } as const;
const CITY_RETURN = { x: 33, y: 39 } as const;
const INTERIOR_ENTRY = { x: 4, y: 6 } as const;
const INTERIOR_EXIT = { x: 4, y: 7 } as const;

type TilePoint = {
  readonly x: number;
  readonly y: number;
};

type EditorEventSpec = TilePoint & {
  readonly id: string;
  readonly name: string;
  readonly spriteId: string;
  readonly text: string;
};

type RuntimeState = {
  readonly mapId: string;
  readonly player: TilePoint;
};

type ProjectExport = {
  readonly project: Project;
};

const NPCS = [
  {
    id: "city-npc-mina",
    name: "미나",
    spriteId: "tex_easyrpg_charset_people1",
    text: "여기는 새 시작 도시예요. 이벤트는 에디터에서 하나씩 만들었어요.",
    x: 31,
    y: 39,
  },
  {
    id: "city-npc-rowen",
    name: "로웬",
    spriteId: "tex_easyrpg_charset_people2",
    text: "북쪽 문으로 들어가면 집 내부 맵으로 이동합니다.",
    x: 35,
    y: 39,
  },
  {
    id: "city-npc-sera",
    name: "세라",
    spriteId: "tex_easyrpg_charset_actor2",
    text: "돌아오는 문도 따로 만든 이벤트라서 도시와 내부가 서로 이어져요.",
    x: 33,
    y: 41,
  },
] as const satisfies readonly EditorEventSpec[];

test.use({ serviceWorkers: "block" });

test("editor-authored city start map has three NPCs and a linked house interior", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const project = cityAuthoringProject();
  const cityMapId = project.startMapId;

  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, project, APP_URL);
  await page.getByTestId(`map-tree-node-${cityMapId}`).click();
  await page.getByTestId("map-set-start").click();
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await screenshot(page, "01-editor-city-start-map.png");

  const authoredNpcIds: string[] = [];
  for (const npc of NPCS) {
    await openNewEventEditor(page, cityMapId, npc);
    await authorNpc(page, npc);
    await screenshot(page, `02-event-${npc.id}-edited.png`);
    await page.getByTestId("event-editor-ok").click();
    const eventId = await eventIdByName(page, cityMapId, npc.name);
    authoredNpcIds.push(eventId);
    await screenshot(page, `03-event-${npc.id}-on-city-map.png`);
  }

  await openNewEventEditor(page, cityMapId, { ...CITY_DOOR, id: "city-house-door", name: "도시 집 문" });
  await authorTransferEvent(page, {
    direction: "up",
    name: "도시 집 문",
    targetMapId: INTERIOR_MAP_ID,
    targetPoint: INTERIOR_ENTRY,
    trigger: "playerTouch",
  });
  await screenshot(page, "04-event-city-house-door-edited.png");
  await page.getByTestId("event-editor-ok").click();
  await screenshot(page, "05-event-city-house-door-on-map.png");

  await page.getByTestId(`map-tree-node-${INTERIOR_MAP_ID}`).click();
  await screenshot(page, "06-editor-house-interior-map.png");
  await openNewEventEditor(page, INTERIOR_MAP_ID, { ...INTERIOR_EXIT, id: "city-house-exit", name: "집 밖으로" });
  await authorTransferEvent(page, {
    direction: "down",
    name: "집 밖으로",
    targetMapId: cityMapId,
    targetPoint: CITY_RETURN,
    trigger: "playerTouch",
  });
  await screenshot(page, "07-event-house-exit-edited.png");
  await page.getByTestId("event-editor-ok").click();
  await screenshot(page, "08-event-house-exit-on-interior-map.png");

  const exported = await projectExport(page);
  await writeFile(`${EVIDENCE_DIR}/project-export.json`, `${JSON.stringify(exported, null, 2)}\n`, "utf8");
  expect(exported.project.startMapId).toBe(cityMapId);
  expect(exported.project.maps[cityMapId]?.events).toHaveLength(4);
  expect(exported.project.maps[INTERIOR_MAP_ID]?.events).toHaveLength(1);

  await page.getByTestId("mode-play").click();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(cityMapId);
  await screenshot(page, "09-play-city-start.png");

  for (let index = 0; index < NPCS.length; index += 1) {
    const npc = NPCS[index];
    const eventId = authoredNpcIds[index];
    if (!npc || !eventId) throw new Error("missing authored NPC runtime id");
    await page.getByTestId(`event-${eventId}`).click();
    await expect(page.getByTestId("dialogue-box")).toContainText(npc.name);
    await expect(page.getByTestId("dialogue-box")).toContainText(npc.text);
    await screenshot(page, `10-play-dialogue-${npc.id}.png`);
    await page.getByTestId("dialogue-box").click();
  }

  await tapKey(page, "ArrowUp", 80);
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(INTERIOR_MAP_ID);
  await expect.poll(async () => (await runtimeState(page)).player).toEqual(INTERIOR_ENTRY);
  await screenshot(page, "11-play-inside-house.png");

  await tapKey(page, "ArrowDown", 80);
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(cityMapId);
  await expect.poll(async () => (await runtimeState(page)).player).toEqual(CITY_RETURN);
  await screenshot(page, "12-play-returned-to-city.png");
});

function cityAuthoringProject(): Project {
  const project = createTownArchitectureCityProject();
  const cityMap = project.maps[project.startMapId];
  if (!cityMap) throw new Error("missing generated city map");
  cityMap.name = "에디터 시작 도시";
  cityMap.events = [];
  const interior = createStarterHouseInteriorMap(project.startMapId);
  interior.name = "도시 집 내부";
  interior.events = [];
  project.maps[interior.id] = interior;
  project.mapTree.children = [{ mapId: interior.id, children: [] }];
  project.startPos = CITY_RETURN;
  return project;
}

async function openNewEventEditor(
  page: Page,
  mapId: string,
  event: Pick<EditorEventSpec, "id" | "name" | "x" | "y">,
): Promise<void> {
  await page.evaluate(async (placement) => {
    const modulePath = "/src/editor/panels/eventEditor/modal.ts";
    const modal = await import(modulePath);
    const eventId = modal.openNewEventEditorModal(placement.mapId, placement.x, placement.y);
    document.querySelector("[data-testid='event-editor-modal']")?.setAttribute("data-authored-event-id", eventId);
  }, { mapId, x: event.x, y: event.y });
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

async function authorNpc(page: Page, npc: EditorEventSpec): Promise<void> {
  await page.getByTestId("event-page-name-input").fill(npc.name);
  await page.getByTestId("event-page-name-input").blur();
  await page.getByTestId("event-page-sprite-input").fill(npc.spriteId);
  await page.getByTestId("event-page-sprite-input").blur();
  await addTextCommand(page, npc.name, npc.text);
}

async function authorTransferEvent(
  page: Page,
  spec: {
    readonly direction: "down" | "up";
    readonly name: string;
    readonly targetMapId: string;
    readonly targetPoint: TilePoint;
    readonly trigger: "playerTouch";
  },
): Promise<void> {
  await page.getByTestId("event-page-name-input").fill(spec.name);
  await page.getByTestId("event-page-name-input").blur();
  await page.getByTestId("event-page-trigger-select").selectOption(spec.trigger);
  await page.getByTestId("event-page-priority-select").selectOption("below");
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("event-command-picker-tab-1").click();
  await picker.getByTestId("command-picker-add-transfer").click();
  const command = page.getByTestId("event-command-transfer").first();
  await command.locator(".cmd-head").dblclick();
  await command.getByTestId("transfer-player-open").click();
  const dialog = page.getByTestId("event-transfer-player-dialog");
  await dialog.getByTestId(`transfer-player-map-${spec.targetMapId}`).click();
  const transferPreview = dialog.getByTestId("transfer-player-map-preview");
  const transferClick = await transferPreview.evaluate((node, point) => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error("transfer preview is not a canvas");
    const tileSize = 16;
    const rect = node.getBoundingClientRect();
    return {
      x: ((point.x + 0.5) * tileSize / Math.max(1, node.width)) * rect.width,
      y: ((point.y + 0.5) * tileSize / Math.max(1, node.height)) * rect.height,
    };
  }, spec.targetPoint);
  await transferPreview.click({ position: transferClick });
  await dialog.getByTestId(`transfer-player-direction-${spec.direction}`).check();
  await dialog.getByTestId("transfer-player-ok").click();
}

async function addTextCommand(page: Page, speaker: string, body: string): Promise<void> {
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await picker.getByTestId("command-picker-add-text").click();
  const dialog = page.getByTestId("event-command-text-dialog");
  await dialog.getByTestId("event-command-text-speaker").fill(speaker);
  await dialog.getByTestId("event-command-text-body").fill(body);
  await dialog.getByTestId("event-command-text-ok").click();
}

async function projectExport(page: Page): Promise<ProjectExport> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as ProjectExport;
}

async function eventIdByName(page: Page, mapId: string, name: string): Promise<string> {
  const exported = await projectExport(page);
  const event = exported.project.maps[mapId]?.events.find((entry) => entry.pages?.some((eventPage) => eventPage.name === name));
  if (!event) throw new Error(`missing event named ${name}`);
  return event.id;
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}`, fullPage: true });
}
