import { renderAiQuestionPanel } from "@/editor/panels/tilesetAiQuestionEditor";
import { renderChipsetPreviewPanel } from "@/editor/panels/tilesetChipsetPreview";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import {
  ensureTileMeta,
  metadataForTile,
  numberControl,
  passageText,
  textAreaControl,
} from "@/editor/panels/tilesetMetadataControls";
import { type TilesetEditMode, TILESET_EDIT_MODES } from "@/editor/panels/tilesetUsageGuide";
import { store } from "@/project/store";
import { nextPassageMark, passageMarkForTile, setPassageMark } from "@/project/tilesetPassage";
import type { TileAiMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

let selectedTile = 0;
let editMode: TilesetEditMode = "passage";

export function renderTilesetMetadataEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  clampSelectedTile(tileset);
  return el("div", {
    class: "tileset-db-edit-area",
    children: [
      renderEditSidebar(tileset, rerender),
      renderChipsetPreviewPanel({
        tileset,
        mode: editMode,
        selectedTile,
        rerender,
        onApplyModeTile: (tile) => applyActiveModeClick(tileset.id, tile),
        onSelectTile: (tile) => {
          selectedTile = tile;
        },
      }),
    ],
  });
}

function renderEditSidebar(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-edit-sidebar",
    children: [
      renderToolBox(rerender),
      renderSelectedTilePanel(tileset),
      ...(editMode === "ai" ? [renderAiQuestionPanel(tileset, rerender, selectFirstAppliedTile)] : []),
      ...(editMode === "group" ? [renderTileGroupPanel(tileset, rerender)] : []),
    ],
  });
}

function renderToolBox(rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-tools",
    attrs: { role: "tablist", "aria-label": "타일셋 작업" },
    children: TILESET_EDIT_MODES.map((mode) =>
      el("button", {
        class: mode.id === editMode ? "active" : "",
        text: mode.label,
        attrs: { type: "button", role: "tab", "aria-selected": String(mode.id === editMode) },
        dataset: { testid: `tileset-edit-mode-${mode.id}` },
        on: { click: () => setMode(mode.id, rerender) },
      }),
    ),
  });
}

function renderSelectedTilePanel(tileset: TilesetDef): HTMLElement {
  const meta = metadataForTile(tileset, selectedTile);
  return el("section", {
    class: "tileset-db-selected-tile",
    children: [
      el("div", {
        class: "tileset-db-selected-header",
        children: [
          el("strong", { text: `${selectedTile}번 타일` }),
          el("span", { text: `통행 ${passageText(tileset, selectedTile)}` }),
        ],
      }),
      ...renderSelectedTileModeFields(tileset, meta),
    ],
  });
}

function renderSelectedTileModeFields(tileset: TilesetDef, meta: TileAiMetadata): HTMLElement[] {
  if (editMode === "terrain") {
    return [
      numberControl("지형 태그", tileset.terrain[selectedTile] ?? 0, (value) => updateTerrain(tileset.id, value), "tileset-field-terrain-tag"),
    ];
  }
  if (editMode === "ai") {
    return [
      textAreaControl("AI 라벨", meta.label, (value) => updateMetadata(tileset.id, { label: value }), "tileset-field-ai-label"),
      textAreaControl("AI 설명", meta.description, (value) => updateMetadata(tileset.id, { description: value }), "tileset-field-ai-description"),
    ];
  }
  return [];
}

function applyActiveModeClick(tilesetId: string, tile: number): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    if (editMode === "passage") setPassageMark(target, tile, nextPassageMark(passageMarkForTile(target, tile)));
    if (editMode === "terrain") target.terrain[tile] = ((target.terrain[tile] ?? 0) + 1) % 10;
  });
}

function updateTerrain(tilesetId: string, value: number): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) target.terrain[selectedTile] = value;
  });
}

function updateMetadata(tilesetId: string, patch: Partial<TileAiMetadata>): void {
  let nextMeta: TileAiMetadata | null = null;
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    const tileMeta = ensureTileMeta(target, selectedTile);
    if (patch.label !== undefined) tileMeta.label = patch.label;
    if (patch.description !== undefined) tileMeta.description = patch.description;
    tileMeta.source = "user";
    nextMeta = { ...tileMeta };
  });
  if (nextMeta) syncSelectedTileBadge(nextMeta);
}

function syncSelectedTileBadge(meta: TileAiMetadata): void {
  const cell = document.querySelector(`[data-testid="tileset-db-cell-${selectedTile}"]`);
  if (!cell) return;
  cell.textContent = meta.label.trim() || meta.description.trim() ? "AI" : "";
}

export function setTilesetMetadataEditMode(mode: TilesetEditMode, rerender: () => void): void {
  setMode(mode, rerender);
}

export function getTilesetMetadataEditMode(): TilesetEditMode {
  return editMode;
}

function setMode(mode: TilesetEditMode, rerender: () => void): void {
  editMode = mode;
  rerender();
}

function selectFirstAppliedTile(tiles: readonly number[]): void {
  selectedTile = tiles[0] ?? selectedTile;
}

function clampSelectedTile(tileset: TilesetDef): void {
  if (selectedTile < 0 || selectedTile >= tileset.count) selectedTile = 0;
}
