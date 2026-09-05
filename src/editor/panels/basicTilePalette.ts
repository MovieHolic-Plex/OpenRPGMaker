// Beginner flyout uses the same source cells, layer rules and keyboard grid as
// the docked palette. A small arbitrary sample hides most usable materials.
import type { TilesetDef } from "@/project/types";
import { isCustomTileset } from "@/project/tilesetKind";
import { isDefaultTilesetTexture } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { makeCustomPalette, makeGridPalette } from "@/editor/panels/tilePaletteGrid";
import { filterTileIndexes } from "@/editor/panels/tilePaletteFilter";
import { el } from "@/util/dom";

export function basicTileLabel(tileset: TilesetDef, index: number): string {
  if (index < 0 || index >= tileset.count) return "공백";
  if (isDefaultTilesetTexture(tileset)) return tileDisplayLabelForIndex(index);
  return tileset.tileMeta?.[index]?.label?.trim() || `타일 ${index}`;
}

export function makeBasicTilePalette(options: {
  tileset: TilesetDef;
  selectedTile: number;
  layer: "lower" | "upper";
  query: string;
  onQuery: (query: string) => void;
  onSelect: (index: number) => void;
}): HTMLElement {
  const { tileset, selectedTile, layer, query } = options;
  const section = el("div", { class: "basic-rail-section", dataset: { testid: "basic-tiles-section" } });
  section.append(el("div", {
    class: "basic-selected-tile",
    text: `${layer === "lower" ? "바닥" : "덧그림"} · ${basicTileLabel(tileset, selectedTile)}`,
    dataset: { testid: "selected-tile-status" },
  }));
  section.append(el("input", {
    class: "tile-search-input",
    attrs: { type: "search", placeholder: "번호·이름으로 타일 찾기", "aria-label": "타일 찾기" },
    value: query,
    dataset: { testid: "basic-tile-search" },
    on: { input: (event) => options.onQuery((event.currentTarget as HTMLInputElement).value) },
  }));
  const args = {
    tileset, selectedTile, layer, onSelectTile: options.onSelect,
    visibleTiles: query.trim() ? new Set(filterTileIndexes(tileset, { category: "all", query, recent: [] })) : null,
  };
  const sheet = isCustomTileset(tileset) ? makeCustomPalette(args) : makeGridPalette(args);
  sheet.dataset.testid = "basic-tile-grid";
  // Keep the established beginner automation entry points; rendering and roving
  // focus still belong to the shared grid, including custom atlas coordinates.
  for (const cell of Array.from(sheet.querySelectorAll<HTMLElement>(".chipset-tile"))) {
    cell.dataset.testid = `basic-tile-${cell.dataset.tileIndex}`;
  }
  section.append(sheet);
  return section;
}
