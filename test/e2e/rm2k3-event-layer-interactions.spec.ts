import { expect, test, type Page } from "@playwright/test";
import type { EventPageGraphic, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const PASSABLE = { up: true, down: true, left: true, right: true };

type ExportedGraphic = {
  readonly direction?: string;
  readonly pattern?: number;
  readonly sprite?: { readonly id: string };
};

type ExportedPage = {
  readonly graphic: ExportedGraphic;
};

type ExportedEvent = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly pages?: readonly ExportedPage[];
};

type ExportedMap = {
  readonly width: number;
  readonly height: number;
  readonly events: readonly ExportedEvent[];
};

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, ExportedMap>;
  };
};

type MapTileInteraction = {
  readonly clickCount?: 1 | 2;
  readonly page: Page;
  readonly x: number;
  readonly y: number;
};

async function seedProject(page: Page, project: Project): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, project);
}

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  const parsed: unknown = JSON.parse(text);
  if (!isDebugState(parsed)) throw new Error("project export has unexpected shape");
  return parsed;
}

async function clickMapTile(page: Page, x: number, y: number): Promise<void> {
  await interactWithMapTile({ page, x, y });
}

async function doubleClickMapTile(page: Page, x: number, y: number): Promise<void> {
  await interactWithMapTile({ page, x, y, clickCount: 2 });
}

async function interactWithMapTile(interaction: MapTileInteraction): Promise<void> {
  const { page, x, y } = interaction;
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 16 * 2;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  const position = {
    x: mapLeft + x * tileSize + tileSize / 2,
    y: mapTop + y * tileSize + tileSize / 2,
  };
  if (interaction.clickCount === 2) {
    await canvas.dblclick({ position });
    return;
  }
  await canvas.click({ position });
}

function eventGraphic(state: DebugState, eventId: string): ExportedGraphic {
  const map = state.project.maps[state.project.startMapId];
  const event = map?.events.find((item) => item.id === eventId);
  const page = event?.pages?.[0];
  if (!page) throw new Error(`missing event page for ${eventId}`);
  return page.graphic;
}

function projectWithPlacedEvent(graphic: EventPageGraphic = {}): Project {
  return {
    version: 3,
    meta: { title: "Event Layer Interactions", author: "e2e", terms: { gold: "G" } },
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
      map_layer: {
        id: "map_layer",
        name: "Layer",
        width: 5,
        height: 4,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: new Array<number>(20).fill(0),
        upperTiles: new Array<number>(20).fill(-1),
        events: [
          {
            id: "ev_layer",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "page_layer",
                name: "Page 1",
                conditions: [],
                graphic,
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "map_layer", children: [] },
    startMapId: "map_layer",
    startPos: { x: 1, y: 1 },
    flags: {},
  } satisfies Project;
}

function isDebugState(value: unknown): value is DebugState {
  if (!isRecord(value)) return false;
  const project = value.project;
  if (!isRecord(project)) return false;
  return typeof project.startMapId === "string" && isRecord(project.maps);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

test("event layer canvas selects on first click and opens the editor on double click", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, projectWithPlacedEvent());

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await clickMapTile(page, 2, 2);

  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("event-first-click-selected.png"), fullPage: true });

  await doubleClickMapTile(page, 2, 2);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-editor-diff")).toBeVisible();
  await expect(page.getByTestId("event-editor-diff")).toContainText("변경 없음");
  await expect(page.getByTestId("event-page-bottom-left")).toBeVisible();
  await expect(page.getByTestId("event-page-bottom-right")).toBeVisible();
  await expect(page.getByTestId("event-page-bottom-left").getByText("그래픽")).toBeVisible();
  await expect(page.getByTestId("event-page-bottom-left").getByText("이동 유형")).toBeVisible();
  await expect(page.getByTestId("event-page-bottom-right").getByText("트리거")).toBeVisible();
  await expect(page.getByTestId("event-page-bottom-right").getByText("우선순위")).toBeVisible();
  await expect(page.getByTestId("event-page-bottom-right").getByText("애니메이션 유형")).toBeVisible();
  await expect(page.getByTestId("event-page-bottom-right").getByText("이동 속도")).toBeVisible();
  await expect(page.getByTestId("event-page-movement-type")).toHaveValue("fixed");
  await expect(page.getByTestId("event-page-movement-type").locator("option:checked")).toHaveText("정지");
  await expect(page.getByTestId("event-page-movement-frequency")).toBeDisabled();
  await expect(page.getByTestId("event-page-custom-route")).toBeDisabled();
  await expect(page.getByTestId("event-page-trigger-select")).toHaveValue("action");
  await expect(page.getByTestId("event-page-priority-select")).toHaveValue("same");
  await expect(page.getByTestId("event-page-animation-type")).toBeVisible();
  await expect(page.getByTestId("event-page-movement-speed-select")).toHaveValue("3");
  await expect(page.getByTestId("event-page-movement-speed-select").locator("option:checked")).toHaveText("3: x2 느림");
  await page.screenshot({ path: "test-results/event-bottom-panel-korean.png", fullPage: true });
  await page.screenshot({ path: testInfo.outputPath("event-double-click-modal.png"), fullPage: true });
});

test("NPC graphic slot selection stays staged until the event editor is applied", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, projectWithPlacedEvent());

  await page.getByTestId("layer-event").click();
  await doubleClickMapTile(page, 2, 2);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await page.getByTestId("event-page-graphic-set").click();

  await expect(page.getByTestId("event-graphic-resource-list")).toBeVisible();
  await expect(page.getByTestId("event-graphic-resource-list")).not.toContainText("<RTP>");
  await expect(page.getByTestId("event-graphic-resource-tex_easyrpg_charset_actor1")).toHaveText("Actor1");
  await expect(page.getByTestId("event-graphic-resource-tex_easyrpg_charset_actor1")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("event-graphic-preview-panel")).toHaveCSS("background-color", "rgb(0, 128, 0)");
  await expect(page.getByTestId("npc-character-slot-0")).toHaveCSS("background-image", /data:image\/png/);
  await expect(page.getByRole("radio", { name: "Down" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "MIDDLE" })).toBeChecked();
  await expect(page.getByTestId("event-graphic-dialog-footer")).toBeVisible();
  const previewBox = await page.getByTestId("event-graphic-preview-panel").boundingBox();
  const directionBox = await page.locator(".event-graphic-direction-group").boundingBox();
  const patternBox = await page.locator(".event-graphic-pattern-group").boundingBox();
  if (!previewBox || !directionBox || !patternBox) {
    throw new Error("Graphic dialog option layout was not measurable");
  }
  expect(directionBox.y).toBeGreaterThan(previewBox.y + previewBox.height);
  expect(Math.abs(directionBox.y - patternBox.y)).toBeLessThanOrEqual(2);
  expect(directionBox.x).toBeLessThan(patternBox.x);
  const graphicDialog = page.getByTestId("event-graphic-dialog").locator(".event-subdialog-window");
  await graphicDialog.screenshot({ path: testInfo.outputPath("graphic-dialog-rm2k-style.png") });

  await page.getByTestId("npc-direction-up").click();
  await expect(page.getByTestId("npc-frame-preview")).toHaveAttribute("data-direction", "up");

  await page.getByTestId("npc-character-slot-0").click();

  await expect(page.getByTestId("npc-frame-preview")).toHaveAttribute("data-direction", "down");
  await expect(page.getByTestId("npc-frame-preview")).toHaveAttribute("data-pattern", "1");
  await expect(page.getByTestId("event-graphic-confirm")).toBeVisible();
  expect(eventGraphic(await debugState(page), "ev_layer")).toEqual({});

  await page.screenshot({ path: testInfo.outputPath("npc-slot-down-before-confirm.png"), fullPage: true });
  await page.getByTestId("event-graphic-confirm").click();

  expect(eventGraphic(await debugState(page), "ev_layer")).toEqual({});
  await expect(page.getByTestId("event-editor-diff")).toContainText("변경 예정");
  await expect(page.getByTestId("event-page-sprite-input")).toHaveValue("tex_easyrpg_charset_actor1");
  await expect(page.getByTestId("event-page-graphic-preview")).toHaveAttribute("data-direction", "down");
  await expect(page.getByTestId("event-page-graphic-preview")).toHaveAttribute("data-pattern", "25");
  await expect(page.getByTestId("event-page-graphic-preview")).toHaveCSS("background-image", /data:image\/png/);
  await page.getByTestId("event-editor-apply").click();
  const savedGraphic = eventGraphic(await debugState(page), "ev_layer");
  expect(savedGraphic.direction).toBe("down");
  expect(savedGraphic.sprite?.id).toBe("tex_easyrpg_charset_actor1");
  expect(savedGraphic.pattern).toBe(25);
  expect(eventGraphic(await debugState(page), "ev_layer").direction).toBe("down");
  await page.screenshot({ path: testInfo.outputPath("npc-slot-saved-after-confirm.png"), fullPage: true });
});
