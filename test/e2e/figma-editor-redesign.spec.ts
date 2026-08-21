import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = "evidence/browser-screenshots";
const PASSABLE = { up: true, down: true, left: true, right: true };

type DebugState = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly width: number; readonly height: number }>;
  };
};

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

async function openEventLayerContextMenu(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  // Dark figma shell + classic toolbar + dense zoom controls are expert-only.
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.route("**/rest/v1/map_edit_locks**", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "PGRST205" });
  });
  await seedProjectFromSupabaseCanonical(page, projectWithPlacedEvent(`map_figma_${width}_${height}`));
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  // Dense zoom buttons sit behind the ⋯ expand gate in expert mode.
  await page.getByTestId("editor-canvas-toolbar-expand").click();
  await page.getByTestId("editor-zoom-2").click();

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const map = state.project.maps[state.project.startMapId];
  if (!map) throw new Error("missing current map");
  const tileSize = 16 * 2;
  const mapLeft = Math.floor((box.width - map.width * tileSize) / 2);
  const mapTop = Math.floor((box.height - map.height * tileSize) / 2);
  const target = {
    x: box.x + mapLeft + 3 * tileSize + tileSize / 2,
    y: box.y + mapTop + tileSize + tileSize / 2,
  };
  await page.mouse.click(target.x, target.y, { button: "right" });
  await expect(page.getByTestId(`map-context-menu-${state.project.startMapId}`)).toBeVisible();
}

function projectWithPlacedEvent(mapId: string): Project {
  return {
    version: 3,
    meta: { title: "Figma Editor Redesign", author: "e2e", terms: { gold: "G" } },
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
      [mapId]: {
        id: mapId,
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
                graphic: {},
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
    mapTree: { mapId, children: [] },
    startMapId: mapId,
    startPos: { x: 1, y: 1 },
    flags: {},
  };
}

async function expectModernEditorShell(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const styleOf = (selector: string): CSSStyleDeclaration => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
      return getComputedStyle(node);
    };
    const rectOf = (selector: string): DOMRect => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
      return node.getBoundingClientRect();
    };
    const labelOf = (selector: string): string => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
      return node.textContent?.trim() ?? "";
    };
    const menuLabelWidths = Array.from(document.querySelectorAll<HTMLElement>(".map-context-menu-label")).map((node) => ({
      client: node.clientWidth,
      scroll: node.scrollWidth,
      text: node.textContent ?? "",
    }));
    const visibleStatusCells = Array.from(document.querySelectorAll<HTMLElement>(".editor-statusbar-cell"))
      .filter((node) => getComputedStyle(node).display !== "none")
      .map((node) => ({
        client: node.clientWidth,
        scroll: node.scrollWidth,
        text: node.textContent ?? "",
      }));
    const toolbarItems = Array.from(document.querySelectorAll<HTMLElement>(".canvas-toolbar > *")).map((node) => ({
      client: node.clientWidth,
      scroll: node.scrollWidth,
      text: node.textContent ?? "",
    }));
    const canvasAreaRect = rectOf(".canvas-area");
    const menuRect = rectOf(".map-context-menu");
    const statusRect = rectOf("[data-testid='editor-statusbar']");
    const toolbarRect = rectOf("[data-testid='editor-zoom-controls']");
    const paletteRect = rectOf("[data-testid='left-palette-root']");
    const mapTreeRect = rectOf("[data-testid='left-map-root']");
    return {
      canvasAreaBg: styleOf(".canvas-area").backgroundColor,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      leftPanelHasMockupSections: labelOf("[data-testid='left-palette-root']").includes("맵 이벤트 목록")
        && labelOf("[data-testid='left-map-root']").includes("맵 트리"),
      leftPanelSectionOrder: paletteRect.bottom <= mapTreeRect.top,
      leftBg: styleOf(".left-panel").backgroundColor,
      leftWidth: rectOf(".left-panel").width,
      menuBg: styleOf(".map-context-menu").backgroundColor,
      menuBorderRadius: styleOf(".map-context-menu").borderRadius,
      menuLabelsOverflow: menuLabelWidths.filter((item) => item.scroll > item.client + 1),
      menuStaysAboveStatusbar: menuRect.bottom <= statusRect.top + 1,
      paletteBg: styleOf("[data-testid='left-palette-root']").backgroundColor,
      statusBg: styleOf("[data-testid='editor-statusbar']").backgroundColor,
      statusLabelsOverflow: visibleStatusCells.filter((item) => item.scroll > item.client + 1),
      statusVisible: statusRect.height > 20 && statusRect.bottom <= window.innerHeight,
      topbarBg: styleOf(".topbar").backgroundColor,
      toolbarItemsOverflow: toolbarItems.filter((item) => item.scroll > item.client + 1),
      toolbarStaysInCanvas: toolbarRect.left >= canvasAreaRect.left - 1
        && toolbarRect.right <= canvasAreaRect.right + 1
        && toolbarRect.top >= canvasAreaRect.top - 1
        && toolbarRect.bottom < statusRect.top,
      toolbarBg: styleOf("[data-testid='rm2k3-toolbar']").backgroundColor,
    };
  });

  expect(metrics.topbarBg).toBe("rgb(247, 243, 234)");
  expect(metrics.toolbarBg).toBe("rgb(252, 249, 242)");
  expect(metrics.canvasAreaBg).toBe("rgb(231, 224, 208)");
  expect(metrics.leftBg).toBe("rgb(252, 249, 242)");
  expect(metrics.paletteBg).toBe("rgb(252, 249, 242)");
  expect(metrics.menuBg).toBe("rgb(255, 255, 255)");
  expect(metrics.statusBg).toBe("rgb(252, 249, 242)");
  expect(metrics.leftWidth).toBeGreaterThanOrEqual(320);
  expect(metrics.leftWidth).toBeLessThanOrEqual(410);
  expect(metrics.leftPanelHasMockupSections).toBe(true);
  expect(metrics.leftPanelSectionOrder).toBe(true);
  expect(metrics.menuBorderRadius).toBe("10px");
  expect(metrics.menuLabelsOverflow).toEqual([]);
  expect(metrics.menuStaysAboveStatusbar).toBe(true);
  expect(metrics.statusLabelsOverflow).toEqual([]);
  expect(metrics.toolbarItemsOverflow).toEqual([]);
  expect(metrics.toolbarStaysInCanvas).toBe(true);
  expect(metrics.documentOverflow).toBeLessThanOrEqual(0);
  expect(metrics.statusVisible).toBe(true);
}

test("Figma-like editor shell and Korean event context menu match the dark mockup", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await openEventLayerContextMenu(page, 1680, 945);

  await expect(page.getByTestId("event-layer-create-event")).toContainText("이벤트 생성...");
  await expect(page.getByTestId("event-layer-cut")).toContainText("잘라내기");
  await expect(page.getByTestId("event-layer-copy")).toContainText("복사");
  await expect(page.getByTestId("event-layer-paste")).toContainText("붙여넣기");
  await expect(page.getByTestId("event-layer-delete")).toContainText("삭제");
  await expect(page.getByTestId("event-layer-create-transfer-event")).toContainText("장소 이동 이벤트 생성...");
  await expect(page.getByTestId("event-layer-set-player-start")).toContainText("주인공 시작 위치 설정");
  await expect(page.getByTestId("event-layer-set-vehicle-start")).toContainText("탈것 시작 위치 설정...");
  await expectModernEditorShell(page);
  await page.screenshot({ path: `${EVIDENCE_DIR}/figma-editor-redesign-desktop.png`, fullPage: true });
});

test("Figma-like editor shell keeps Korean labels readable at narrower viewports", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  for (const viewport of [
    { width: 1280, height: 800, path: `${EVIDENCE_DIR}/figma-editor-redesign-1280.png` },
    { width: 768, height: 900, path: `${EVIDENCE_DIR}/figma-editor-redesign-tablet.png` },
  ]) {
    await openEventLayerContextMenu(page, viewport.width, viewport.height);
    await expectModernEditorShell(page);
    await expect(page.getByTestId("left-map-root")).toBeVisible();
    await page.screenshot({ path: viewport.path, fullPage: true });
  }
});
