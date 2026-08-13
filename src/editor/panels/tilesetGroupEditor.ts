import { renderKnowledgeInspector } from "@/editor/panels/tilesetKnowledgeInspector";
import {
  activateKnowledgeWorkspace,
  beginKnowledgeDrag,
  cancelKnowledgeDrag,
  extendKnowledgeDrag,
  finishKnowledgeDrag,
  knowledgeSelection,
  selectKnowledgeTile,
} from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

let activeTileset: TilesetDef | null = null;
let dragMoved = false;
let dragRerender: (() => void) | null = null;
let isDragging = false;
let suppressNextClick = false;

export function renderTileGroupPanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  activeTileset = tileset;
  activateKnowledgeWorkspace(tileset);
  return el("fieldset", {
    class: "tileset-db-group tileset-knowledge-workspace",
    children: [el("legend", { text: "타일셋 지식" }), renderKnowledgeInspector(tileset, rerender)],
  });
}

export function groupCellClass(tile: number): string {
  return knowledgeSelection().selected.includes(tile) ? " group-selected" : "";
}

export function groupCellText(tileset: TilesetDef, tile: number): string {
  return knowledgeSelection().selected.includes(tile) ? "S" : groupBadge(tileset, tile);
}

export function handleGroupTileClick(tile: number, event: Event, rerender: () => void): void {
  if (!(event instanceof MouseEvent)) return;
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (!activeTileset) return;
  selectKnowledgeTile(activeTileset, tile, event);
  rerender();
}

export function startGroupDrag(tile: number, event: Event, rerender: () => void): void {
  if (!(event instanceof PointerEvent) || !activeTileset) return;
  event.preventDefault();
  isDragging = true;
  dragMoved = false;
  dragRerender = rerender;
  beginKnowledgeDrag(activeTileset, tile, event);
  paintGroupSelection();
  window.addEventListener("pointerup", stopGroupDrag, { once: true });
  window.addEventListener("pointercancel", cancelGroupDrag, { once: true });
}

export function extendGroupDrag(tile: number, rerender: () => void): void {
  if (!isDragging || !activeTileset) return;
  dragMoved = extendKnowledgeDrag(activeTileset, tile) || dragMoved;
  dragRerender = rerender;
  paintGroupSelection();
}

export function stopGroupDrag(): void {
  if (!isDragging) return;
  isDragging = false;
  if (dragMoved) {
    finishKnowledgeDrag();
    suppressNextClick = true;
  } else {
    cancelKnowledgeDrag();
  }
  const rerender = dragRerender;
  dragRerender = null;
  rerender?.();
}

function cancelGroupDrag(): void {
  if (!isDragging) return;
  isDragging = false;
  cancelKnowledgeDrag();
  const rerender = dragRerender;
  dragRerender = null;
  rerender?.();
}

function paintGroupSelection(): void {
  if (!activeTileset) return;
  const selected = new Set(knowledgeSelection().selected);
  for (const node of document.querySelectorAll<HTMLElement>(".tileset-db-cell[data-tile]")) {
    const tile = Number(node.dataset.tile);
    const isSelected = selected.has(tile);
    node.classList.toggle("group-selected", isSelected);
    node.textContent = isSelected ? "S" : groupBadge(activeTileset, tile);
  }
}

function groupBadge(tileset: TilesetDef, tile: number): string {
  return tileset.tileGroups?.some((group) => group.tileIds.includes(tile)) ? "G" : "";
}
