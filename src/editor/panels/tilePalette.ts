import { el, clearChildren } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import type { Tool, Layer } from "@/editor/editorState";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { makeRpgMakerTileToolbar } from "@/editor/panels/rpgMakerTileToolbar";
import { copySelection, pasteClipboard } from "@/editor/mapClipboard";
import { setTerrainTag } from "@/editor/tilesetActions";
import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { renderTileMappingInspector } from "@/editor/panels/tileMappingInspector";
import { renderTilePaletteClusters, type PaletteViewMode } from "@/editor/panels/tilePaletteClusters";
import { describeChipsetTile, tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import {
  favoriteTilesSnapshot,
  selectUsedLocation,
  similarTilesForTile,
  usedLocationsForTile,
} from "@/editor/panels/tileBrushTools";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { createPaletteStampFromDrag, paletteStampIncludesTile } from "@/editor/tilePaletteStamp";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { compatibleStampIdForTile, isAutoConnectCandidate, tileStampsForTile } from "@/editor/tileStampBrushes";
import type { TileStampId } from "@/editor/tileStampBrushes";

type PaletteIcon =
  | "pencil"
  | "bucket"
  | "dropper"
  | "hand"
  | "select"
  | "collision"
  | "event"
  | "eraser"
  | "copy"
  | "paste";

const TOOLS: { readonly id: Tool; readonly label: string; readonly hint: string; readonly icon: PaletteIcon }[] = [
  { id: "paint", label: "연필", hint: "선택한 타일을 칠합니다", icon: "pencil" },
  { id: "fill", label: "채우기", hint: "연결된 영역을 채웁니다", icon: "bucket" },
  { id: "eyedropper", label: "스포이트", hint: "현재 맵 레이어에서 타일을 집습니다", icon: "dropper" },
  { id: "pan", label: "이동", hint: "드래그로 맵 화면을 움직입니다. Space를 누른 동안에도 이동합니다", icon: "hand" },
  { id: "select", label: "선택", hint: "복사/붙여넣기할 맵 칸을 선택합니다", icon: "select" },
  { id: "collision", label: "통행", hint: "통행 가능 여부를 전환합니다", icon: "collision" },
  { id: "event", label: "이벤트", hint: "맵 이벤트를 배치하거나 선택합니다", icon: "event" },
  { id: "erase", label: "지우개", hint: "현재 레이어를 지웁니다", icon: "eraser" },
];

const CHIPSET_CELL_SIZE = TILE_SIZE * 2;
const CHIPSET_SHEET_CELL_SIZE = "var(--chipset-cell)";
const RANGE_DRAG_THRESHOLD_PX = 4;
const PALETTE_VIEW_STORAGE_KEY = "rpg-zzu:palette-view";
const PALETTE_ADVANCED_STORAGE_KEY = "rpg-zzu:palette-advanced";
const CURATED_TOWN_PALETTE_INDEXES = [
  240, 303, 421, 424, 342, 343, 306, 366, 374, 375,
  270, 120, 93, 123, 153, 246, 129, 376, 390, 391,
  392, 420, 422, 260, 262, 263, 288,
  289, 290, 292, 293, 348, 351, 291, 321, 325,
  355, 356, 378, 379, 380, 408, 409, 410, 438,
  439, 327, 328, 357, 358, 329, 359, 465, 85,
  87, 414, 415, 416, 444, 445, 446, 474, 475,
  476, 389, 418, 419, 448, 449, 477, 478, 479,
] as const;
type TileCategoryId = "recent" | "terrain" | "water" | "house" | "fence" | "decor" | "all";

type TileCategory = {
  readonly id: TileCategoryId;
  readonly label: string;
};

const TILE_CATEGORIES: readonly TileCategory[] = [
  { id: "recent", label: "최근" },
  { id: "terrain", label: "지형" },
  { id: "water", label: "물" },
  { id: "house", label: "집" },
  { id: "fence", label: "울타리" },
  { id: "decor", label: "장식" },
  { id: "all", label: "전체" },
] as const;

let activeTileCategory: TileCategoryId = "house";
let tileSearchQuery = "";
let showQuickTileNumbers = false;
let advancedTileToolsExpanded = false;
let resetChipsetScroll = false;
let paletteDragStartTile: number | null = null;
let paletteDragHandled = false;
let sheetRangeDrag: SheetRangeDrag | null = null;
const recentTiles: number[] = [];

type PaletteScroll = {
  readonly containerLeft: number;
  readonly containerTop: number;
  readonly sheetLeft: number;
  readonly sheetTop: number;
};

type SheetRangeRect = {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
};

type SheetRangeSelection = {
  readonly rect: SheetRangeRect;
  readonly tileIds: readonly number[];
};

type SheetRangeDrag = {
  readonly active: boolean;
  readonly currentTile: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startTile: number;
};

type SheetRangeClassifyDetail = {
  readonly kind: "range-classify";
  readonly rect: SheetRangeRect;
  readonly tileIds: readonly number[];
  readonly tilesetId: string;
};

export function renderTilePalette(container: HTMLElement): void {
  const previousPaletteScroll = readPaletteScroll(container);
  clearChildren(container);
  const state = editorState.get();

  const toolSection = el("div", { class: "panel-section" });
  toolSection.append(el("h3", { text: "도구" }));
  const toolGrid = el("div", { class: "tool-grid", dataset: { testid: "tool-grid" } });
  for (const t of TOOLS) {
    toolGrid.append(
      el("button", {
        class: "btn" + (state.tool === t.id ? " active" : ""),
        attrs: { title: t.hint, "aria-label": t.label, "aria-pressed": String(state.tool === t.id) },
        children: [
          el("span", { class: `rm-tool-icon rm-tool-icon-${t.icon}`, attrs: { "aria-hidden": "true" } }),
        ],
        dataset: { testid: `tool-${t.id}` },
        on: { click: () => editorState.set(t.id === "paint" ? { tool: t.id, paintShape: "pen" } : { tool: t.id }) },
      })
    );
  }
  toolSection.append(toolGrid);
  toolSection.append(makeEditCommandRow());
  container.append(toolSection);

  if (state.layer === "event") {
    // 이벤트 레이어에서는 이벤트 편집기(목록/선택/요약)를 사이드 패널에 렌더링한다.
    // 새 이벤트가 생성·선택되면 renderEventEditor 내부의 maybeAutoOpenEventEditor가
    // 명령 카탈로그 모달을 자동으로 연다.
    renderEventEditor(container);
    return;
  }

  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const tileSection = el("div", { class: "panel-section" });
  if (!map) {
    tileSection.append(el("div", { class: "empty-hint", text: "맵을 선택하세요." }));
    container.append(tileSection);
    return;
  }
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) {
    tileSection.append(el("div", { class: "empty-hint", text: "타일셋이 없습니다." }));
    container.append(tileSection);
    return;
  }

  advancedTileToolsExpanded = readAdvancedTileToolsExpanded();
  const paletteView = readPaletteView();
  const palette = paletteView === "sheet"
    ? makeChipsetSheet(state.selectedTile, state.layer, tileset, state.activePaletteStamp)
    : renderTilePaletteClusters({
      layer: state.layer,
      onSelectTile: selectPaletteTile,
      selectedTile: state.selectedTile,
      tileset,
    });
  tileSection.append(makeRpgMakerTileToolbar({ map, rerender: renderPalettePreservingViewport, state, tileset }));
  tileSection.append(makePaletteStampStatus(state.activePaletteStamp));
  // RM2K3처럼 팔레트는 현재 편집 레이어에 속한 타일만 보여 준다 — 제목에 레이어를 명시.
  tileSection.append(makeTilePaletteTitleRow(state.layer, paletteView));
  tileSection.append(palette);
  // 타일 매핑 인스펙터는 항상 표시 — RM2K3에서 현재 타일의 메타데이터
  // (이름/키/AI 라벨/레이어/통행/지형)를 보여주는 표준 패널이다.
  if (advancedTileToolsExpanded) {
    if (state.selectedTile >= 0) {
      tileSection.append(makeTileBrushAssistPanel({
        activeStampId: state.activeStampId,
        autoConnectMode: state.autoConnectMode,
        mapId: map.id,
        selectedTile: state.selectedTile,
        tileset,
      }));
    }
    tileSection.append(makeQuickTilePicker(state.selectedTile, state.layer, tileset));
    if (state.selectedTile >= 0) {
      tileSection.append(renderTileMappingInspector(state.selectedTile, tileset));
      tileSection.append(makeTerrainEditor(tileset.id, state.selectedTile, tileset.terrain[state.selectedTile] ?? 0));
    }
  }
  container.append(tileSection);

  container.append(
    el("div", {
      class: "empty-hint",
      text: tileset.name,
    })
  );
  restorePaletteScroll(container, palette, previousPaletteScroll);
}

type TileBrushAssistModel = {
  readonly activeStampId: TileStampId | null;
  readonly autoConnectMode: boolean;
  readonly mapId: string;
  readonly selectedTile: number;
  readonly tileset: TilesetDef;
};

function makePaletteStampStatus(stamp: PaletteStamp | null): HTMLElement {
  const row = el("div", {
    class: "tile-brush-row palette-stamp-status" + (stamp ? "" : " hidden"),
    dataset: { testid: "palette-stamp-status" },
  });
  row.append(el("span", { class: "tile-brush-label", text: "Drag" }));
  if (!stamp) return row;
  row.append(
    el("button", {
      class: "btn palette-stamp-clear",
      text: `${stamp.width}x${stamp.height}`,
      attrs: {
        title: "Clear dragged palette stamp",
        "aria-label": "Clear dragged palette stamp",
      },
      dataset: { testid: "palette-stamp-clear" },
      on: {
        click: () => {
          editorState.set({ activePaletteStamp: null });
          renderPalettePreservingViewport();
        },
      },
    })
  );
  return row;
}

function makeTileBrushAssistPanel(model: TileBrushAssistModel): HTMLElement {
  const project = store.getCurrent();
  const map = project.maps[model.mapId];
  const stamps = tileStampsForTile(model.selectedTile, model.tileset);
  const favorites = favoriteTilesSnapshot().filter((tile) => tile >= 0 && tile < model.tileset.count);
  const similar = similarTilesForTile({ tileset: model.tileset, tile: model.selectedTile, limit: 8 });
  const used = map ? usedLocationsForTile({ map, tile: model.selectedTile, limit: 6 }) : [];
  const panel = el("div", { class: "tile-brush-assist", dataset: { testid: "tile-brush-assist" } });
  panel.append(
    el("div", {
      class: "tile-brush-row tile-brush-mode-row",
      children: [
        el("span", { class: "tile-brush-label", text: "연결" }),
        el("span", {
          class: "tile-brush-chip" + (model.autoConnectMode && isAutoConnectCandidate(model.selectedTile, model.tileset) ? " active" : ""),
          text: model.autoConnectMode && isAutoConnectCandidate(model.selectedTile, model.tileset) ? "Auto" : "Manual",
          dataset: { testid: "auto-connect-mode-label" },
        }),
      ],
    })
  );
  panel.append(makeStampPicker(stamps, model.activeStampId));
  panel.append(makeTileStrip("즐겨", favorites, "favorite-tile-grid", "favorite-tile"));
  panel.append(makeTileStrip("유사", similar, "similar-tile-grid", "similar-tile"));
  panel.append(makeUsedLocations(model.mapId, used));
  panel.append(makeCurrentNeighborhoodSummary());
  return panel;
}

function makeStampPicker(stamps: ReturnType<typeof tileStampsForTile>, activeStampId: TileStampId | null): HTMLElement {
  const row = el("div", { class: "tile-brush-row" });
  row.append(el("span", { class: "tile-brush-label", text: "스탬프" }));
  const picker = el("div", { class: "stamp-picker", dataset: { testid: "stamp-picker" } });
  if (stamps.length === 0) {
    picker.append(el("span", { class: "tile-brush-empty", text: "없음" }));
  }
  for (const stamp of stamps) {
    picker.append(
      el("button", {
        class: "btn stamp-button" + (activeStampId === stamp.id ? " active" : ""),
        text: stamp.label,
        attrs: {
          title: stamp.description,
          "aria-label": stamp.description,
          "aria-pressed": String(activeStampId === stamp.id),
        },
        dataset: { testid: `stamp-${stamp.id}` },
        on: {
          click: () => {
            editorState.set({ activeStampId: editorState.get().activeStampId === stamp.id ? null : stamp.id });
          },
        },
      })
    );
  }
  row.append(picker);
  return row;
}

function makeTileStrip(label: string, tiles: readonly number[], testId: string, itemPrefix: string): HTMLElement {
  if (tiles.length === 0 && testId === "favorite-tile-grid") {
    return el("div", { class: "tile-brush-row hidden", dataset: { testid: testId } });
  }
  const row = el("div", { class: "tile-brush-row" });
  row.append(el("span", { class: "tile-brush-label", text: label }));
  const strip = el("div", { class: "tile-brush-strip", dataset: { testid: testId } });
  if (tiles.length === 0) {
    strip.append(el("span", { class: "tile-brush-empty", text: "없음" }));
  }
  for (const tile of tiles) {
    strip.append(
      el("button", {
        class: "quick-tile-cell tile-brush-mini-cell",
        attrs: {
          title: tileDisplayLabelForIndex(tile),
          "aria-label": tileDisplayLabelForIndex(tile),
          style: tilePreviewStyle(tile, CHIPSET_CELL_SIZE),
        },
        dataset: { testid: `${itemPrefix}-${tile}` },
        on: {
          pointerdown: (event) => event.preventDefault(),
          click: (event) => {
            event.preventDefault();
            selectPaletteTile(tile);
          },
        },
      })
    );
  }
  row.append(strip);
  return row;
}

function makeUsedLocations(mapId: string, locations: ReturnType<typeof usedLocationsForTile>): HTMLElement {
  if (locations.length === 0) {
    return el("div", { class: "tile-brush-row hidden", dataset: { testid: "used-location-list" } });
  }
  const row = el("div", { class: "tile-brush-row" });
  row.append(el("span", { class: "tile-brush-label", text: "사용" }));
  const list = el("div", { class: "used-location-list", dataset: { testid: "used-location-list" } });
  if (locations.length === 0) {
    list.append(el("span", { class: "tile-brush-empty", text: "0" }));
  }
  for (const location of locations) {
    const label = `${location.layer === "lower" ? "L" : "U"} ${location.x},${location.y}`;
    list.append(
      el("button", {
        class: "btn used-location-button",
        text: label,
        attrs: { title: "현재 맵에서 이 타일을 쓰는 위치", "aria-label": label },
        dataset: { testid: `used-location-${location.layer}-${location.x}-${location.y}` },
        on: {
          click: () => {
            selectUsedLocation({ mapId, ...location });
            renderPalettePreservingViewport();
          },
        },
      })
    );
  }
  row.append(list);
  return row;
}

function makeCurrentNeighborhoodSummary(): HTMLElement {
  const selection = editorState.get().selection;
  if (!selection) {
    return el("div", { class: "tile-brush-neighborhood hidden", dataset: { testid: "current-neighborhood-summary" } });
  }
  const text = selection ? `${selection.x},${selection.y} / ${selection.width}x${selection.height}` : "-";
  return el("div", {
    class: "tile-brush-neighborhood",
    children: [
      el("span", { class: "tile-brush-label", text: "주변" }),
      el("span", { class: "tile-brush-neighborhood-value", text, dataset: { testid: "current-neighborhood-summary" } }),
    ],
  });
}

function makeQuickTilePicker(
  selectedTile: number,
  layer: Exclude<Layer, "event">,
  tileset: TilesetDef
): HTMLElement {
  const root = el("div", {
    class: "quick-tile-picker" + (showQuickTileNumbers ? " show-index" : ""),
    attrs: { id: "quick-tile-picker" },
    dataset: { testid: "quick-tile-picker" },
  });
  const tabs = el("div", { class: "tile-category-tabs", attrs: { role: "tablist", "aria-label": "타일 카테고리" } });
  for (const category of TILE_CATEGORIES) {
    tabs.append(
      el("button", {
        class: "btn tile-category-tab" + (activeTileCategory === category.id ? " active" : ""),
        text: category.label,
        attrs: {
          role: "tab",
          "aria-selected": String(activeTileCategory === category.id),
          title: `${category.label} 타일 보기`,
        },
        dataset: { testid: `tile-category-${category.id}` },
        on: {
          click: () => {
            activeTileCategory = category.id;
            renderPalettePreservingViewport();
          },
        },
      })
    );
  }

  const search = el("input", {
    class: "tile-search-input",
    attrs: {
      type: "search",
      placeholder: "번호, 이름, AI 태그 검색",
      "aria-label": "타일 검색",
    },
    value: tileSearchQuery,
    dataset: { testid: "tile-search-input" },
    on: {
      input: (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        tileSearchQuery = target.value;
        renderPalettePreservingViewport();
      },
    },
  });
  const toolbar = el("div", { class: "quick-tile-toolbar" });
  toolbar.append(search);

  const grid = el("div", { class: "quick-tile-grid", dataset: { testid: "quick-tile-grid" } });
  const matches = quickTileIndexes(tileset).slice(0, 96);
  for (const index of matches) {
    // 빠른 선택은 검색 편의상 전 레이어를 보여 주되, 다른 레이어 타일은 흐리게 표시한다.
    // 클릭하면 selectPaletteTile이 해당 타일의 홈 레이어로 자동 전환한다.
    grid.append(makeQuickTileCell(index, selectedTile === index, tileVisibleOnLayer(tileset, index, layer)));
  }
  if (matches.length === 0) {
    grid.append(el("div", { class: "empty-hint quick-tile-empty", text: "검색 결과 없음" }));
  }

  root.append(tabs, toolbar, grid);
  return root;
}

function renderCurrentPalette(): void {
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (root) renderTilePalette(root);
}

function renderPalettePreservingViewport(): void {
  preservePaletteViewport(renderCurrentPalette);
}

function makeTilePaletteTitleRow(layer: Exclude<Layer, "event">, paletteView: PaletteViewMode): HTMLElement {
  const row = el("div", { class: "tile-palette-title-row" });
  row.append(el("h3", {
    class: "tile-palette-title",
    text: layer === "upper" ? "타일 팔레트 · 상위 레이어" : "타일 팔레트 · 하위 레이어",
  }));
  row.append(
    el("div", {
      class: "tile-palette-title-controls",
      children: [
        el("div", {
          class: "palette-view-segment",
          attrs: { role: "group", "aria-label": "타일 팔레트 보기" },
          children: [
            makePaletteViewButton("cluster", "클러스터", paletteView),
            makePaletteViewButton("sheet", "시트", paletteView),
          ],
        }),
        makeAdvancedTileToolsToggle(),
      ],
    })
  );
  return row;
}

function makePaletteViewButton(view: PaletteViewMode, label: string, activeView: PaletteViewMode): HTMLButtonElement {
  const active = view === activeView;
  return el("button", {
    class: "btn palette-view-button" + (active ? " active" : ""),
    text: label,
    attrs: {
      "aria-label": `${label} 보기`,
      "aria-pressed": String(active),
      title: `${label} 보기`,
    },
    dataset: { testid: view === "cluster" ? "palette-view-cluster" : "palette-view-sheet" },
    on: {
      click: () => {
        writePaletteStorage(PALETTE_VIEW_STORAGE_KEY, view);
        renderPalettePreservingViewport();
      },
    },
  });
}

function makeAdvancedTileToolsToggle(): HTMLButtonElement {
  return el("button", {
    class: "btn tile-advanced-toggle" + (advancedTileToolsExpanded ? " active" : ""),
    text: advancedTileToolsExpanded ? "고급 ▾" : "고급 ▸",
    attrs: {
      "aria-expanded": String(advancedTileToolsExpanded),
      title: "고급 타일 도구",
    },
    dataset: { testid: "tile-advanced-toggle" },
    on: {
      click: () => {
        advancedTileToolsExpanded = !advancedTileToolsExpanded;
        writePaletteStorage(PALETTE_ADVANCED_STORAGE_KEY, advancedTileToolsExpanded ? "1" : "0");
        renderPalettePreservingViewport();
      },
    },
  });
}

function readPaletteView(): PaletteViewMode {
  return readPaletteStorage(PALETTE_VIEW_STORAGE_KEY) === "sheet" ? "sheet" : "cluster";
}

function readAdvancedTileToolsExpanded(): boolean {
  return readPaletteStorage(PALETTE_ADVANCED_STORAGE_KEY) === "1";
}

function readPaletteStorage(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

function writePaletteStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value);
}

function quickTileIndexes(tileset: TilesetDef): readonly number[] {
  const normalizedQuery = tileSearchQuery.trim().toLowerCase();
  const source = activeTileCategory === "recent"
    ? recentTiles.filter((index) => index < tileset.count)
    : Array.from({ length: tileset.count }, (_, index) => index);
  return source.filter((index) => {
    const tile = describeChipsetTile(index);
    if (!matchesCategory(activeTileCategory, tile.tags, tile.usage, tileset.priority[index] ?? "lower")) return false;
    if (normalizedQuery.length === 0) return true;
    return [
      String(index),
      tile.label,
      tile.description,
      tile.aiLabel,
      tile.key,
      tile.tags.join(" "),
      tileDisplayLabelForIndex(index),
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

function matchesCategory(
  category: TileCategoryId,
  tags: readonly string[],
  usage: string,
  layer: "lower" | "upper"
): boolean {
  if (category === "all") return true;
  if (category === "recent") return true;
  if (category === "terrain") return layer === "lower" && ["terrain", "path", "edge", "detail"].includes(usage);
  if (category === "water") return tags.some((tag) => ["water", "lake", "shore", "waterfall"].includes(tag));
  if (category === "house") return tags.includes("house") || tags.includes("building") || tags.includes("roof");
  if (category === "fence") return tags.includes("fence");
  return usage === "decoration" || layer === "upper";
}

function makeQuickTileCell(
  index: number,
  active: boolean,
  currentLayer: boolean
): HTMLButtonElement {
  const name = `${tileDisplayLabelForIndex(index)} / AI: ${tileAiLabelForIndex(index)}`;
  return el("button", {
    class: "quick-tile-cell" + (active ? " active" : "") + (currentLayer ? "" : " muted"),
    attrs: {
      title: name,
      "aria-label": name,
      style: tilePreviewStyle(index, CHIPSET_CELL_SIZE),
    },
    children: [el("span", { class: "quick-tile-index", text: String(index) })],
    dataset: { testid: `quick-tile-${index}` },
    on: {
      pointerdown: (event) => event.preventDefault(),
      click: (event) => {
        event.preventDefault();
        selectPaletteTile(index);
      },
    },
  });
}

export function selectPaletteTile(index: number): void {
  preservePaletteViewport(() => {
    const existingIndex = recentTiles.indexOf(index);
    if (existingIndex >= 0) recentTiles.splice(existingIndex, 1);
    recentTiles.unshift(index);
    if (recentTiles.length > 18) recentTiles.length = 18;
    const state = editorState.get();
    const tileset = currentTilesetForPalette();
    const nextActiveStampId = compatibleStampIdForTile(state.activeStampId, index, tileset);
    // RM2K3식 엄격 분류: 타일은 소속 레이어가 정해져 있다. 다른 레이어의 타일을
    // (검색/즐겨찾기/유사 타일 등에서) 선택하면 편집 레이어를 그 타일의 홈으로 전환한다.
    // 이벤트 레이어에서는 전환하지 않는다 — 이벤트 편집 흐름을 깨지 않기 위해.
    let nextLayer = state.layer;
    if (tileset && state.layer !== "event") {
      const home = tileLayerHome(tileset, index);
      if (home !== "both" && home !== state.layer) nextLayer = home;
    }
    editorState.set({
      activePaletteStamp: null,
      activeStampId: nextActiveStampId,
      activeStructureStampId: null,
      layer: nextLayer,
      selectedTile: index,
    });
  });
}

function preservePaletteViewport(action: () => void): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    action();
    return;
  }
  const container = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  const palette = container ? paletteViewportElement(container) : null;
  const scroll = container ? readPaletteScroll(container) : null;
  const windowScroll = { x: window.scrollX, y: window.scrollY };
  action();
  const restore = (): void => {
    const nextContainer = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
    const nextPalette = nextContainer ? paletteViewportElement(nextContainer) : null;
    if (scroll && nextContainer && nextPalette) applyPaletteScroll(nextContainer, nextPalette, scroll);
    if (palette && container && scroll) applyPaletteScroll(container, palette, scroll);
    window.scrollTo(windowScroll.x, windowScroll.y);
  };
  restore();
  window.setTimeout(restore, 0);
  window.setTimeout(restore, 50);
  window.requestAnimationFrame(restore);
}

function readPaletteScroll(container: HTMLElement): PaletteScroll {
  const palette = paletteViewportElement(container);
  return {
    containerLeft: container.scrollLeft,
    containerTop: container.scrollTop,
    sheetLeft: palette?.scrollLeft ?? 0,
    sheetTop: palette?.scrollTop ?? 0,
  };
}

function paletteViewportElement(container: HTMLElement): HTMLElement | null {
  return (
    container.querySelector<HTMLElement>('[data-testid="tile-palette"]') ??
    container.querySelector<HTMLElement>('[data-testid="tile-palette-clusters"]')
  );
}

function restorePaletteScroll(container: HTMLElement, palette: HTMLElement, scroll: PaletteScroll): void {
  if (resetChipsetScroll) {
    resetChipsetScroll = false;
    const resetScroll = { ...scroll, sheetLeft: 0, sheetTop: 0 };
    applyPaletteScroll(container, palette, resetScroll);
    window.requestAnimationFrame(() => applyPaletteScroll(container, palette, resetScroll));
    return;
  }
  applyPaletteScroll(container, palette, scroll);
  window.requestAnimationFrame(() => applyPaletteScroll(container, palette, scroll));
}

function applyPaletteScroll(container: HTMLElement, palette: HTMLElement, scroll: PaletteScroll): void {
  palette.scrollLeft = scroll.sheetLeft;
  palette.scrollTop = scroll.sheetTop;
  container.scrollLeft = scroll.containerLeft;
  container.scrollTop = scroll.containerTop;
}

function makeEditCommandRow(): HTMLElement {
  const row = el("div", { class: "tool-command-row" });
  const commands = [
    { id: "copy", label: "복사", title: "선택 영역 복사", icon: "copy", action: () => copySelection(currentMapId()) },
    {
      id: "paste",
      label: "붙여넣기",
      title: "선택 위치에 붙여넣기",
      icon: "paste",
      action: () => {
        const state = editorState.get();
        const target = state.selection ?? { x: 0, y: 0 };
        return pasteClipboard(currentMapId(), target.x, target.y);
      },
    },
  ];
  for (const command of commands) {
    row.append(
      el("button", {
        class: "btn icon-btn",
        attrs: { title: command.title, "aria-label": command.label },
        children: [
          el("span", { class: `rm-tool-icon rm-tool-icon-${command.icon}`, attrs: { "aria-hidden": "true" } }),
        ],
        dataset: { testid: `${command.id}-button` },
        on: { click: () => void command.action() },
      })
    );
  }
  return row;
}

function tilePreviewStyle(selectedTile: number, previewSize: number | string): string {
  if (selectedTile < 0) return "";
  const tileset = currentTilesetForPalette();
  if (!tileset || selectedTile >= tileset.count) return "";
  return tilesetTileBackgroundStyle(tileset, selectedTile, previewSize);
}

function currentMapId(): string {
  const project = store.getCurrent();
  return editorState.get().currentMapId ?? project.startMapId;
}

function currentTilesetForPalette(): TilesetDef | undefined {
  const project = store.getCurrent();
  const map = project.maps[currentMapId()];
  if (!map) return undefined;
  return project.tilesets[map.tilesetId];
}

function makeTerrainEditor(tilesetId: string, selectedTile: number, terrain: number): HTMLElement {
  const row = el("div", { class: "field compact-field" });
  row.append(el("label", { text: "지형" }));
  const input = el("input", {
    attrs: { type: "number", min: "0", max: "99" },
    value: String(terrain),
    dataset: { testid: "terrain-tag-input" },
  }) as HTMLInputElement;
  const button = el("button", {
    class: "btn",
    text: "적용",
    dataset: { testid: "terrain-tag-apply" },
    on: {
      click: () => setTerrainTag(tilesetId, selectedTile, parseInt(input.value, 10) || 0),
    },
  });
  row.append(input, button);
  return row;
}

function makeChipsetSheet(
  selectedTile: number,
  layer: Exclude<Layer, "event">,
  tileset: TilesetDef,
  activePaletteStamp: PaletteStamp | null
): HTMLElement {
  const rows = Math.ceil(tileset.count / tileset.tilesPerRow);
  // RM2K3식 엄격 분류: 현재 편집 레이어에 속한 타일만 시트에 노출한다.
  const tileIndexes = displayPaletteTileIndexes(tileset).filter((index) => tileVisibleOnLayer(tileset, index, layer));
  const classifiedTileIds = classifiedTiles(tileset);
  const sheet = el("div", {
    class: "chipset-sheet tile-palette chipset-sheet-filtered",
    dataset: { testid: "tile-palette" },
    attrs: {
      style: [
        `--chipset-cols:${tileset.tilesPerRow}`,
        `--chipset-rows:${rows}`,
        `--chipset-cell:${CHIPSET_CELL_SIZE}px`,
        `--chipset-width:${tileset.tilesPerRow * CHIPSET_CELL_SIZE}px`,
        `--chipset-height:${rows * CHIPSET_CELL_SIZE}px`,
      ].join(";"),
    },
  });
  sheet.addEventListener(
    "wheel",
    (event) => {
      const verticalDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      const verticalTarget = scrollWheelTarget(sheet, verticalDelta);
      if (!verticalTarget) return;
      const before = verticalTarget.scrollTop;
      verticalTarget.scrollTop += verticalDelta;
      if (verticalTarget.scrollTop !== before) event.preventDefault();
    },
    { passive: false }
  );
  const overlay = el("div", { class: "chipset-grid", dataset: { testid: "chipset-sheet" } });
  const cells = new Map<number, HTMLButtonElement>();
  for (const index of tileIndexes) {
    const cell = makeChipsetCell({
      active: selectedTile === index,
      classified: classifiedTileIds.has(index),
      currentLayer: true,
      inPaletteStamp: paletteStampIncludesTile(activePaletteStamp, index, tileset.tilesPerRow),
      index,
      tileset,
    });
    cells.set(index, cell);
    overlay.append(cell);
  }
  sheet.append(overlay);
  installSheetRangeSelection({ cells, layer, overlay, sheet, tileset });
  return sheet;
}

function displayPaletteTileIndexes(tileset: TilesetDef): readonly number[] {
  const curated = CURATED_TOWN_PALETTE_INDEXES.filter((index) => index < tileset.count);
  const curatedSet = new Set<number>(curated);
  const remaining = Array.from({ length: tileset.count }, (_, index) => index)
    .filter((index) => !curatedSet.has(index));
  return [...curated, ...remaining];
}

function scrollWheelTarget(sheet: HTMLElement, deltaY: number): HTMLElement | null {
  if (deltaY === 0) return null;
  if (canScrollVertically(sheet, deltaY)) return sheet;
  const root = sheet.closest<HTMLElement>('[data-testid="left-palette-root"]');
  if (!root || !canScrollVertically(root, deltaY)) return null;
  return root;
}

function canScrollVertically(node: HTMLElement, deltaY: number): boolean {
  const maxScrollTop = node.scrollHeight - node.clientHeight;
  if (maxScrollTop <= 0) return false;
  return deltaY > 0 ? node.scrollTop < maxScrollTop : node.scrollTop > 0;
}

type ChipsetCellModel = {
  readonly active: boolean;
  readonly classified: boolean;
  readonly currentLayer: boolean;
  readonly inPaletteStamp: boolean;
  readonly index: number;
  readonly tileset: TilesetDef;
};

function makeChipsetCell(model: ChipsetCellModel): HTMLButtonElement {
  const index = model.index;
  const name = tilePaletteAccessibleName(model.tileset, index);
  const cell = el("button", {
    class: "chipset-tile"
      + (model.active ? " active" : "")
      + (model.currentLayer ? "" : " muted")
      + (model.classified ? " classified" : "")
      + (model.inPaletteStamp ? " stamp-source" : ""),
    attrs: {
      title: name,
      "aria-label": name,
      style: tilePreviewStyle(index, CHIPSET_SHEET_CELL_SIZE),
    },
    dataset: { testid: `chipset-tile-${index}`, tileIndex: String(index) },
    on: {
      pointercancel: () => {
        paletteDragStartTile = null;
      },
      pointerdown: (event) => startPaletteStampDrag(index, event),
      pointerup: (event) => finishPaletteStampDrag(index, model.tileset, event),
      click: (event) => {
        event.preventDefault();
        if (paletteDragHandled) {
          paletteDragHandled = false;
          return;
        }
        selectPaletteTile(index);
      },
    },
  });
  return cell;
}

function tilePaletteAccessibleName(tileset: TilesetDef, index: number): string {
  const fallbackLabel = tileDisplayLabelForIndex(index);
  const fallbackAiLabel = tileAiLabelForIndex(index);
  const meta = tileset.tileMeta?.[index];
  const group = tileset.tileGroups?.find((entry) => entry.tileIds.includes(index));
  const semanticLabel = cleanTileText(meta?.label) || group?.name;
  const label = semanticLabel ? `${index} ${semanticLabel}` : fallbackLabel;
  const aiLabel = cleanTileText(meta?.description) || group?.description || fallbackAiLabel;
  return `${label} / AI: ${aiLabel}`;
}

function cleanTileText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function classifiedTiles(tileset: TilesetDef): Set<number> {
  const classified = new Set<number>();
  for (const group of tileset.tileGroups ?? []) {
    for (const tileId of group.tileIds) {
      if (tileId >= 0 && tileId < tileset.count) classified.add(tileId);
    }
  }
  for (let index = 0; index < tileset.count; index += 1) {
    if (cleanTileText(tileset.tileMeta?.[index]?.label)) classified.add(index);
  }
  return classified;
}

type SheetRangeSelectionArgs = {
  readonly cells: ReadonlyMap<number, HTMLButtonElement>;
  readonly layer: Exclude<Layer, "event">;
  readonly overlay: HTMLElement;
  readonly sheet: HTMLElement;
  readonly tileset: TilesetDef;
};

function installSheetRangeSelection(args: SheetRangeSelectionArgs): void {
  const marquee = el("div", {
    class: "chipset-range-marquee hidden",
    attrs: { "aria-hidden": "true" },
    dataset: { testid: "sheet-range-marquee" },
  });
  let rangeAction: HTMLButtonElement | null = null;
  args.sheet.append(marquee);

  const showSelection = (selection: SheetRangeSelection): void => {
    paintRangeCells(args.cells, selection.tileIds);
    rangeAction?.remove();
    rangeAction = null;
    if (selection.tileIds.length === 0) return;
    rangeAction = rangeClassifyButton(args.tileset.id, selection);
    args.sheet.append(rangeAction);
  };

  args.overlay.addEventListener("pointerdown", (event) => {
    if (!isPrimaryButtonEvent(event)) return;
    const startTile = tileIndexFromEventTarget(event, args.overlay);
    if (startTile === null) return;
    const point = pointerPoint(event);
    sheetRangeDrag = {
      active: false,
      currentTile: startTile,
      startClientX: point.x,
      startClientY: point.y,
      startTile,
    };
    rangeAction?.remove();
    rangeAction = null;
    paintRangeCells(args.cells, []);
    hideMarquee(marquee);
  });

  args.overlay.addEventListener("pointermove", (event) => {
    const drag = sheetRangeDrag;
    if (!drag) return;
    const currentTile = tileIndexFromEventTarget(event, args.overlay) ?? drag.currentTile;
    const active = drag.active || pointerDistance(drag, event) >= RANGE_DRAG_THRESHOLD_PX;
    sheetRangeDrag = { ...drag, active, currentTile };
    if (!active) return;
    paletteDragHandled = true;
    const selection = sheetRangeSelection(args.tileset, args.layer, drag.startTile, currentTile);
    paintRangeCells(args.cells, selection.tileIds);
    updateMarquee(marquee, drag, event);
    event.preventDefault();
  });

  args.overlay.addEventListener("pointerup", (event) => {
    const drag = sheetRangeDrag;
    if (!drag) return;
    const currentTile = tileIndexFromEventTarget(event, args.overlay) ?? drag.currentTile;
    const active = drag.active || pointerDistance(drag, event) >= RANGE_DRAG_THRESHOLD_PX;
    sheetRangeDrag = null;
    hideMarquee(marquee);
    if (!active) return;
    paletteDragHandled = true;
    showSelection(sheetRangeSelection(args.tileset, args.layer, drag.startTile, currentTile));
    event.preventDefault();
  });

  args.overlay.addEventListener("pointercancel", () => {
    sheetRangeDrag = null;
    hideMarquee(marquee);
  });
}

function rangeClassifyButton(tilesetId: string, selection: SheetRangeSelection): HTMLButtonElement {
  return el("button", {
    class: "sheet-range-classify",
    text: "🤖 이 범위 분류",
    attrs: { title: "선택한 시트 범위를 새 클러스터로 분류", type: "button" },
    dataset: { testid: "sheet-range-classify" },
    on: {
      click: (event) => {
        event.preventDefault();
        event.stopPropagation();
        openRangeClassifyModal({
          kind: "range-classify",
          rect: selection.rect,
          tileIds: selection.tileIds,
          tilesetId,
        });
      },
    },
  });
}

// ponytail: Team B owns the modal union; remove this adapter once range-classify lands in ClusterAiModalDetail.
function openRangeClassifyModal(detail: SheetRangeClassifyDetail): void {
  Reflect.apply(openClusterAiModal, undefined, [detail]);
}

function paintRangeCells(cells: ReadonlyMap<number, HTMLButtonElement>, tileIds: readonly number[]): void {
  for (const cell of cells.values()) cell.classList.remove("range-selected");
  for (const tileId of tileIds) cells.get(tileId)?.classList.add("range-selected");
}

function sheetRangeSelection(
  tileset: TilesetDef,
  layer: Exclude<Layer, "event">,
  startTile: number,
  endTile: number
): SheetRangeSelection {
  const rect = normalizeSheetRect(startTile, endTile, tileset.tilesPerRow);
  return {
    rect,
    tileIds: tileIdsInRect(tileset, layer, rect),
  };
}

function normalizeSheetRect(startTile: number, endTile: number, tilesPerRow: number): SheetRangeRect {
  const start = tilePoint(startTile, tilesPerRow);
  const end = tilePoint(endTile, tilesPerRow);
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    h: Math.abs(start.y - end.y) + 1,
    w: Math.abs(start.x - end.x) + 1,
    x,
    y,
  };
}

function tilePoint(tile: number, tilesPerRow: number): { readonly x: number; readonly y: number } {
  return { x: tile % tilesPerRow, y: Math.floor(tile / tilesPerRow) };
}

function tileIdsInRect(tileset: TilesetDef, layer: Exclude<Layer, "event">, rect: SheetRangeRect): readonly number[] {
  const tileIds: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const tileId = y * tileset.tilesPerRow + x;
      if (tileId >= tileset.count) continue;
      if (tileVisibleOnLayer(tileset, tileId, layer)) tileIds.push(tileId);
    }
  }
  return tileIds;
}

function tileIndexFromEventTarget(event: Event, boundary: HTMLElement): number | null {
  let node = event.target instanceof HTMLElement ? event.target : null;
  while (node) {
    const tileIndex = integerString(node.dataset.tileIndex);
    if (tileIndex !== null) return tileIndex;
    if (node === boundary) return null;
    node = node.parentElement;
  }
  return null;
}

function integerString(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/u.test(value)) return null;
  return Number.parseInt(value, 10);
}

function pointerPoint(event: Event): { readonly x: number; readonly y: number } {
  const x = Reflect.get(event, "clientX");
  const y = Reflect.get(event, "clientY");
  return {
    x: typeof x === "number" ? x : 0,
    y: typeof y === "number" ? y : 0,
  };
}

function pointerDistance(drag: SheetRangeDrag, event: Event): number {
  const point = pointerPoint(event);
  return Math.hypot(point.x - drag.startClientX, point.y - drag.startClientY);
}

function updateMarquee(marquee: HTMLElement, drag: SheetRangeDrag, event: Event): void {
  const start = { x: drag.startClientX, y: drag.startClientY };
  const current = pointerPoint(event);
  marquee.style.setProperty("--range-left", `${Math.min(start.x, current.x)}px`);
  marquee.style.setProperty("--range-top", `${Math.min(start.y, current.y)}px`);
  marquee.style.setProperty("--range-width", `${Math.abs(start.x - current.x)}px`);
  marquee.style.setProperty("--range-height", `${Math.abs(start.y - current.y)}px`);
  marquee.classList.remove("hidden");
}

function hideMarquee(marquee: HTMLElement): void {
  marquee.classList.add("hidden");
}

function startPaletteStampDrag(index: number, event: Event): void {
  if (!isPrimaryButtonEvent(event)) return;
  paletteDragStartTile = index;
  paletteDragHandled = false;
  event.preventDefault();
}

function finishPaletteStampDrag(index: number, tileset: TilesetDef, event: Event): void {
  if (!isPrimaryButtonEvent(event)) return;
  if (sheetRangeDrag?.active) {
    paletteDragStartTile = null;
    paletteDragHandled = true;
    event.preventDefault();
    return;
  }
  const startTile = paletteDragStartTile;
  paletteDragStartTile = null;
  if (startTile === null || startTile === index) return;
  const stamp = createPaletteStampFromDrag({ endTile: index, startTile, tileset });
  paletteDragHandled = true;
  editorState.set({
    activePaletteStamp: stamp,
    activeStampId: null,
    activeStructureStampId: null,
    paintShape: "pen",
    tool: "paint",
  });
  event.preventDefault();
  renderPalettePreservingViewport();
}

function isPrimaryButtonEvent(event: Event): boolean {
  if (!("button" in event)) return true;
  return typeof event.button === "number" && event.button === 0;
}
