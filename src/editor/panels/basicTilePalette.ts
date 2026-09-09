// Beginner persistent panel uses the same source cells, layer rules and keyboard grid as
// the docked palette. A small arbitrary sample hides most usable materials.
import type { TilesetDef } from "@/project/types";
import { isCustomTileset } from "@/project/tilesetKind";
import { isDefaultTilesetTexture } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { makeCustomPalette, makeGridPalette, gridPaletteDisplayTile } from "@/editor/panels/tilePaletteGrid";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
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
  onResetQuery?: () => void;
  onCreatePaletteStamp?: (stamp: PaletteStamp) => void;
}): HTMLElement {
  const { tileset, selectedTile, layer, query } = options;
  const section = el("div", { class: "basic-rail-section", dataset: { testid: "basic-tiles-section" } });
  section.append(el("p", { class: "basic-paint-guide", text: "타일을 고르고 맵에 칠하세요" }));
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
  const matches = filterTileIndexes(tileset, { category: "all", query, recent: [] });
  const visibleTiles = query.trim() ? new Set(matches) : null;
  const displayedSelection = isCustomTileset(tileset) ? selectedTile : gridPaletteDisplayTile(tileset, selectedTile);
  if (visibleTiles) {
    const feedback = el("div", {
      class: "basic-tile-search-feedback",
      dataset: { testid: "basic-tile-search-feedback", matchCount: String(matches.length) },
      attrs: { role: "status" },
      children: [el("span", { text: `검색 결과 ${matches.length}개` })],
    });
    if (!visibleTiles.has(displayedSelection)) feedback.append(el("span", {
      text: "선택한 타일은 검색 조건 밖에 있어도 유지됩니다.",
      dataset: { testid: "basic-tile-filter-selection", selectedTile: String(selectedTile) },
    }));
    feedback.append(el("button", {
      class: "btn", text: "검색 지우기", attrs: { type: "button" },
      dataset: { testid: "basic-tile-search-reset" },
      on: { click: () => { if (options.onResetQuery) options.onResetQuery(); else options.onQuery(""); } },
    }));
    section.append(feedback);
  }
  const args = {
    tileset, selectedTile, layer, onSelectTile: options.onSelect,
    onCreatePaletteStamp: options.onCreatePaletteStamp, visibleTiles,
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
