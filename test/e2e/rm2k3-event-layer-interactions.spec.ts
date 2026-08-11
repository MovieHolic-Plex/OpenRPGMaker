import { expect, test, type Page } from "@playwright/test";
import type { EventPageGraphic, Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { expandEventMovementSection } from "./eventEditorExpandHelpers";

const PASSABLE = { up: true, down: true, left: true, right: true };

type ExportedGraphic = {
  readonly direction?: string;
  readonly pattern?: number;
  readonly sprite?: { readonly id: string };
};

type ExportedPage = {
  readonly commands: readonly ExportedCommand[];
  readonly graphic: ExportedGraphic;
};

type ExportedCommand = {
  readonly commandId?: string;
  readonly fields?: Record<string, string | number | boolean>;
  readonly kind: string;
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
};

type ExportedEvent = {
  readonly id: string;
  readonly commands: readonly ExportedCommand[];
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
    readonly startPos: { readonly x: number; readonly y: number };
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

async function rightClickMapTile(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 16 * 2;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  await canvas.click({
    button: "right",
    position: {
      x: mapLeft + x * tileSize + tileSize / 2,
      y: mapTop + y * tileSize + tileSize / 2,
    },
  });
}

async function eventAt(page: Page, x: number, y: number): Promise<ExportedEvent | undefined> {
  const state = await debugState(page);
  return state.project.maps[state.project.startMapId]?.events.find((event) => event.x === x && event.y === y);
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

async function nativeDoubleClickMapTile(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 16 * 2;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  await page.mouse.move(
    box.x + mapLeft + x * tileSize + tileSize / 2,
    box.y + mapTop + y * tileSize + tileSize / 2
  );
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.down();
  await page.mouse.up();
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

  await nativeDoubleClickMapTile(page, 2, 2);
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-editor-diff")).toHaveCount(1);
  await expect(page.getByTestId("event-editor-diff")).toContainText("변경 없음");
  await expect(page.getByTestId("event-classic-graphic")).toBeVisible();
  await expect(page.getByTestId("event-classic-graphic")).toContainText("그래픽");
  await expect(page.getByTestId("event-page-bottom-left")).toHaveCount(0);
  await expect(page.getByTestId("event-page-bottom-right")).toHaveCount(0);
  // Movement/trigger/priority/animation/speed live under folded section (Disposition B).
  await expandEventMovementSection(page);
  await expect(page.getByTestId("event-classic-movement-type")).toBeVisible();
  await expect(page.getByTestId("event-classic-movement-type")).toContainText("이동 유형");
  await expect(page.getByTestId("event-classic-trigger")).toContainText("트리거");
  await expect(page.getByTestId("event-page-priority-select")).toBeVisible();
  await expect(page.getByTestId("event-classic-animation-type")).toContainText("애니메이션 유형");
  await expect(page.getByTestId("event-classic-movement-speed")).toContainText("이동 속도");
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

test("event editor owns double-click and picker cancellation one layer at a time", async ({ page }, testInfo) => {
  const browserIssues: string[] = [];
  page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserIssues.push(`console: ${message.text()}`);
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, projectWithPlacedEvent());

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await nativeDoubleClickMapTile(page, 2, 2);

  const editor = page.getByTestId("event-editor-modal");
  const picker = page.getByTestId("event-command-picker");
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(editor).toHaveCount(1);
  await expect(editor).toBeVisible();
  await expect(picker).toHaveCount(0);
  await expect(commandDialog).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("event-marker-double-click-editor-only.png"), fullPage: true });

  await page.getByTestId("event-editor-cancel").click();
  await expect(editor).toHaveCount(0);
  await expect(picker).toHaveCount(0);
  await expect(commandDialog).toHaveCount(0);

  await nativeDoubleClickMapTile(page, 2, 2);
  await expect(editor).toHaveCount(1);
  await editor.getByRole("button", { name: "List", exact: true }).click();
  const emptyLine = editor.getByTestId("event-command-empty-line");

  await page.evaluate(() => {
    document.body.dataset.commandPickerDoubleClickLeak = "0";
    document.body.addEventListener("dblclick", (event) => {
      if (event.target instanceof Element && event.target.closest('[data-testid="event-command-empty-line"]')) {
        document.body.dataset.commandPickerDoubleClickLeak = "1";
      }
    }, { once: true });
  });
  await emptyLine.dblclick();
  await expect(picker).toHaveCount(1);
  await expect(picker).toBeVisible();
  await expect(commandDialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.dataset.commandPickerDoubleClickLeak)).toBe("0");

  await page.evaluate(() => {
    document.body.dataset.commandPickerCancelLeak = "0";
    document.body.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest('[data-testid="event-command-picker-cancel"]')) {
        document.body.dataset.commandPickerCancelLeak = "1";
      }
    }, { once: true });
  });
  const cancel = picker.getByTestId("event-command-picker-cancel");
  const cancelBox = await cancel.boundingBox();
  if (!cancelBox) throw new Error("missing command picker Cancel box");
  await cancel.click({ position: { x: Math.max(1, cancelBox.width - 2), y: Math.floor(cancelBox.height / 2) } });
  await expect(picker).toHaveCount(0);
  await expect(editor).toHaveCount(1);
  await expect(commandDialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.dataset.commandPickerCancelLeak)).toBe("0");
  await page.screenshot({ path: testInfo.outputPath("picker-pointer-edge-cancel-editor-remains.png"), fullPage: true });

  await emptyLine.dblclick();
  await expect(picker).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(editor).toHaveCount(1);
  await expect(commandDialog).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(commandDialog).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("picker-escape-then-editor-escape.png"), fullPage: true });
  await testInfo.attach("browser-issues.json", {
    body: JSON.stringify(browserIssues, null, 2),
    contentType: "application/json",
  });
});

test("event layer canvas opens the RPG Maker context menu on right click", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, projectWithPlacedEvent());

  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await rightClickMapTile(page, 3, 1);

  await expect(page.getByTestId("map-context-menu-map_layer")).toBeVisible();
  await expect(page.getByTestId("event-layer-create-event")).toContainText("이벤트 생성...");
  await expect(page.getByTestId("event-layer-cut")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("event-layer-cut")).toContainText("잘라내기");
  await expect(page.getByTestId("event-layer-copy")).toContainText("복사");
  await expect(page.getByTestId("event-layer-paste")).toContainText("붙여넣기");
  await expect(page.getByTestId("event-layer-delete")).toContainText("삭제");
  await expect(page.getByTestId("event-layer-create-transfer-event")).toContainText("장소 이동 이벤트 생성...");
  await expect(page.getByTestId("event-layer-set-player-start")).toContainText("주인공 시작 위치 설정");
  await expect(page.getByTestId("event-layer-set-vehicle-start")).toContainText("탈것 시작 위치 설정...");
  await page.screenshot({ path: testInfo.outputPath("event-layer-context-menu.png"), fullPage: true });
  await page.screenshot({ path: "evidence/browser-screenshots/event-layer-context-menu.png", fullPage: true });

  await page.getByTestId("event-layer-set-player-start").click();
  await expect.poll(async () => (await debugState(page)).project.startPos).toEqual({ x: 3, y: 1 });

  await rightClickMapTile(page, 2, 2);
  await expect(page.getByTestId("event-layer-copy")).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByTestId("event-layer-cut")).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByTestId("event-layer-delete")).toHaveAttribute("aria-disabled", "false");
  await page.getByTestId("event-layer-copy").click();

  await rightClickMapTile(page, 3, 1);
  await expect(page.getByTestId("event-layer-paste")).toHaveAttribute("aria-disabled", "false");
  await page.screenshot({ path: "evidence/browser-screenshots/event-layer-context-menu-paste-enabled.png", fullPage: true });
  await page.getByTestId("event-layer-paste").click();
  await expect.poll(async () => eventAt(page, 3, 1)).not.toBeUndefined();

  await rightClickMapTile(page, 3, 1);
  await page.getByTestId("event-layer-cut").click();
  await expect.poll(async () => eventAt(page, 3, 1)).toBeUndefined();

  await rightClickMapTile(page, 4, 1);
  await page.getByTestId("event-layer-paste").click();
  await expect.poll(async () => eventAt(page, 4, 1)).not.toBeUndefined();
  await rightClickMapTile(page, 4, 1);
  await page.getByTestId("event-layer-delete").click();
  await expect.poll(async () => eventAt(page, 4, 1)).toBeUndefined();

  await rightClickMapTile(page, 0, 0);
  await page.getByTestId("event-layer-create-event").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await page.screenshot({ path: "evidence/browser-screenshots/event-layer-create-event-modal.png", fullPage: true });
  await page.getByTestId("event-editor-cancel").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);

  await rightClickMapTile(page, 0, 1);
  await page.getByTestId("event-layer-create-transfer-event").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-editor-modal")).toContainText("장소 이동");
  await page.screenshot({ path: "evidence/browser-screenshots/event-layer-transfer-event-modal.png", fullPage: true });
  await page.getByTestId("event-editor-ok").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  const transferEvent = await eventAt(page, 0, 1);
  expect(transferEvent?.pages?.[0]?.commands[0]).toMatchObject({ kind: "transfer", mapId: "map_layer", x: 0, y: 1 });

  await rightClickMapTile(page, 0, 2);
  await page.getByTestId("event-layer-set-vehicle-start").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
  await expect(page.getByTestId("event-editor-modal")).toContainText("탈것 위치 설정");
  await page.screenshot({ path: "evidence/browser-screenshots/event-layer-vehicle-start-modal.png", fullPage: true });
  await page.getByTestId("event-editor-ok").click();
  await expect(page.getByTestId("event-editor-modal")).toHaveCount(0);
  const vehicleEvent = await eventAt(page, 0, 2);
  expect(vehicleEvent?.pages?.[0]?.commands[0]).toMatchObject({
    commandId: "m2-039-set-vehicle-location",
    fields: { target: "boat", mapId: "map_layer", x: 0, y: 2 },
    kind: "m2Command",
  });
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
  await expect(page.getByTestId("npc-character-slot-0")).toHaveAttribute("data-direction", "up");

  await page.getByTestId("npc-pattern-0").click();
  await expect(page.getByTestId("npc-frame-preview")).toHaveAttribute("data-pattern", "0");
  await expect(page.getByTestId("npc-character-slot-0")).toHaveAttribute("data-pattern", "0");

  await page.getByTestId("npc-character-slot-0").click();

  await expect(page.getByTestId("npc-frame-preview")).toHaveAttribute("data-direction", "up");
  await expect(page.getByTestId("npc-frame-preview")).toHaveAttribute("data-pattern", "0");
  await expect(page.getByTestId("event-graphic-confirm")).toBeVisible();
  expect(eventGraphic(await debugState(page), "ev_layer")).toEqual({});

  await page.screenshot({ path: testInfo.outputPath("npc-slot-down-before-confirm.png"), fullPage: true });
  await page.getByTestId("event-graphic-confirm").click();

  expect(eventGraphic(await debugState(page), "ev_layer")).toEqual({});
  await expect(page.getByTestId("event-editor-diff")).toContainText("변경 예정");
  await expect(page.getByTestId("event-page-sprite-input")).toHaveValue("tex_easyrpg_charset_actor1");
  await expect(page.getByTestId("event-page-graphic-preview")).toHaveAttribute("data-direction", "up");
  await expect(page.getByTestId("event-page-graphic-preview")).toHaveAttribute("data-pattern", "0");
  await expect(page.getByTestId("event-page-graphic-preview")).toHaveCSS("background-image", /data:image\/png/);
  await page.getByTestId("event-editor-apply").click();
  const savedGraphic = eventGraphic(await debugState(page), "ev_layer");
  expect(savedGraphic.direction).toBe("up");
  expect(savedGraphic.sprite?.id).toBe("tex_easyrpg_charset_actor1");
  expect(savedGraphic.pattern).toBe(0);
  expect(eventGraphic(await debugState(page), "ev_layer").direction).toBe("up");
  await page.screenshot({ path: testInfo.outputPath("npc-slot-saved-after-confirm.png"), fullPage: true });
});
