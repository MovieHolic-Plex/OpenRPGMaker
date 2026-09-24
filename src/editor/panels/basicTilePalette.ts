// Beginner persistent panel uses the same source cells, layer rules and keyboard grid as
// the docked palette. A small arbitrary sample hides most usable materials.
import type { TilesetDef } from "@/project/types";
import { isCustomTileset } from "@/project/tilesetKind";
import { isDefaultTilesetTexture, tilesetImageUrl } from "@/editor/tilesetImage";
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

type BasicTilePaletteOptions = {
  tileset: TilesetDef;
  selectedTile: number;
  layer: "lower" | "upper";
  query: string;
  onQuery: (query: string) => void;
  onSelect: (index: number) => void;
  onResetQuery?: () => void;
  onCreatePaletteStamp?: (stamp: PaletteStamp) => void;
};

/** Owned by one rail, never shared between mounted palette surfaces. */
export type BasicTilePaletteCache = {
  current?: {
    tileset: TilesetDef;
    imageUrl: string;
    query: string;
    section: HTMLElement;
    sheet: HTMLElement;
    options: BasicTilePaletteOptions;
  };
};

export function makeBasicTilePalette(options: BasicTilePaletteOptions, cache?: BasicTilePaletteCache): HTMLElement {
  const { tileset, selectedTile, layer, query } = options;
  const imageUrl = tilesetImageUrl(tileset);
  const previous = cache?.current;
  // The sheet is a static crop of the atlas. Keep the same buttons when the
  // visible set is unchanged. Custom atlases show the same cells on both layers;
  // a standard chipset's visible set follows the layer, so that change rebuilds.
  const sameLayer = isCustomTileset(tileset) || previous?.options.layer === layer;
  if (previous?.tileset === tileset
    && previous.imageUrl === imageUrl && previous.query === query && sameLayer
    && (!query.trim() || previous.options.selectedTile === selectedTile)) {
    previous.options = options;
    const status = previous.section.querySelector<HTMLElement>('[data-testid="selected-tile-status"]');
    if (status) status.textContent = `${layer === "lower" ? "바닥" : "상위"} · ${basicTileLabel(tileset, selectedTile)}`;
    const oldActive = previous.sheet.querySelector<HTMLElement>('.chipset-tile.active');
    const nextActive = previous.sheet.querySelector<HTMLElement>(`[data-tile-index="${selectedTile}"]`);
    if (oldActive !== nextActive) {
      oldActive?.classList.remove('active');
      oldActive?.setAttribute('aria-pressed', 'false');
      nextActive?.classList.add('active');
      nextActive?.setAttribute('aria-pressed', 'true');
      if (nextActive) {
        previous.sheet.querySelector<HTMLElement>('.chipset-tile[tabindex="0"]')?.setAttribute('tabindex', '-1');
        nextActive.setAttribute('tabindex', '0');
      }
    }
    return previous.section;
  }
  const section = el("div", { class: "basic-rail-section", dataset: { testid: "basic-tiles-section" } });
  section.append(el("div", {
    class: "basic-selected-tile",
    text: `${layer === "lower" ? "바닥" : "상위"} · ${basicTileLabel(tileset, selectedTile)}`,
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
  // New definitions, baked images and searches rebuild; retained callbacks read
  // current options so "both" layer tiles never inherit a stale layer selection.
  const handlers = { options };
  const args = {
    tileset, selectedTile, layer, visibleTiles,
    onSelectTile: (index: number) => handlers.options.onSelect(index),
    onCreatePaletteStamp: options.onCreatePaletteStamp
      ? (stamp: PaletteStamp) => handlers.options.onCreatePaletteStamp?.(stamp) : undefined,
  };
  const sheet = isCustomTileset(tileset) ? makeCustomPalette(args) : makeGridPalette(args);
  sheet.dataset.testid = "basic-tile-grid";
  for (const cell of Array.from(sheet.querySelectorAll<HTMLElement>(".chipset-tile"))) {
    cell.dataset.testid = `basic-tile-${cell.dataset.tileIndex}`;
  }
  if (cache) cache.current = Object.assign(handlers, { tileset, imageUrl, query, section, sheet });
  section.append(sheet);
  return section;
}
