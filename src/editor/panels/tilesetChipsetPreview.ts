import {
  extendAiSelectionDrag,
  handleAiTileClick,
  isAiTileSelected,
  startAiSelectionDrag,
  stopAiSelectionDrag,
} from "@/editor/panels/tilesetAiQuestionEditor";
import {
  extendGroupDrag,
  groupCellClass,
  groupCellText,
  handleGroupTileClick,
  startGroupDrag,
  stopGroupDrag,
} from "@/editor/panels/tilesetGroupEditor";
import { cellTitle, hasAiMetadata, passageText } from "@/editor/panels/tilesetMetadataControls";
import { openTilesetTileContextMenu } from "@/editor/panels/tilesetTileContextMenu";
import { modeHelpText, type TilesetEditMode } from "@/editor/panels/tilesetUsageGuide";
import { tileLayerHome, type TileLayerHome } from "@/editor/tileLayerClassification";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type ChipsetPreviewModel = {
  readonly tileset: TilesetDef;
  readonly mode: TilesetEditMode;
  readonly selectedTile: number;
  readonly rerender: () => void;
  readonly onApplyModeTile: (tile: number) => void;
  /** quiet: 스크롤 유지·리마운트 없이 selectedTile 만 갱신(우클릭 메뉴용). */
  readonly onSelectTile: (tile: number, options?: { readonly quiet?: boolean }) => void;
  /** Optional: open full-sheet passage modal from the preview chrome. */
  readonly onOpenFullSheet?: () => void;
};

type LayerFilter = "all" | "lower" | "upper";

/** 기본 2x — 한 화면에 더 많은 행. 전체 시트는 프리뷰 박스 안 스크롤. */
const PREVIEW_SCALES = [2, 3, 4] as const;
let previewScale: number = 2;
let layerFilter: LayerFilter = "all";
let previewPanState: PreviewPanState | null = null;

export function renderChipsetPreviewPanel(model: ChipsetPreviewModel): HTMLElement {
  return el("div", {
    class: "tileset-db-preview-wrap",
    dataset: { testid: "tileset-db-preview-wrap" },
    children: [renderPreviewHeader(model), renderChipsetPreview(model)],
  });
}

function renderPreviewHeader(model: ChipsetPreviewModel): HTMLElement {
  return el("div", {
    class: "tileset-db-preview-header",
    children: [
      el("div", {
        class: "tileset-db-preview-title-row",
        children: [
          el("div", { class: "tileset-db-preview-title", text: "칩셋 그래픽" }),
          el("div", {
            class: "tileset-db-layer-filter",
            attrs: { role: "tablist", "aria-label": "레이어 필터" },
            dataset: { testid: "tileset-layer-filter" },
            children: [
              renderLayerFilterButton({ filter: "all", text: "전체", title: "하위·상위 전부 표시", model }),
              renderLayerFilterButton({ filter: "lower", text: "하위", title: "하위 레이어 타일만 강조", model }),
              renderLayerFilterButton({ filter: "upper", text: "상위", title: "상위 레이어 타일만 강조", model }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "tileset-db-preview-scale",
        children: [
          ...PREVIEW_SCALES.map((scale) =>
            renderScaleButton({
              scale,
              text: `${scale}x`,
              title: scale === 2 ? "2배 (기본·한눈에)" : scale === 3 ? "3배" : "4배 (크게)",
              model,
            }),
          ),
          renderScrollButton({ axis: "x", direction: -1, text: "←", title: "왼쪽으로 이동" }),
          renderScrollButton({ axis: "x", direction: 1, text: "→", title: "오른쪽으로 이동" }),
          renderScrollButton({ axis: "y", direction: -1, text: "↑", title: "위로 이동" }),
          renderScrollButton({ axis: "y", direction: 1, text: "↓", title: "아래로 이동" }),
          ...(model.onOpenFullSheet
            ? [
                el("button", {
                  class: "tileset-db-fullsheet-btn",
                  text: "전체창",
                  attrs: { type: "button", title: "칩셋 전체를 별도 창에서 통행(O/X/★) 편집" },
                  dataset: { testid: "tileset-settings-open-header" },
                  on: { click: () => model.onOpenFullSheet?.() },
                }),
              ]
            : []),
        ],
      }),
    ],
  });
}

function renderLayerFilterButton(model: {
  readonly filter: LayerFilter;
  readonly text: string;
  readonly title: string;
  readonly model: ChipsetPreviewModel;
}): HTMLButtonElement {
  return el("button", {
    class: layerFilter === model.filter ? "active" : "",
    text: model.text,
    attrs: {
      type: "button",
      role: "tab",
      title: model.title,
      "aria-selected": String(layerFilter === model.filter),
    },
    dataset: { testid: `tileset-layer-filter-${model.filter}` },
    on: {
      click: () => {
        layerFilter = model.filter;
        stableRerender(model.model.rerender);
      },
    },
  });
}

function renderScaleButton(model: {
  readonly scale: number;
  readonly text: string;
  readonly title: string;
  readonly model: ChipsetPreviewModel;
}): HTMLButtonElement {
  return el("button", {
    class: previewScale === model.scale ? "active" : "",
    text: model.text,
    attrs: { type: "button", title: model.title },
    dataset: { testid: `tileset-preview-scale-${model.scale}` },
    on: {
      click: () => {
        previewScale = model.scale;
        stableRerender(model.model.rerender);
      },
    },
  });
}

function renderScrollButton(model: {
  readonly axis: "x" | "y";
  readonly direction: -1 | 1;
  readonly text: string;
  readonly title: string;
}): HTMLButtonElement {
  return el("button", {
    class: "scroll",
    text: model.text,
    attrs: { type: "button", title: model.title },
    on: {
      click: () => scrollChipsetPreview(model.axis, model.direction),
    },
  });
}

function renderChipsetPreview(model: ChipsetPreviewModel): HTMLElement {
  const previewCell = model.tileset.tileSize * previewScale;
  const previewWidth = model.tileset.tilesPerRow * previewCell;
  const rows = Math.ceil(model.tileset.count / model.tileset.tilesPerRow);
  const previewHeight = rows * previewCell;
  return el("div", {
    class: "tileset-db-preview",
    dataset: { testid: "tileset-db-preview", layerFilter },
    attrs: {
      style: [
        `--tileset-cols:${model.tileset.tilesPerRow}`,
        `--tileset-cell:${previewCell}px`,
        `--tileset-width:${previewWidth}px`,
        `--tileset-height:${previewHeight}px`,
      ].join(";"),
    },
    children: [
      el("img", {
        attrs: {
          src: tilesetImageUrl(model.tileset),
          alt: `${model.tileset.name} 칩셋 (${model.tileset.count}칸)`,
          width: String(previewWidth),
          height: String(previewHeight),
        },
      }),
      el("div", {
        class: "tileset-db-click-grid",
        children: Array.from({ length: model.tileset.count }, (_, index) => renderTileCell(model, index)),
      }),
      el("div", {
        class: "tileset-db-preview-meta",
        dataset: { testid: "tileset-db-preview-meta" },
        text: previewMetaText(model, rows),
      }),
    ],
    on: {
      auxclick: (event) => {
        if (event instanceof MouseEvent && event.button === 1) event.preventDefault();
      },
      mousedown: (event) => startPreviewPan(event),
    },
  });
}

function previewMetaText(model: ChipsetPreviewModel, rows: number): string {
  const filterLabel = layerFilter === "all" ? "전체 레이어" : layerFilter === "lower" ? "하위만" : "상위만";
  return `${model.tileset.count}칩 · ${model.tileset.tilesPerRow}열×${rows}행 · ${previewScale}x · ${filterLabel} · ${modeHelpText(model.mode)} · 스크롤: 휠·←→↑↓·중클릭 드래그 (전체 시트)`;
}

function renderTileCell(model: ChipsetPreviewModel, index: number): HTMLButtonElement {
  const mark = passageMarkForTile(model.tileset, index);
  const home = tileLayerHome(model.tileset, index);
  const selected = index === model.selectedTile ? " selected" : "";
  const aiSelected = model.mode === "ai" && isAiTileSelected(index) ? " ai-selected" : "";
  const dimmed = isLayerDimmed(home) ? " layer-dimmed" : "";
  const rerender = () => stableRerender(model.rerender);
  return el("button", {
    class: `tileset-db-cell mark-${mark} layer-${home}${selected}${aiSelected}${dimmed}${model.mode === "group" ? groupCellClass(index) : ""}`,
    text: cellText(model, index),
    attrs: {
      type: "button",
      title: `${cellTitle(model.tileset, index)} · ${layerHomeLabel(home)} · 우클릭: 의미/통행/레이어`,
      "aria-label": `타일 ${index} ${layerHomeLabel(home)}. 우클릭으로 의미 편집`,
    },
    dataset: {
      testid: `tileset-db-cell-${index}`,
      layer: home,
      tile: String(index),
    },
    on: {
      click: (event) => handleTileClick(model, index, event),
      contextmenu: (event) => handleTileContextMenu(model, index, event),
      pointerdown: (event) => handlePointerDown(model, index, event),
      mousedown: (event) => {
        // 우클릭(2)·중클릭(1)은 드래그/포커스 훔치기 금지 — 메뉴·팬만 담당.
        if (!(event instanceof MouseEvent) || event.button !== 0) return;
        event.preventDefault();
        if (model.mode === "ai") startAiSelectionDrag(index, event, rerender);
      },
      pointerenter: () => handlePointerEnter(model, index),
      mouseenter: () => {
        if (model.mode === "ai") {
          model.onSelectTile(index, { quiet: true });
          extendAiSelectionDrag(index);
        }
      },
      pointerup: () => {
        stopGroupDrag();
        stopAiSelectionDrag();
      },
      mouseup: stopAiSelectionDrag,
    },
  });
}

function isLayerDimmed(home: TileLayerHome): boolean {
  if (layerFilter === "all") return false;
  if (layerFilter === "lower") return home === "upper";
  return home === "lower";
}

function layerHomeLabel(home: TileLayerHome): string {
  if (home === "upper") return "상위 레이어";
  if (home === "lower") return "하위 레이어";
  return "양쪽 레이어";
}

function handleTileContextMenu(model: ChipsetPreviewModel, tile: number, event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  // 전체 패널 리마운트 금지 — 스크롤이 튀며 화면이 움직이는 원인.
  model.onSelectTile(tile, { quiet: true });
  // 선택 하이라이트만 DOM 에서 갱신 (리렌더 없이)
  paintSelectedCell(tile);
  const mouse = event instanceof MouseEvent ? event : null;
  openTilesetTileContextMenu({
    tilesetId: model.tileset.id,
    tile,
    clientX: mouse?.clientX ?? 0,
    clientY: mouse?.clientY ?? 0,
    rerender: () => stableRerender(model.rerender),
  });
}

function paintSelectedCell(tile: number): void {
  const root = document.querySelector(".tileset-db-click-grid");
  if (!root) return;
  for (const node of root.querySelectorAll(".tileset-db-cell.selected")) {
    node.classList.remove("selected");
  }
  const cell = root.querySelector(`[data-tile="${tile}"]`);
  cell?.classList.add("selected");
}

function handleTileClick(model: ChipsetPreviewModel, tile: number, event: Event): void {
  event.preventDefault();
  const rerender = () => stableRerender(model.rerender);
  if (model.mode === "group") {
    model.onSelectTile(tile, { quiet: true });
    handleGroupTileClick(tile, event, rerender);
    return;
  }
  if (model.mode === "ai") {
    model.onSelectTile(tile, { quiet: true });
    handleAiTileClick(tile, event, rerender);
    return;
  }
  if (model.mode === "passage" || model.mode === "terrain") {
    // 통행/지형: 클릭 = 규칙 토글. 사이드 폼은 스크롤 유지하며 갱신.
    model.onSelectTile(tile, { quiet: true });
    model.onApplyModeTile(tile);
    rerender();
    return;
  }
  model.onSelectTile(tile);
}

function handlePointerDown(model: ChipsetPreviewModel, tile: number, event: Event): void {
  // 우클릭·중클릭은 드래그 시작 금지
  if (event instanceof PointerEvent && event.button !== 0) return;
  if (event instanceof MouseEvent && event.button !== 0) return;
  event.preventDefault();
  if (model.mode === "group") startGroupDrag(tile, event);
  if (model.mode === "ai") startAiSelectionDrag(tile, event, () => stableRerender(model.rerender));
}

function handlePointerEnter(model: ChipsetPreviewModel, tile: number): void {
  if (model.mode === "group") {
    model.onSelectTile(tile, { quiet: true });
    extendGroupDrag(tile, () => stableRerender(model.rerender));
  }
  if (model.mode === "ai") {
    model.onSelectTile(tile, { quiet: true });
    extendAiSelectionDrag(tile);
  }
}

function cellText(model: ChipsetPreviewModel, tile: number): string {
  if (model.mode === "terrain") return String(model.tileset.terrain[tile] ?? 0);
  if (model.mode === "ai") return hasAiMetadata(model.tileset, tile) ? "AI" : "";
  if (model.mode === "group") return groupCellText(model.tileset, tile);
  return passageText(model.tileset, tile);
}

/** 테스트/디버그용: 현재 프리뷰 배율 */
export function getTilesetPreviewScale(): number {
  return previewScale;
}

function scrollChipsetPreview(axis: "x" | "y", direction: -1 | 1): void {
  const preview = document.querySelector(".tileset-db-preview");
  if (!preview) return;
  if (axis === "x") {
    const distance = Math.max(Math.floor(preview.clientWidth * 0.8), 160);
    preview.scrollLeft += direction * distance;
    return;
  }
  const distance = Math.max(Math.floor(preview.clientHeight * 0.8), 120);
  preview.scrollTop += direction * distance;
}

type PreviewPanState = {
  readonly preview: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
};

function startPreviewPan(event: Event): void {
  // 중클릭(휠 버튼)만 팬 — 우클릭(2)·좌클릭(0)은 절대 팬/스크롤 시작 안 함.
  if (!(event instanceof MouseEvent) || event.button !== 1 || !(event.currentTarget instanceof HTMLElement)) return;
  event.preventDefault();
  event.stopPropagation();
  previewPanState = {
    preview: event.currentTarget,
    scrollLeft: event.currentTarget.scrollLeft,
    scrollTop: event.currentTarget.scrollTop,
    startX: event.clientX,
    startY: event.clientY,
  };
  event.currentTarget.classList.add("panning");
  window.addEventListener("mousemove", handlePreviewPanMove);
  window.addEventListener("mouseup", stopPreviewPan);
}

function handlePreviewPanMove(event: MouseEvent): void {
  if (!previewPanState) return;
  previewPanState.preview.scrollLeft = previewPanState.scrollLeft - (event.clientX - previewPanState.startX);
  previewPanState.preview.scrollTop = previewPanState.scrollTop - (event.clientY - previewPanState.startY);
}

function stopPreviewPan(): void {
  previewPanState?.preview.classList.remove("panning");
  previewPanState = null;
  window.removeEventListener("mousemove", handlePreviewPanMove);
  window.removeEventListener("mouseup", stopPreviewPan);
}

type ScrollSnapshot = {
  readonly selector: string;
  readonly left: number;
  readonly top: number;
};

function stableRerender(rerender: () => void): void {
  const snapshots = captureScrollSnapshots();
  rerender();
  restoreScrollSnapshots(snapshots);
  if (typeof window === "undefined") return; // fakeDom 테스트 환경.
  window.requestAnimationFrame(() => restoreScrollSnapshots(snapshots));
  window.setTimeout(() => restoreScrollSnapshots(snapshots), 0);
}

function captureScrollSnapshots(): readonly ScrollSnapshot[] {
  return [".database-modal-body", ".tileset-db-preview"]
    .map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      return { selector, left: element.scrollLeft, top: element.scrollTop };
    })
    .filter((snapshot): snapshot is ScrollSnapshot => snapshot !== null);
}

function restoreScrollSnapshots(snapshots: readonly ScrollSnapshot[]): void {
  for (const snapshot of snapshots) {
    const element = document.querySelector(snapshot.selector);
    if (!element) continue;
    element.scrollLeft = snapshot.left;
    element.scrollTop = snapshot.top;
  }
}
