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
import { modeHelpText, type TilesetEditMode } from "@/editor/panels/tilesetUsageGuide";
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
  readonly onSelectTile: (tile: number) => void;
};

let previewScale = 2;
let previewPanState: PreviewPanState | null = null;

export function renderChipsetPreviewPanel(model: ChipsetPreviewModel): HTMLElement {
  return el("div", {
    class: "tileset-db-preview-wrap",
    children: [renderPreviewHeader(model.rerender), renderChipsetPreview(model)],
  });
}

function renderPreviewHeader(rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-preview-header",
    children: [
      el("div", { class: "tileset-db-preview-title", text: "칩셋 그래픽" }),
      el("div", {
        class: "tileset-db-preview-scale",
        children: [
          renderScaleButton({ scale: 1, text: "전체", title: "전체 보기", rerender }),
          renderScaleButton({ scale: 2, text: "2x", title: "2배 편집", rerender }),
          renderScrollButton({ direction: -1, text: "←", title: "왼쪽으로 이동" }),
          renderScrollButton({ direction: 1, text: "→", title: "오른쪽으로 이동" }),
        ],
      }),
    ],
  });
}

function renderScaleButton(model: {
  readonly scale: number;
  readonly text: string;
  readonly title: string;
  readonly rerender: () => void;
}): HTMLButtonElement {
  return el("button", {
    class: previewScale === model.scale ? "active" : "",
    text: model.text,
    attrs: { type: "button", title: model.title },
    on: {
      click: () => {
        previewScale = model.scale;
        stableRerender(model.rerender);
      },
    },
  });
}

function renderScrollButton(model: {
  readonly direction: -1 | 1;
  readonly text: string;
  readonly title: string;
}): HTMLButtonElement {
  return el("button", {
    class: "scroll",
    text: model.text,
    attrs: { type: "button", title: model.title },
    on: {
      click: () => scrollChipsetPreview(model.direction),
    },
  });
}

function renderChipsetPreview(model: ChipsetPreviewModel): HTMLElement {
  const previewCell = model.tileset.tileSize * previewScale;
  const previewWidth = model.tileset.tilesPerRow * previewCell;
  return el("div", {
    class: "tileset-db-preview",
    attrs: {
      style: [
        `--tileset-cols:${model.tileset.tilesPerRow}`,
        `--tileset-cell:${previewCell}px`,
        `--tileset-width:${previewWidth}px`,
      ].join(";"),
    },
    children: [
      el("img", { attrs: { src: tilesetImageUrl(model.tileset), alt: "" } }),
      el("div", {
        class: "tileset-db-click-grid",
        children: Array.from({ length: model.tileset.count }, (_, index) => renderTileCell(model, index)),
      }),
      el("div", {
        class: "tileset-db-preview-meta",
        text: `${model.tileset.count}칩 · ${model.tileset.tileSize}px · ${modeHelpText(model.mode)}`,
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

function renderTileCell(model: ChipsetPreviewModel, index: number): HTMLButtonElement {
  const mark = passageMarkForTile(model.tileset, index);
  const selected = index === model.selectedTile ? " selected" : "";
  const aiSelected = model.mode === "ai" && isAiTileSelected(index) ? " ai-selected" : "";
  const rerender = () => stableRerender(model.rerender);
  return el("button", {
    class: `tileset-db-cell mark-${mark}${selected}${aiSelected}${model.mode === "group" ? groupCellClass(index) : ""}`,
    text: cellText(model, index),
    attrs: { type: "button", title: cellTitle(model.tileset, index) },
    dataset: { testid: `tileset-db-cell-${index}` },
    on: {
      click: (event) => handleTileClick(model, index, event),
      pointerdown: (event) => handlePointerDown(model, index, event),
      mousedown: (event) => {
        event.preventDefault();
        if (model.mode === "ai") startAiSelectionDrag(index, event, rerender);
      },
      pointerenter: () => handlePointerEnter(model, index),
      mouseenter: () => {
        if (model.mode === "ai") {
          model.onSelectTile(index);
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

function handleTileClick(model: ChipsetPreviewModel, tile: number, event: Event): void {
  event.preventDefault();
  const rerender = () => stableRerender(model.rerender);
  model.onSelectTile(tile);
  if (model.mode === "group") handleGroupTileClick(tile, event, rerender);
  else if (model.mode === "ai") handleAiTileClick(tile, event, rerender);
  else {
    model.onApplyModeTile(tile);
    rerender();
  }
}

function handlePointerDown(model: ChipsetPreviewModel, tile: number, event: Event): void {
  event.preventDefault();
  if (model.mode === "group") startGroupDrag(tile, event);
  if (model.mode === "ai") startAiSelectionDrag(tile, event, () => stableRerender(model.rerender));
}

function handlePointerEnter(model: ChipsetPreviewModel, tile: number): void {
  if (model.mode === "group") {
    model.onSelectTile(tile);
    extendGroupDrag(tile, () => stableRerender(model.rerender));
  }
  if (model.mode === "ai") {
    model.onSelectTile(tile);
    extendAiSelectionDrag(tile);
  }
}

function cellText(model: ChipsetPreviewModel, tile: number): string {
  if (model.mode === "terrain") return String(model.tileset.terrain[tile] ?? 0);
  if (model.mode === "ai") return hasAiMetadata(model.tileset, tile) ? "AI" : "";
  if (model.mode === "group") return groupCellText(model.tileset, tile);
  return passageText(model.tileset, tile);
}

function scrollChipsetPreview(direction: -1 | 1): void {
  const preview = document.querySelector(".tileset-db-preview");
  if (!preview) return;
  const distance = Math.max(Math.floor(preview.clientWidth * 0.8), 160);
  preview.scrollLeft += direction * distance;
}

type PreviewPanState = {
  readonly preview: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  readonly scrollLeft: number;
  readonly scrollTop: number;
};

function startPreviewPan(event: Event): void {
  if (!(event instanceof MouseEvent) || event.button !== 1 || !(event.currentTarget instanceof HTMLElement)) return;
  event.preventDefault();
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
