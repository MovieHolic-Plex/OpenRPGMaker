import type { TileLayer } from "@/editor/tileActions";
import { analyzeTilesetSelection, type TilesetAiPatternBlock } from "@/editor/panels/tilesetAiMappingRules";
import { renderTempMapImage } from "@/editor/panels/tilesetAiTempMapImage";
import { resolveTilesetTileContext } from "@/editor/panels/tilesetTileContext";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { GameMap, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type TempTool = "erase" | "fill" | "paint" | "stamp";

type TempMapEditorModel = {
  readonly tileset: TilesetDef;
  readonly selectedTiles: readonly number[];
  readonly onLayoutChange: (snapshot: TempMapSnapshot) => void;
};

export type TempMapSnapshot = {
  readonly imageDataUrl: string;
  readonly summary: string;
};

const TEMP_MAP_WIDTH = 16;
const TEMP_MAP_HEIGHT = 12;
const TEMP_CELL_SCALE = 2;

export function createTerrainExampleEditor(model: TempMapEditorModel): HTMLElement {
  const tempMap = createTempMap(model.tileset);
  const analysis = analyzeTilesetSelection({
    selectedTiles: model.selectedTiles,
    tilesPerRow: model.tileset.tilesPerRow,
  });
  const patternBlock = analysis.patternBlocks[0] ?? null;
  let activeTile = model.selectedTiles[0] ?? 0;
  let activeLayer: TileLayer = "lower";
  let activeTool: TempTool = patternBlock ? "stamp" : "paint";
  let isDraggingPaint = false;
  let showTileNumbers = false;

  const grid = el("div", {
    class: "tileset-ai-temp-map",
    attrs: { role: "grid", "aria-label": "AI 예시 맵 배치" },
  });
  const activeLine = el("div", { class: "tileset-ai-example-active-line" });
  const toolbar = renderTempToolbar({
    activeLayer,
    activeTool,
    hasPatternBlock: patternBlock !== null,
    onLayer: (layer) => {
      stopDragPaint();
      activeLayer = layer;
      rerender();
    },
    onTool: (tool) => {
      stopDragPaint();
      activeTool = tool;
      rerender();
    },
    onToggleTileNumbers: () => {
      stopDragPaint();
      showTileNumbers = !showTileNumbers;
      rerender();
    },
    showTileNumbers,
  });

  const stopDragPaint = (): void => {
    isDraggingPaint = false;
  };

  const paintIndex = (index: number): void => {
    applyTempTool(tempMap, activeLayer, index, activeTile, activeTool, patternBlock);
    rerender();
  };

  const startDragPaint = (index: number, event: Event): void => {
    if (!isPrimaryPointer(event)) return;
    event.preventDefault();
    isDraggingPaint = true;
    window.addEventListener("pointerup", stopDragPaint, { once: true });
    window.addEventListener("pointercancel", stopDragPaint, { once: true });
    paintIndex(index);
  };

  const dragPaint = (index: number, event: Event): void => {
    const primaryButtonDown = isPrimaryButtonDown(event);
    if (!shouldApplyTempDragPaint(isDraggingPaint, activeTool, primaryButtonDown)) {
      if (!primaryButtonDown) stopDragPaint();
      return;
    }
    paintIndex(index);
  };

  function rerender(): void {
    grid.replaceChildren(
      ...Array.from({ length: tempMap.width * tempMap.height }, (_, index) =>
        renderMapCell(model.tileset, tempMap, index, {
          showTileNumbers,
          onClick: () => paintIndex(index),
          onPointerDown: (event) => startDragPaint(index, event),
          onPointerEnter: (event) => dragPaint(index, event),
        }),
      ),
    );
    syncTempToolbar(toolbar, activeLayer, activeTool, showTileNumbers);
    activeLine.textContent = activeStatusText(model.tileset, activeLayer, activeTool, activeTile, patternBlock);
    const summary = tempMapSummary(tempMap);
    model.onLayoutChange({ imageDataUrl: "", summary });
    void renderTempMapImage(tempMap, model.tileset)
      .then((imageDataUrl) => {
        model.onLayoutChange({ imageDataUrl, summary });
      })
      .catch(() => {
        model.onLayoutChange({ imageDataUrl: "", summary });
      });
  }

  rerender();

  return el("section", {
    class: "tileset-ai-example",
    children: [
      el("div", { class: "tileset-ai-example-title", text: "예시 맵에 직접 배치" }),
      toolbar,
      grid,
      el("div", {
        class: "tileset-ai-example-strip",
        children: model.selectedTiles.map((tile) =>
          renderPaletteTile(model.tileset, tile, {
            isActive: tile === activeTile,
            onPick: () => {
              stopDragPaint();
              activeTile = tile;
              if (activeTool === "stamp") activeTool = "paint";
              rerender();
            },
          }),
        ),
      }),
      activeLine,
    ],
  });
}

function createTempMap(tileset: TilesetDef): GameMap {
  return {
    id: "ai-temp-map",
    name: "AI 예시 맵",
    width: TEMP_MAP_WIDTH,
    height: TEMP_MAP_HEIGHT,
    tilesetId: tileset.id,
    tileSize: tileset.tileSize,
    lowerTiles: Array.from({ length: TEMP_MAP_WIDTH * TEMP_MAP_HEIGHT }, () => -1),
    upperTiles: Array.from({ length: TEMP_MAP_WIDTH * TEMP_MAP_HEIGHT }, () => -1),
    events: [],
  };
}

function renderTempToolbar(model: {
  readonly activeLayer: TileLayer;
  readonly activeTool: TempTool;
  readonly hasPatternBlock: boolean;
  readonly onLayer: (layer: TileLayer) => void;
  readonly onTool: (tool: TempTool) => void;
  readonly onToggleTileNumbers: () => void;
  readonly showTileNumbers: boolean;
}): HTMLElement {
  return el("div", {
    class: "tileset-ai-temp-toolbar",
    children: [
      renderModeButton("layer-lower", "하위", model.activeLayer === "lower", () => model.onLayer("lower")),
      renderModeButton("layer-upper", "상위", model.activeLayer === "upper", () => model.onLayer("upper")),
      ...(model.hasPatternBlock ? [renderModeButton("tool-stamp", "패턴", model.activeTool === "stamp", () => model.onTool("stamp"))] : []),
      renderModeButton("tool-paint", "칠하기", model.activeTool === "paint", () => model.onTool("paint")),
      renderModeButton("tool-erase", "지우기", model.activeTool === "erase", () => model.onTool("erase")),
      renderModeButton("tool-fill", "채우기", model.activeTool === "fill", () => model.onTool("fill")),
      renderModeButton("view-numbers", "번호", model.showTileNumbers, model.onToggleTileNumbers),
    ],
  });
}

function renderModeButton(stateKey: string, text: string, active: boolean, onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: active ? "active" : "",
    text,
    attrs: { type: "button", "aria-pressed": active ? "true" : "false" },
    dataset: { stateKey },
    on: { click: onClick },
  });
}

function syncTempToolbar(toolbar: HTMLElement, activeLayer: TileLayer, activeTool: TempTool, showTileNumbers: boolean): void {
  setToolbarButtonState(toolbar, "layer-lower", activeLayer === "lower");
  setToolbarButtonState(toolbar, "layer-upper", activeLayer === "upper");
  setToolbarButtonState(toolbar, "tool-stamp", activeTool === "stamp");
  setToolbarButtonState(toolbar, "tool-paint", activeTool === "paint");
  setToolbarButtonState(toolbar, "tool-erase", activeTool === "erase");
  setToolbarButtonState(toolbar, "tool-fill", activeTool === "fill");
  setToolbarButtonState(toolbar, "view-numbers", showTileNumbers);
}

function setToolbarButtonState(toolbar: HTMLElement, stateKey: string, active: boolean): void {
  const button = toolbar.querySelector(`[data-state-key="${stateKey}"]`);
  if (!(button instanceof HTMLButtonElement)) return;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

function renderMapCell(
  tileset: TilesetDef,
  map: GameMap,
  index: number,
  model: {
    readonly showTileNumbers: boolean;
    readonly onClick: () => void;
    readonly onPointerDown: (event: Event) => void;
    readonly onPointerEnter: (event: Event) => void;
  },
): HTMLElement {
  const lower = map.lowerTiles[index] ?? -1;
  const upper = map.upperTiles[index] ?? -1;
  const isPainted = lower >= 0 || upper >= 0;
  return el("button", {
    class: [
      "tileset-ai-temp-cell",
      upper >= 0 ? "has-upper" : "",
      isPainted ? "painted" : "",
    ]
      .filter(Boolean)
      .join(" "),
    attrs: { type: "button", "aria-label": `${index + 1}번 예시 맵 칸` },
    dataset: { testid: `tileset-ai-temp-cell-${index}` },
    on: {
      click: model.onClick,
      pointerdown: model.onPointerDown,
      pointerenter: model.onPointerEnter,
    },
    children: [
      ...(lower >= 0 ? [renderTileLayer(tileset, lower, "lower")] : []),
      ...(upper >= 0 ? [renderTileLayer(tileset, upper, "upper")] : []),
      ...(model.showTileNumbers && isPainted ? [renderTileNumberLabel(lower, upper)] : []),
    ],
  });
}

function renderTileNumberLabel(lower: number, upper: number): HTMLElement {
  const text = upper >= 0 && lower >= 0 ? `${lower}/${upper}` : `${upper >= 0 ? upper : lower}`;
  return el("span", { class: "tileset-ai-temp-number", text });
}

function renderTileLayer(tileset: TilesetDef, tile: number, layer: TileLayer): HTMLElement {
  return el("span", {
    class: `tileset-ai-temp-tile ${layer}`,
    attrs: { style: tileBackgroundStyle(tileset, tile, tileset.tileSize * TEMP_CELL_SCALE) },
  });
}

function renderPaletteTile(
  tileset: TilesetDef,
  tile: number,
  model: { readonly isActive: boolean; readonly onPick: () => void },
): HTMLElement {
  const description = resolveTilesetTileContext(tileset, tile);
  return el("button", {
    class: `tileset-ai-example-swatch-button${model.isActive ? " active" : ""}`,
    attrs: { type: "button", title: `Tile ${tile}: ${description.currentLabel}` },
    on: { click: model.onPick },
    children: [renderTilePreview(tileset, tile, 2)],
  });
}

function renderTilePreview(tileset: TilesetDef, tile: number, scale: number): HTMLElement {
  const previewSize = tileset.tileSize * scale;
  return el("span", {
    class: "tileset-ai-example-swatch",
    attrs: {
      style: [
        `width:${previewSize}px`,
        `height:${previewSize}px`,
        tileBackgroundStyle(tileset, tile, previewSize),
      ].join(";"),
    },
  });
}

function applyTempTool(
  map: GameMap,
  layer: TileLayer,
  index: number,
  tile: number,
  tool: TempTool,
  patternBlock: TilesetAiPatternBlock | null,
): void {
  const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
  if (tool === "erase") {
    tiles[index] = -1;
    return;
  }
  if (tool === "fill") {
    fillTempLayer(map, layer, index, tile);
    return;
  }
  if (tool === "stamp" && patternBlock) {
    stampPatternBlock(map, layer, index, patternBlock);
    return;
  }
  tiles[index] = tile;
}

function stampPatternBlock(map: GameMap, layer: TileLayer, startIndex: number, patternBlock: TilesetAiPatternBlock): void {
  const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
  const startX = startIndex % map.width;
  const startY = Math.floor(startIndex / map.width);
  for (let y = 0; y < patternBlock.sourceRect.height; y += 1) {
    for (let x = 0; x < patternBlock.sourceRect.width; x += 1) {
      const targetX = startX + x;
      const targetY = startY + y;
      if (targetX >= map.width || targetY >= map.height) continue;
      const tile = patternBlock.tileIds[y * patternBlock.sourceRect.width + x];
      if (tile === undefined) continue;
      tiles[targetY * map.width + targetX] = tile;
    }
  }
}

function fillTempLayer(map: GameMap, layer: TileLayer, startIndex: number, tile: number): void {
  const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
  const target = tiles[startIndex] ?? -1;
  if (target === tile) return;
  const queue = [startIndex];
  const seen = new Set<number>([startIndex]);
  while (queue.length > 0) {
    const index = queue.shift();
    if (index === undefined) break;
    tiles[index] = tile;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const next of neighborIndexes(map, x, y)) {
      if (seen.has(next) || tiles[next] !== target) continue;
      seen.add(next);
      queue.push(next);
    }
  }
}

function neighborIndexes(map: GameMap, x: number, y: number): readonly number[] {
  const points = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ];
  return points
    .filter((point) => point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height)
    .map((point) => point.y * map.width + point.x);
}

function tempMapSummary(map: GameMap): string {
  return JSON.stringify({
    kind: "temporary_map_example",
    version: 1,
    map: {
      width: map.width,
      height: map.height,
      tilesetId: map.tilesetId,
      lowerTiles: map.lowerTiles,
      upperTiles: map.upperTiles,
    },
  });
}

function tileBackgroundStyle(tileset: TilesetDef, tile: number, previewSize: number): string {
  return tilesetTileBackgroundStyle(tileset, tile, previewSize);
}

function activeStatusText(
  tileset: TilesetDef,
  layer: TileLayer,
  tool: TempTool,
  tile: number,
  patternBlock: TilesetAiPatternBlock | null,
): string {
  const layerText = layer === "lower" ? "하위" : "상위";
  if (tool === "stamp" && patternBlock) {
    return `현재 도구 · ${layerText} 레이어 · 패턴 찍기 · 감지 블록 ${patternBlock.sourceRect.width}x${patternBlock.sourceRect.height}`;
  }
  const toolText = tool === "paint" ? "칠하기" : tool === "erase" ? "지우기" : "채우기";
  const context = resolveTilesetTileContext(tileset, tile);
  return `현재 도구 · ${layerText} 레이어 · ${toolText} · 기존 메타: ${tile}번 ${context.currentLabel}`;
}

function isPrimaryPointer(event: Event): boolean {
  if (!isPointerEvent(event)) return true;
  return event.button === 0;
}

function isPrimaryButtonDown(event: Event): boolean {
  if (!isPointerEvent(event)) return true;
  return (event.buttons & 1) === 1;
}

function isPointerEvent(event: Event): event is PointerEvent {
  return typeof PointerEvent !== "undefined" && event instanceof PointerEvent;
}

export function shouldApplyTempDragPaint(isDragging: boolean, tool: TempTool, primaryButtonDown: boolean): boolean {
  return isDragging && tool !== "stamp" && primaryButtonDown;
}
