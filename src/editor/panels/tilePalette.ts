import { el, clearChildren } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import type { Layer } from "@/editor/editorState";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { makeRpgMakerTileToolbar } from "@/editor/panels/rpgMakerTileToolbar";
import { setTerrainTag } from "@/editor/tilesetActions";
import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { renderTileMappingInspector } from "@/editor/panels/tileMappingInspector";
import { renderTilePaletteClusters, type PaletteViewMode } from "@/editor/panels/tilePaletteClusters";
import { makePaletteStampStatus, makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { makeChipsetSheet } from "@/editor/panels/tilePaletteSheet";
import { makeTilePaletteToolSection } from "@/editor/panels/tilePaletteToolbar";
import { describeChipsetTile, tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { compatibleStampIdForTile } from "@/editor/tileStampBrushes";

const CHIPSET_CELL_SIZE = TILE_SIZE * 2;
const PALETTE_VIEW_STORAGE_KEY = "rpg-zzu:palette-view";
const PALETTE_ADVANCED_STORAGE_KEY = "rpg-zzu:palette-advanced";
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
const recentTiles: number[] = [];

type PaletteScroll = {
  readonly containerLeft: number;
  readonly containerTop: number;
  readonly sheetLeft: number;
  readonly sheetTop: number;
};

export function renderTilePalette(container: HTMLElement): void {
  const previousPaletteScroll = readPaletteScroll(container);
  clearChildren(container);
  const state = editorState.get();

  container.append(makeTilePaletteToolSection(currentMapId));

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
    ? makeChipsetSheet({
      activePaletteStamp: state.activePaletteStamp,
      layer: state.layer,
      onCreatePaletteStamp: setPaletteStampFromDrag,
      onSelectTile: selectPaletteTile,
      selectedTile: state.selectedTile,
      tileset,
    })
    : renderTilePaletteClusters({
      layer: state.layer,
      onSelectTile: selectPaletteTile,
      selectedTile: state.selectedTile,
      tileset,
    });
  tileSection.append(makeRpgMakerTileToolbar({ map, rerender: renderPalettePreservingViewport, state, tileset }));
  tileSection.append(makePaletteStampStatus(state.activePaletteStamp, renderPalettePreservingViewport));
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
        onSelectTile: selectPaletteTile,
        rerender: renderPalettePreservingViewport,
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
      // 선택은 pointerdown에서 즉시 — click은 도중 재구축 시 증발(클릭 불가 보고 원인).
      pointerdown: (event) => {
        event.preventDefault();
        selectPaletteTile(index);
      },
      click: (event) => event.preventDefault(),
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
    // 타일을 고르는 행위는 "칠하겠다"는 의도 — select(건축 영역 지정) 등 다른 툴에 갇혀
    // "클릭해도 안 깔리는" 상태가 되지 않게 페인트 계열이 아니면 paint로 전환한다.
    // 단 이벤트 레이어/이벤트 툴은 기존 계약대로 건드리지 않는다(이벤트 편집 흐름 보존).
    const keepTools = new Set(["paint", "fill", "erase", "event"]);
    const switchToPaint = !keepTools.has(state.tool) && nextLayer !== "event";
    editorState.set({
      activePaletteStamp: null,
      activeStampId: nextActiveStampId,
      activeStructureStampId: null,
      layer: nextLayer,
      selectedTile: index,
      ...(switchToPaint ? { tool: "paint" as const } : {}),
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

function setPaletteStampFromDrag(stamp: PaletteStamp): void {
  editorState.set({
    activePaletteStamp: stamp,
    activeStampId: null,
    activeStructureStampId: null,
    paintShape: "pen",
    tool: "paint",
  });
  renderPalettePreservingViewport();
}
