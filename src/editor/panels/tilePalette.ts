import { el, clearChildren } from "@/util/dom";
import { editorState } from "@/editor/editorState";
import type { Layer } from "@/editor/editorState";
import { getEditorUiMode } from "@/editor/editorUiMode";
import { renderBasicLeftRail } from "@/editor/panels/basicLeftRail";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { makeRpgMakerTileToolbar } from "@/editor/panels/rpgMakerTileToolbar";
import { setTerrainTag } from "@/editor/tilesetActions";
import { TILE_SIZE } from "@/assets/bundled";
import { isDefaultTilesetTexture, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { renderTileMappingInspector } from "@/editor/panels/tileMappingInspector";
import { makePaletteStampStatus, makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { makeRm2kPalette, rm2kPaletteDisplayTile } from "@/editor/panels/tilePaletteRm2k";
import { makeTilePaletteToolSection } from "@/editor/panels/tilePaletteToolbar";
import { describeChipsetTile, tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { tileLayerHome, tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { compatibleStampIdForTile } from "@/editor/tileStampBrushes";
import { toast } from "@/util/toast";

const CHIPSET_CELL_SIZE = TILE_SIZE * 2;
/** 작업 모드 탭: 칠하기 | 찾기 | 속성 */
const PALETTE_WORK_TAB_KEY = "rpg-zzu:palette-work-tab";
/** 구 advanced 플래그 — 있으면 find 탭으로 마이그레이션 */
const PALETTE_ADVANCED_STORAGE_KEY = "rpg-zzu:palette-advanced";

type PaletteWorkTab = "paint" | "find" | "props";
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

const WORK_TABS: readonly { readonly id: PaletteWorkTab; readonly label: string; readonly title: string; readonly testid: string }[] = [
  { id: "paint", label: "칠하기", title: "도구 + 타일 팔레트", testid: "palette-work-tab-paint" },
  // quick-tile-toggle: 레거시 e2e/단축 호환 (찾기 탭 = 예전 빠른 선택)
  { id: "find", label: "찾기", title: "검색·카테고리로 타일 찾기", testid: "quick-tile-toggle" },
  { id: "props", label: "속성", title: "선택 타일 메타·통행·지형", testid: "palette-work-tab-props" },
] as const;

let activeTileCategory: TileCategoryId = "recent";
let tileSearchQuery = "";
let showQuickTileNumbers = false;
let activeWorkTab: PaletteWorkTab = "paint";
/** 맵 우클릭 스포이트 후 팔레트 칩셋 셀로 스크롤 (전문가 모드). */
let pendingRevealSelectedTile = false;
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
  activeWorkTab = readWorkTab();

  // 기본 모드: 레퍼런스 밀도 좌측 레일 (도구·타일·레이어). 맵 트리는 하단 맵 루트.
  // 작업탭(칠하기/찾기/속성)은 이 조기 return 아래 expert 경로에만 존재한다.
  if (getEditorUiMode() === "basic") {
    renderBasicLeftRail(container);
    return;
  }

  if (state.layer === "event") {
    // 이벤트 레이어: 도구 + 이벤트 편집기. basic/expert 모두 동일 경로(숨기지 않음).
    container.append(makeTilePaletteToolSection(currentMapId));
    renderEventEditor(container);
    return;
  }

  // event 분기 이후 타일 레이어로 좁힌다 (시트/클러스터 API가 lower|upper만 받음).
  const tileLayer: Exclude<Layer, "event"> = state.layer;

  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const shell = el("div", {
    class: "panel-section palette-work-shell",
    dataset: { testid: "palette-work-shell", workTab: activeWorkTab },
  });
  if (!map) {
    shell.append(el("div", { class: "empty-hint", text: "맵을 선택하세요." }));
    container.append(shell);
    return;
  }
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) {
    shell.append(el("div", { class: "empty-hint", text: "타일셋이 없습니다." }));
    container.append(shell);
    return;
  }

  shell.append(makeWorkTabBar());
  shell.append(makeSelectedTileStatus(state.selectedTile, tileset));
  shell.append(
    el("div", {
      class: "palette-tileset-badge",
      text: tileset.name,
      attrs: { title: tileset.name },
      dataset: { testid: "palette-tileset-name" },
    })
  );

  let palette: HTMLElement | null = null;
  if (activeWorkTab === "paint") {
    const paintBody = makePaintTabBody({
      map,
      state,
      tileLayer,
      tileset,
    });
    palette = paintBody.palette;
    shell.append(paintBody.root);
  } else if (activeWorkTab === "find") {
    shell.append(makeQuickTilePicker(state.selectedTile, tileLayer, tileset));
  } else {
    shell.append(makePropsTabBody({
      mapId: map.id,
      selectedTile: state.selectedTile,
      state,
      tileset,
    }));
  }

  // 레거시 호환: 숨은 advanced 토글 — 속성/찾기 전환용 테스트 훅
  shell.append(makeLegacyAdvancedToggle());

  container.append(shell);
  if (palette) restorePaletteScroll(container, palette, previousPaletteScroll);
  if (pendingRevealSelectedTile) {
    pendingRevealSelectedTile = false;
    const tile = state.selectedTile;
    window.requestAnimationFrame(() => revealChipsetTileInPalette(tile));
  }
}

function makeWorkTabBar(): HTMLElement {
  const bar = el("div", {
    class: "palette-work-tabs",
    attrs: { role: "tablist", "aria-label": "타일 작업 모드" },
    dataset: { testid: "palette-work-tabs" },
  });
  for (const tab of WORK_TABS) {
    const active = activeWorkTab === tab.id;
    bar.append(
      el("button", {
        class: "btn palette-work-tab" + (active ? " active" : ""),
        text: tab.label,
        attrs: {
          role: "tab",
          "aria-selected": String(active),
          title: tab.title,
          type: "button",
        },
        dataset: { testid: tab.testid },
        on: {
          click: () => {
            if (activeWorkTab === tab.id) return;
            activeWorkTab = tab.id;
            writePaletteStorage(PALETTE_WORK_TAB_KEY, tab.id);
            // 찾기/속성을 쓰면 advanced 플래그도 맞춰 구 테스트 기대와 맞춘다.
            writePaletteStorage(PALETTE_ADVANCED_STORAGE_KEY, tab.id === "paint" ? "0" : "1");
            renderPalettePreservingViewport();
          },
        },
      })
    );
  }
  return bar;
}

/** 구 tile-advanced-toggle: 클릭 시 찾기 탭으로 (unit e2e 호환). */
function makeLegacyAdvancedToggle(): HTMLElement {
  return el("button", {
    class: "btn tile-advanced-toggle is-legacy-hook",
    text: "고급",
    attrs: {
      type: "button",
      hidden: "",
      "aria-hidden": "true",
      "aria-expanded": String(activeWorkTab !== "paint"),
    },
    dataset: { testid: "tile-advanced-toggle" },
    on: {
      click: () => {
        activeWorkTab = activeWorkTab === "find" ? "paint" : "find";
        writePaletteStorage(PALETTE_WORK_TAB_KEY, activeWorkTab);
        writePaletteStorage(PALETTE_ADVANCED_STORAGE_KEY, activeWorkTab === "paint" ? "0" : "1");
        renderPalettePreservingViewport();
      },
    },
  });
}

function makeSelectedTileStatus(selectedTile: number, tileset: TilesetDef): HTMLElement {
  const label =
    selectedTile < 0 || selectedTile >= tileset.count
      ? "없음"
      : `${selectedTile} ${quickTileName(tileset, selectedTile)}`;
  return el("div", {
    class: "selected-tile-status",
    text: label,
    attrs: { title: "현재 선택 타일" },
    dataset: { testid: "selected-tile-status" },
  });
}

function makePaintTabBody(input: {
  readonly map: { readonly id: string; readonly tilesetId: string };
  readonly state: ReturnType<typeof editorState.get>;
  readonly tileLayer: Exclude<Layer, "event">;
  readonly tileset: TilesetDef;
}): { readonly root: HTMLElement; readonly palette: HTMLElement } {
  const { map, state, tileLayer, tileset } = input;
  const root = el("div", {
    class: "palette-work-pane is-paint",
    dataset: { testid: "palette-work-pane-paint" },
  });
  root.append(makeTilePaletteToolSection(currentMapId));
  root.append(makeRpgMakerTileToolbar({ map, rerender: renderPalettePreservingViewport, state, tileset }));
  root.append(makePaletteStampStatus(state.activePaletteStamp, renderPalettePreservingViewport));

  // RM2003식 단일 팔레트 — 그룹/시트 보기 분리 없이 6열 고정, 오토타일은 대표 1칸 축약.
  const palette = makeRm2kPalette({
    layer: tileLayer,
    onSelectTile: selectPaletteTile,
    selectedTile: state.selectedTile,
    tileset,
  });

  root.append(makePaintTitleRow(tileLayer));
  root.append(palette);
  return { root, palette };
}

function makePropsTabBody(input: {
  readonly mapId: string;
  readonly selectedTile: number;
  readonly state: ReturnType<typeof editorState.get>;
  readonly tileset: TilesetDef;
}): HTMLElement {
  const { mapId, selectedTile, state, tileset } = input;
  const root = el("div", {
    class: "palette-work-pane is-props",
    dataset: { testid: "palette-work-pane-props" },
  });
  if (selectedTile < 0) {
    root.append(el("div", { class: "empty-hint", text: "타일을 선택하세요. (칠하기·찾기 탭)" }));
    return root;
  }
  root.append(
    makeTileBrushAssistPanel({
      activeStampId: state.activeStampId,
      autoConnectMode: state.autoConnectMode,
      mapId,
      onSelectTile: selectPaletteTile,
      rerender: renderPalettePreservingViewport,
      selectedTile,
      tileset,
    })
  );
  root.append(renderTileMappingInspector(selectedTile, tileset));
  root.append(makeTerrainEditor(tileset.id, selectedTile, tileset.terrain[selectedTile] ?? 0));
  return root;
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
  const numberToggle = el("button", {
    class: "btn tile-number-toggle" + (showQuickTileNumbers ? " active" : ""),
    text: showQuickTileNumbers ? "# ON" : "#",
    attrs: {
      type: "button",
      title: "타일 번호 표시",
      "aria-pressed": String(showQuickTileNumbers),
    },
    dataset: { testid: "tile-number-toggle" },
    on: {
      click: () => {
        showQuickTileNumbers = !showQuickTileNumbers;
        renderPalettePreservingViewport();
      },
    },
  });
  const toolbar = el("div", { class: "quick-tile-toolbar" });
  toolbar.append(search, numberToggle);

  const grid = el("div", { class: "quick-tile-grid", dataset: { testid: "quick-tile-grid" } });
  const matches = quickTileIndexes(tileset).slice(0, 96);
  for (const index of matches) {
    // 빠른 선택은 검색 편의상 전 레이어를 보여 주되, 다른 레이어 타일은 흐리게 표시한다.
    grid.append(makeQuickTileCell(tileset, index, selectedTile === index, tileVisibleOnLayer(tileset, index, layer)));
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

function makePaintTitleRow(layer: Exclude<Layer, "event">): HTMLElement {
  return el("div", {
    class: "tile-palette-title-row",
    children: [
      el("h3", {
        class: "tile-palette-title",
        text: layer === "upper" ? "타일 · 상위" : "타일 · 하위",
      }),
    ],
  });
}


function readWorkTab(): PaletteWorkTab {
  const stored = readPaletteStorage(PALETTE_WORK_TAB_KEY);
  if (stored === "paint" || stored === "find" || stored === "props") return stored;
  // 구 advanced=1 이면 찾기 탭으로 승격
  if (readPaletteStorage(PALETTE_ADVANCED_STORAGE_KEY) === "1") return "find";
  return "paint";
}

function readPaletteStorage(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

function writePaletteStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value);
}

// combined_town 전용 정적 테이블(describeChipsetTile)을 다른 칩셋에 쓰면 오답 —
// 비기본 칩셋(실내 등)은 프로젝트 tileMeta 라벨을 쓴다. (2026-07-12 라벨 통일 라운드)
function quickTileName(tileset: TilesetDef, index: number): string {
  if (isDefaultTilesetTexture(tileset)) return tileDisplayLabelForIndex(index);
  return tileset.tileMeta?.[index]?.label?.trim() || `타일 ${index}`;
}

function quickTileIndexes(tileset: TilesetDef): readonly number[] {
  const normalizedQuery = tileSearchQuery.trim().toLowerCase();
  const source =
    activeTileCategory === "recent"
      ? recentTiles.filter((index) => index < tileset.count)
      : Array.from({ length: tileset.count }, (_, index) => index);
  const combined = isDefaultTilesetTexture(tileset);
  return source.filter((index) => {
    if (combined) {
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
    }
    const meta = tileset.tileMeta?.[index];
    const tags = meta?.tags ?? (meta?.role ? [meta.role] : []);
    if (!matchesCategory(activeTileCategory, tags, meta?.role ?? "", tileset.priority[index] ?? "lower")) return false;
    if (normalizedQuery.length === 0) return true;
    return [String(index), meta?.label ?? "", meta?.description ?? "", meta?.role ?? "", tags.join(" ")]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
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

function makeQuickTileCell(tileset: TilesetDef, index: number, active: boolean, currentLayer: boolean): HTMLButtonElement {
  const name = isDefaultTilesetTexture(tileset)
    ? `${tileDisplayLabelForIndex(index)} / AI: ${tileAiLabelForIndex(index)}`
    : quickTileName(tileset, index);
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
    let nextLayer = state.layer;
    if (tileset && state.layer !== "event") {
      const home = tileLayerHome(tileset, index);
      if (home !== "both" && home !== state.layer) nextLayer = home;
    }
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
    if (nextLayer !== state.layer) {
      toast(
        nextLayer === "upper" ? "상위 레이어 타일 — 상위 레이어 편집으로 전환" : "하위 레이어 타일 — 하위 레이어 편집으로 전환",
        "ok"
      );
    }
  });
}


/**
 * 맵에서 스포이트한 타일을 전문가 모드 팔레트 칩셋 시트로 스크롤·하이라이트.
 * 하위/상위 레이어는 editorState.layer 를 이미 맞춘 뒤 호출한다.
 * 기본 모드에서는 무시(레일만 노출).
 */
export function revealPaletteTileFromMap(tile: number): void {
  if (typeof document === "undefined") return;
  if (getEditorUiMode() !== "expert") return;
  if (tile < 0) return;
  // 칠하기 탭에서 셀이 보이도록
  activeWorkTab = "paint";
  writePaletteStorage(PALETTE_WORK_TAB_KEY, "paint");
  pendingRevealSelectedTile = true;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (root) renderTilePalette(root);
  else {
    window.requestAnimationFrame(() => {
      const r = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
      if (r) renderTilePalette(r);
    });
  }
}

function revealChipsetTileInPalette(tile: number): void {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (!root) return;
  // 숨겨진 오토타일 변형(예: 흙길 몸통 421)은 대표 칸(360)으로 매핑해 하이라이트한다.
  const tileset = currentTilesetForPalette();
  const displayTile = tileset ? rm2kPaletteDisplayTile(tileset, tile) : tile;
  const cell =
    root.querySelector<HTMLElement>('[data-testid="chipset-tile-' + displayTile + '"]') ??
    root.querySelector<HTMLElement>('[data-testid="chipset-tile-' + tile + '"]') ??
    root.querySelector<HTMLElement>('[data-testid="quick-tile-' + tile + '"]');
  if (!cell) return;
  cell.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "smooth" });
  cell.classList.add("is-map-reveal");
  window.setTimeout(() => cell.classList.remove("is-map-reveal"), 1400);
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
  // 구 클러스터 팔레트(tile-palette-clusters)는 RM2K 팔레트로 대체·삭제됨 (2026-07-17).
  return container.querySelector<HTMLElement>('[data-testid="tile-palette"]');
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

