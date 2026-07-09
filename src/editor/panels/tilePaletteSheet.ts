import { TILE_SIZE } from "@/assets/bundled";
import type { Layer } from "@/editor/editorState";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { normalizeSheetRect, tileIdsInRect as tileIdsInSheetRect, type SheetRangeRect } from "@/editor/panels/tilePaletteGeometry";
import { createPaletteStampFromDrag, paletteStampIncludesTile, type PaletteStamp } from "@/editor/tilePaletteStamp";
import { tileVisibleOnLayer } from "@/editor/tileLayerClassification";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileAiLabelForIndex, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const CHIPSET_CELL_SIZE = TILE_SIZE * 2;
const CHIPSET_SHEET_CELL_SIZE = "var(--chipset-cell)";
const RANGE_DRAG_THRESHOLD_PX = 4;
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

type SheetRangeSelection = {
  readonly rect: SheetRangeRect;
  readonly tileIds: readonly number[];
};

type SheetRangeDrag = {
  readonly active: boolean;
  readonly currentTile: number;
  // 기본 드래그 = 멀티타일 스탬프(칠하기 의도), Shift+드래그 = AI 범위 분류.
  // 과거엔 모든 드래그가 분류에 흡수되어 스탬프가 마우스로 도달 불가한 죽은 기능이었다(UX 리뷰 버그 1).
  readonly mode: "stamp" | "classify";
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

type MakeChipsetSheetArgs = {
  readonly activePaletteStamp: PaletteStamp | null;
  readonly layer: Exclude<Layer, "event">;
  readonly onCreatePaletteStamp: (stamp: PaletteStamp) => void;
  readonly onSelectTile: (index: number) => void;
  readonly selectedTile: number;
  readonly tileset: TilesetDef;
};

let paletteDragStartTile: number | null = null;
let sheetRangeDrag: SheetRangeDrag | null = null;

export function makeChipsetSheet(args: MakeChipsetSheetArgs): HTMLElement {
  const rows = Math.ceil(args.tileset.count / args.tileset.tilesPerRow);
  // RM2K3식 엄격 분류: 현재 편집 레이어에 속한 타일만 시트에 노출한다.
  const tileIndexes = displayPaletteTileIndexes(args.tileset)
    .filter((index) => tileVisibleOnLayer(args.tileset, index, args.layer));
  const classifiedTileIds = classifiedTiles(args.tileset);
  const sheet = el("div", {
    class: "chipset-sheet tile-palette chipset-sheet-filtered",
    dataset: { testid: "tile-palette" },
    attrs: {
      style: [
        `--chipset-cols:${args.tileset.tilesPerRow}`,
        `--chipset-rows:${rows}`,
        `--chipset-cell:${CHIPSET_CELL_SIZE}px`,
        `--chipset-width:${args.tileset.tilesPerRow * CHIPSET_CELL_SIZE}px`,
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
      active: args.selectedTile === index,
      classified: classifiedTileIds.has(index),
      currentLayer: true,
      inPaletteStamp: paletteStampIncludesTile(args.activePaletteStamp, index, args.tileset.tilesPerRow),
      index,
      onCreatePaletteStamp: args.onCreatePaletteStamp,
      onSelectTile: args.onSelectTile,
      tileset: args.tileset,
    });
    cells.set(index, cell);
    overlay.append(cell);
  }
  sheet.append(overlay);
  installSheetRangeSelection({
    cells,
    layer: args.layer,
    onCreatePaletteStamp: args.onCreatePaletteStamp,
    overlay,
    sheet,
    tileset: args.tileset,
  });
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
  readonly onCreatePaletteStamp: (stamp: PaletteStamp) => void;
  readonly onSelectTile: (index: number) => void;
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
      style: tilesetTileBackgroundStyle(model.tileset, index, CHIPSET_SHEET_CELL_SIZE),
    },
    dataset: { testid: `chipset-tile-${index}`, tileIndex: String(index) },
    on: {
      pointercancel: () => {
        paletteDragStartTile = null;
      },
      pointerdown: (event) => startPaletteStampDrag(index, event),
      pointerup: (event) =>
        finishPaletteStampDrag(index, model.tileset, model.onCreatePaletteStamp, model.onSelectTile, event),
      // 단일 선택도 pointerup(finishPaletteStampDrag)에서 처리한다 — click은 down~up 사이에
      // 패널이 재구축되면 증발하지만 pointerup은 커서 아래의 새 노드에서 발화한다.
      click: (event) => {
        event.preventDefault();
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
  readonly onCreatePaletteStamp: (stamp: PaletteStamp) => void;
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
      mode: "shiftKey" in event && event.shiftKey === true ? "classify" : "stamp",
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
    if (drag.mode === "stamp") {
      // 기본 드래그 = 멀티타일 스탬프. 지붕 3줄 같은 세트를 한 번에 집어 칠한다.
      paintRangeCells(args.cells, []);
      args.onCreatePaletteStamp(createPaletteStampFromDrag({ endTile: currentTile, startTile: drag.startTile, tileset: args.tileset }));
      event.preventDefault();
      return;
    }
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
    tileIds: tileIdsInSheetRect(
      rect,
      tileset.count,
      tileset.tilesPerRow,
      (tileId) => tileVisibleOnLayer(tileset, tileId, layer)
    ),
  };
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
  event.preventDefault();
}

function finishPaletteStampDrag(
  index: number,
  tileset: TilesetDef,
  onCreatePaletteStamp: (stamp: PaletteStamp) => void,
  onSelectTile: (index: number) => void,
  event: Event
): void {
  if (!isPrimaryButtonEvent(event)) return;
  if (sheetRangeDrag?.active) {
    paletteDragStartTile = null;
    event.preventDefault();
    return;
  }
  const startTile = paletteDragStartTile;
  paletteDragStartTile = null;
  if (startTile === null) return;
  if (startTile === index) {
    // 같은 타일에서 down→up = 단일 선택. click 이벤트에 맡기지 않는다(재구축 시 증발).
    onSelectTile(index);
    event.preventDefault();
    return;
  }
  const stamp = createPaletteStampFromDrag({ endTile: index, startTile, tileset });
  onCreatePaletteStamp(stamp);
  event.preventDefault();
}

function isPrimaryButtonEvent(event: Event): boolean {
  if (!("button" in event)) return true;
  return typeof event.button === "number" && event.button === 0;
}
