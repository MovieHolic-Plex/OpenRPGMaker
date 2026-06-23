import { el, clearChildren } from "@/util/dom";
import { EDITOR_BRUSH_SIZES, editorState } from "@/editor/editorState";
import type { EditorBrushSize, Tool, Layer } from "@/editor/editorState";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { copySelection, pasteClipboard } from "@/editor/mapClipboard";
import { setTerrainTag } from "@/editor/tilesetActions";
import { setMapTileset } from "@/editor/actions";
import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { renderTileMappingInspector } from "@/editor/panels/tileMappingInspector";
import { describeChipsetTile, tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";

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
const CHIPSET_BANDS = [
  { id: "a1", icon: "terrain", label: "지형", row: 0, title: "풀, 흙, 절벽, 기본 바닥 타일" },
  { id: "a2", icon: "water-road", label: "물·길", row: 4, title: "물 애니메이션, 호수 외곽, 흙길과 길 모서리" },
  { id: "a3", icon: "building", label: "건물", row: 8, title: "지붕, 벽, 문, 집 구성 타일" },
  { id: "b", icon: "props", label: "소품", row: 12, title: "울타리, 나무, 표지판, 장식 오브젝트" },
] as const;

type ChipsetBandId = (typeof CHIPSET_BANDS)[number]["id"];

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
let activeChipsetBand: ChipsetBandId = "a1";
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
        on: { click: () => editorState.set({ tool: t.id }) },
      })
    );
  }
  toolSection.append(toolGrid);
  toolSection.append(makeBrushControls(state.brushSize, state.layer === "event"));
  toolSection.append(makeTileToolStatus(state.selectedTile, state.brushSize));
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
  tileSection.append(el("h3", { text: "칩셋" }));

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

  const palette = makeChipsetSheet(state.selectedTile, state.layer, tileset, activeChipsetBand);
  tileSection.append(makeMapTilesetPicker(map.id, map.tilesetId, Object.values(project.tilesets)));
  tileSection.append(makePaletteOptions());
  if (advancedTileToolsExpanded) {
    tileSection.append(makeQuickTilePicker(state.selectedTile, state.layer, tileset));
  }
  tileSection.append(makeChipsetBandNav());
  tileSection.append(palette);
  if (advancedTileToolsExpanded && state.selectedTile >= 0) {
    tileSection.append(makeTerrainEditor(tileset.id, state.selectedTile, tileset.terrain[state.selectedTile] ?? 0));
    tileSection.append(renderTileMappingInspector(state.selectedTile));
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

function makePaletteOptions(): HTMLElement {
  const row = el("div", { class: "palette-option-row" });
  row.append(
    el("button", {
      class: "btn palette-option-button" + (advancedTileToolsExpanded ? " active" : ""),
      children: [
        el("span", { class: "tile-palette-icon tile-palette-icon-advanced", attrs: { "aria-hidden": "true" } }),
      ],
      attrs: {
        title: advancedTileToolsExpanded ? "고급 타일 도구 닫기" : "고급 타일 도구 열기",
        "aria-label": advancedTileToolsExpanded ? "고급 타일 도구 닫기" : "고급 타일 도구 열기",
        "aria-expanded": String(advancedTileToolsExpanded),
        "aria-controls": "quick-tile-picker",
      },
      dataset: { testid: "quick-tile-toggle" },
      on: {
        click: () => {
          advancedTileToolsExpanded = !advancedTileToolsExpanded;
          renderPalettePreservingViewport();
        },
      },
    })
  );
  row.append(
    el("button", {
      class: "btn palette-option-button" + (showQuickTileNumbers ? " active" : ""),
      text: showQuickTileNumbers ? "# on" : "#",
      attrs: {
        title: "타일 번호 표시",
        "aria-label": "타일 번호 표시",
        "aria-pressed": String(showQuickTileNumbers),
      },
      dataset: { testid: "tile-number-toggle" },
      on: {
        click: () => {
          showQuickTileNumbers = !showQuickTileNumbers;
          renderPalettePreservingViewport();
        },
      },
    })
  );
  return row;
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
    const tileLayer = tileset.priority[index] ?? "lower";
    grid.append(makeQuickTileCell(index, selectedTile === index, tileLayer === layer, tileLayer));
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
  currentLayer: boolean,
  tileLayer: Exclude<Layer, "event">
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
        selectTile(index, tileLayer);
      },
    },
  });
}

function selectTile(index: number, tileLayer: Exclude<Layer, "event">): void {
  preservePaletteViewport(() => {
    const existingIndex = recentTiles.indexOf(index);
    if (existingIndex >= 0) recentTiles.splice(existingIndex, 1);
    recentTiles.unshift(index);
    if (recentTiles.length > 18) recentTiles.length = 18;
    editorState.set({ layer: tileLayer, selectedTile: index, tool: "paint" });
  });
}

function preservePaletteViewport(action: () => void): void {
  const container = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  const palette = container?.querySelector<HTMLElement>('[data-testid="tile-palette"]') ?? null;
  const scroll = container ? readPaletteScroll(container) : null;
  const windowScroll = { x: window.scrollX, y: window.scrollY };
  action();
  const restore = (): void => {
    const nextContainer = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
    const nextPalette = nextContainer?.querySelector<HTMLElement>('[data-testid="tile-palette"]') ?? null;
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
  const palette = container.querySelector<HTMLElement>('[data-testid="tile-palette"]');
  return {
    containerLeft: container.scrollLeft,
    containerTop: container.scrollTop,
    sheetLeft: palette?.scrollLeft ?? 0,
    sheetTop: palette?.scrollTop ?? 0,
  };
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

function makeChipsetBandNav(): HTMLElement {
  const row = el("div", { class: "chipset-band-nav" });
  for (const band of CHIPSET_BANDS) {
    row.append(
      el("button", {
        class: "btn chipset-band-button" + (activeChipsetBand === band.id ? " active" : ""),
        children: [
          el("span", { class: `tile-palette-icon tile-palette-icon-${band.icon}`, attrs: { "aria-hidden": "true" } }),
        ],
        attrs: { title: `${band.label}: ${band.title}`, "aria-label": band.label, "aria-pressed": String(activeChipsetBand === band.id) },
        dataset: { testid: `chipset-band-${band.id}` },
        on: {
          click: () => {
            activeChipsetBand = band.id;
            resetChipsetScroll = true;
            renderPalettePreservingViewport();
          },
        },
      })
    );
  }
  return row;
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

function makeBrushControls(activeSize: EditorBrushSize, disabled: boolean): HTMLElement {
  const group = el("div", { class: "brush-control", dataset: { testid: "brush-size-control" } });
  group.append(el("span", { class: "brush-control-label", text: "브러시" }));
  for (const size of EDITOR_BRUSH_SIZES) {
    const button = el("button", {
      class: "btn brush-size-btn" + (activeSize === size ? " active" : ""),
      text: `${size}x${size}`,
      attrs: { title: `커서 주변 ${size}x${size} 타일을 칠합니다`, "aria-pressed": String(activeSize === size) },
      dataset: { testid: `brush-size-${size}` },
      on: { click: () => editorState.set({ brushSize: size }) },
    });
    button.disabled = disabled;
    group.append(button);
  }
  return group;
}

function makeTileToolStatus(selectedTile: number, brushSize: EditorBrushSize): HTMLElement {
  const status = el("div", { class: "tile-tool-status", dataset: { testid: "tile-tool-status" } });
  status.append(makeSelectedTilePreview(selectedTile));
  const grid = el("div", { class: "tile-tool-status-grid" });
  grid.append(makeStatusCell("타일", selectedTileLabel(selectedTile), "selected-tile-status"));
  grid.append(makeStatusCell("브러시", `${brushSize}x${brushSize}`, "brush-size-status"));
  grid.append(makeStatusCell("XY", "-", "cursor-position"));
  grid.append(makeStatusCell("하층", "-", "cursor-lower"));
  grid.append(makeStatusCell("상층", "-", "cursor-upper"));
  grid.append(makeStatusCell("이동", "드래그 / Space", "map-move-hint"));
  status.append(grid);
  return status;
}

function makeSelectedTilePreview(selectedTile: number): HTMLElement {
  const preview = el("div", {
    class: "selected-tile-preview",
    attrs: {
      title: selectedTileLabel(selectedTile),
      style: selectedTilePreviewStyle(selectedTile),
    },
    dataset: { testid: "selected-tile-preview" },
  });
  return preview;
}

function selectedTilePreviewStyle(selectedTile: number): string {
  if (selectedTile < 0) return "";
  const tileset = currentTilesetForPalette();
  if (!tileset || selectedTile >= tileset.count) return "";
  return tilePreviewStyle(selectedTile, CHIPSET_CELL_SIZE);
}

function tilePreviewStyle(selectedTile: number, previewSize: number | string): string {
  if (selectedTile < 0) return "";
  const tileset = currentTilesetForPalette();
  if (!tileset || selectedTile >= tileset.count) return "";
  return tilesetTileBackgroundStyle(tileset, selectedTile, previewSize);
}

function selectedTileLabel(selectedTile: number): string {
  if (selectedTile < 0) return "없음";
  return tileDisplayLabelForIndex(selectedTile);
}

function makeStatusCell(label: string, value: string, testId: string): HTMLElement {
  return el("div", {
    class: "tile-tool-status-cell",
    children: [
      el("span", { class: "tile-tool-status-label", text: label }),
      el("span", { class: "tile-tool-status-value", text: value, dataset: { testid: testId } }),
    ],
  });
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

function makeMapTilesetPicker(
  mapId: string,
  selectedTilesetId: string,
  tilesets: readonly TilesetDef[]
): HTMLElement {
  const select = el("select", {
    attrs: { "aria-label": "맵 칩셋" },
    dataset: { testid: "map-tileset-select" },
    on: {
      change: (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        setMapTileset(mapId, target.value);
      },
    },
  });
  for (const tileset of tilesets) {
    select.append(el("option", {
      text: tileset.name,
      value: tileset.id,
      attrs: { value: tileset.id },
    }));
  }
  select.value = selectedTilesetId;
  return el("div", {
    class: "field compact-field",
    children: [
      el("label", { text: "맵 칩셋" }),
      select,
    ],
  });
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
  activeBand: ChipsetBandId
): HTMLElement {
  const rows = Math.ceil(tileset.count / tileset.tilesPerRow);
  const tileIndexes = chipsetBandTileIndexes(activeBand, tileset);
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
  for (const index of tileIndexes) {
    const tileLayer = tileset.priority[index] ?? "lower";
    overlay.append(makeChipsetCell(index, selectedTile === index, tileLayer === layer, tileLayer));
  }
  sheet.append(overlay);
  return sheet;
}

function chipsetBandTileIndexes(bandId: ChipsetBandId, tileset: TilesetDef): readonly number[] {
  return Array.from({ length: tileset.count }, (_, index) => index).filter((index) => {
    const tile = describeChipsetTile(index);
    const layer = tileset.priority[index] ?? "lower";
    if (bandId === "a1") return matchesChipsetTerrain(tile.tags, tile.usage, layer);
    if (bandId === "a2") return matchesChipsetWaterOrRoad(tile.tags);
    if (bandId === "a3") return matchesChipsetBuilding(tile.tags);
    return matchesChipsetProp(tile.tags, tile.usage, layer);
  });
}

function matchesChipsetTerrain(tags: readonly string[], usage: string, layer: "lower" | "upper"): boolean {
  if (layer !== "lower") return false;
  if (tags.some((tag) => ["water", "lake", "shore", "path", "road", "house", "building", "roof", "wall"].includes(tag))) {
    return false;
  }
  return ["terrain", "edge", "detail"].includes(usage);
}

function matchesChipsetWaterOrRoad(tags: readonly string[]): boolean {
  return tags.some((tag) => ["water", "lake", "shore", "waterfall", "path", "road", "dirt"].includes(tag));
}

function matchesChipsetBuilding(tags: readonly string[]): boolean {
  return tags.some((tag) => ["house", "building", "roof", "wall", "door", "castle"].includes(tag));
}

function matchesChipsetProp(tags: readonly string[], usage: string, layer: "lower" | "upper"): boolean {
  if (matchesChipsetWaterOrRoad(tags) || matchesChipsetBuilding(tags)) return false;
  if (tags.includes("fence") || tags.includes("tree") || tags.includes("prop") || tags.includes("sign")) return true;
  return usage === "decoration" || layer === "upper";
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

function makeChipsetCell(
  index: number,
  active: boolean,
  currentLayer: boolean,
  tileLayer: Exclude<Layer, "event">
): HTMLButtonElement {
  const name = `${tileDisplayLabelForIndex(index)} / AI: ${tileAiLabelForIndex(index)}`;
  const cell = el("button", {
    class: "chipset-tile" + (active ? " active" : "") + (currentLayer ? "" : " muted"),
    attrs: {
      title: name,
      "aria-label": name,
      style: tilePreviewStyle(index, CHIPSET_SHEET_CELL_SIZE),
    },
    dataset: { testid: `chipset-tile-${index}` },
    on: {
      pointerdown: (event) => event.preventDefault(),
      click: () => selectTile(index, tileLayer),
    },
  });
  return cell;
}
