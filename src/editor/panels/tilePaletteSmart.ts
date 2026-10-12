// 지형 · 프리팹 · 최근 · 개별 타일.
//
// 격자를 대체하지 않는다. 메타데이터가 있는 타일셋에서 그 위에 카드를 올리고,
// 개별 타일 탭은 기존 검색·분류·격자를 그대로 둔다. 카드 클릭은 대표 칸을
// 고르거나(오토타일은 기존 엔진이 이웃을 맞춘다) structureKit 스탬프를 켠다.

import { editorState } from "@/editor/editorState";
import { dismissLocationDrawModeForTool } from "@/editor/locationDrawMode";
import {
  defaultPaletteView,
  paletteCatalogFor,
  paletteHasSmartCatalog,
  prefabChips,
  prefabMatchesChip,
  prefabThumbTiles,
  searchPaletteCatalog,
  terrainChipCounts,
  TERRAIN_CHIPS,
  type CatalogSearchResult,
  type PaletteCatalog,
  type PrefabCard,
  type TerrainCard,
  type TerrainChipId,
} from "@/editor/panels/tilePaletteCatalog";
import { recordRecentTile, recentTilesView } from "@/editor/panels/tileBrushTools";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export type PaletteViewId = "terrain" | "prefab" | "recent" | "tiles";

/** 한 화면에 만드는 카드 수. 나머지는 스크롤할 때 채운다. */
export const PALETTE_CARD_WINDOW = 24;
const CARD_ROW_PX = 112;
const CARD_COLUMNS = 2;
const SEARCH_DELAY_MS = 120;

const viewByTileset = new Map<string, PaletteViewId>();
let terrainChip: TerrainChipId = "all";
let prefabChip = "all";
let catalogQuery = "";
let activeTerrainId: string | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

export function resetSmartPaletteForTests(): void {
  viewByTileset.clear();
  terrainChip = "all";
  prefabChip = "all";
  catalogQuery = "";
  activeTerrainId = null;
  if (searchTimer !== null) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
}

export function currentPaletteView(tileset: TilesetDef): PaletteViewId {
  if (!paletteHasSmartCatalog(tileset)) return "tiles";
  return viewByTileset.get(tileset.id) ?? defaultPaletteView(tileset);
}

/** refreshTilePalette 가 같은 화면을 다시 그리지 않게 하는 토큰. */
export function smartPaletteInputToken(tileset: TilesetDef): string {
  if (!paletteHasSmartCatalog(tileset)) return "raw";
  return [currentPaletteView(tileset), terrainChip, prefabChip, catalogQuery, activeTerrainId ?? ""].join("|");
}

export function clearSmartTerrainSelection(): void {
  activeTerrainId = null;
}

export function makePaletteSmartTabs(tileset: TilesetDef, onRerender: () => void): HTMLElement {
  const view = currentPaletteView(tileset);
  const catalog = paletteCatalogFor(tileset);
  const tabs = el("div", {
    class: "palette-smart-tabs",
    attrs: { role: "tablist", "aria-label": "타일 팔레트" },
    dataset: { testid: "palette-smart-tabs" },
  });
  const items: readonly { readonly id: PaletteViewId; readonly label: string; readonly count: number }[] = [
    { id: "terrain", label: "지형", count: catalog.terrain.length },
    { id: "prefab", label: "프리팹", count: catalog.prefabs.length },
    { id: "recent", label: "최근", count: recentTilesView().length },
    { id: "tiles", label: "개별 타일", count: tileset.count },
  ];
  for (const item of items) {
    const selected = view === item.id;
    tabs.append(el("button", {
      class: "palette-smart-tab" + (selected ? " is-active" : ""),
      text: item.label,
      attrs: {
        type: "button",
        role: "tab",
        "aria-selected": selected ? "true" : "false",
        title: `${item.label} ${item.count}`,
      },
      dataset: { testid: `palette-tab-${item.id}`, paletteView: item.id },
      on: {
        click: () => {
          if (currentPaletteView(tileset) === item.id) return;
          viewByTileset.set(tileset.id, item.id);
          onRerender();
        },
      },
    }));
  }
  return tabs;
}

/**
 * 지형·프리팹·최근·검색 결과. 개별 타일 탭은 이 함수를 부르지 않는다.
 * 반환 노드가 세로로 늘어나며 카드만 스크롤한다.
 */
export function makePaletteSmartBody(
  tileset: TilesetDef,
  onRerender: () => void,
  onSelectTile: (index: number) => void,
): HTMLElement {
  const view = currentPaletteView(tileset);
  const catalog = paletteCatalogFor(tileset);
  const shell = el("div", {
    class: "palette-smart",
    dataset: { testid: "palette-smart", paletteView: view },
  });
  shell.append(makeCatalogSearch(onRerender));
  const query = catalogQuery.trim();
  if (query.length > 0) {
    shell.append(makeSearchResults(tileset, query, onRerender, onSelectTile));
    return shell;
  }
  if (view === "terrain") shell.append(makeTerrainChips(catalog, onRerender));
  if (view === "prefab") shell.append(makePrefabChipRow(catalog, onRerender));
  const body = el("div", {
    class: "palette-smart-body",
    attrs: { role: "tabpanel" },
    dataset: { testid: "palette-smart-body" },
  });
  if (view === "terrain") mountCardWindow(body, terrainCards(catalog), (card) => makeTerrainButton(tileset, card, onRerender), "이 분류에 해당하는 지형이 없습니다.");
  else if (view === "prefab") mountCardWindow(body, prefabList(catalog), (card) => makePrefabButton(tileset, card, onRerender), "이 분류에 해당하는 프리팹이 없습니다.");
  else mountCardWindow(body, recentCards(tileset), (card) => makeRecentButton(tileset, card, onSelectTile), "아직 고른 타일이 없습니다.");
  shell.append(body);
  return shell;
}

function makeCatalogSearch(onRerender: () => void): HTMLElement {
  const input = el("input", {
    class: "tile-search-input palette-catalog-search",
    attrs: {
      type: "search",
      placeholder: "라벨·태그 검색",
      "aria-label": "라벨·태그 검색",
    },
    value: catalogQuery,
    dataset: { testid: "palette-catalog-search" },
    on: {
      input: (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        catalogQuery = target.value;
        if (searchTimer !== null) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          searchTimer = null;
          onRerender();
        }, SEARCH_DELAY_MS);
      },
    },
  });
  return el("div", { class: "palette-smart-search", children: [input] });
}

function makeTerrainChips(catalog: PaletteCatalog, onRerender: () => void): HTMLElement {
  const counts = terrainChipCounts(catalog.terrain);
  const row = el("div", {
    class: "palette-smart-chips",
    attrs: { role: "toolbar", "aria-label": "지형 분류" },
    dataset: { testid: "palette-terrain-chips" },
  });
  for (const chip of TERRAIN_CHIPS) {
    const count = counts.get(chip.id) ?? 0;
    if (chip.id !== "all" && count === 0) continue;
    const selected = terrainChip === chip.id;
    row.append(el("button", {
      class: "palette-smart-chip" + (selected ? " is-active" : ""),
      text: chip.label,
      attrs: { type: "button", "aria-pressed": selected ? "true" : "false" },
      dataset: { testid: `palette-terrain-chip-${chip.id}`, terrainChip: chip.id },
      on: {
        click: () => {
          terrainChip = chip.id;
          onRerender();
        },
      },
    }));
  }
  return row;
}

function makePrefabChipRow(catalog: PaletteCatalog, onRerender: () => void): HTMLElement {
  const row = el("div", {
    class: "palette-smart-chips",
    attrs: { role: "toolbar", "aria-label": "프리팹 분류" },
    dataset: { testid: "palette-prefab-chips" },
  });
  const known = new Set(prefabChips(catalog.prefabs).map((chip) => chip.id));
  if (!known.has(prefabChip)) prefabChip = "all";
  for (const chip of prefabChips(catalog.prefabs)) {
    const selected = prefabChip === chip.id;
    row.append(el("button", {
      class: "palette-smart-chip" + (selected ? " is-active" : ""),
      text: chip.label,
      attrs: { type: "button", "aria-pressed": selected ? "true" : "false" },
      dataset: { testid: `palette-prefab-chip-${chip.id}`, prefabChip: chip.id },
      on: {
        click: () => {
          prefabChip = chip.id;
          onRerender();
        },
      },
    }));
  }
  return row;
}

function terrainCards(catalog: PaletteCatalog): readonly TerrainCard[] {
  if (terrainChip === "all") return catalog.terrain;
  return catalog.terrain.filter((card) => card.chip === terrainChip);
}

function prefabList(catalog: PaletteCatalog): readonly PrefabCard[] {
  return catalog.prefabs.filter((card) => prefabMatchesChip(card, prefabChip));
}

type RecentCard = { readonly index: number; readonly label: string };

function recentCards(tileset: TilesetDef): readonly RecentCard[] {
  return recentTilesView()
    .filter((index) => index >= 0 && index < tileset.count)
    .map((index) => ({ index, label: tileLabel(tileset, index) }));
}

function makeSearchResults(
  tileset: TilesetDef,
  query: string,
  onRerender: () => void,
  onSelectTile: (index: number) => void,
): HTMLElement {
  const result = searchPaletteCatalog(tileset, query);
  const body = el("div", {
    class: "palette-smart-body",
    dataset: { testid: "palette-search-results" },
  });
  const total = result.terrainTotal + result.groupTotal + result.prefabTotal + result.tileTotal;
  body.append(el("p", {
    class: "palette-smart-note",
    text: total === 0 ? "맞는 지형·프리팹·타일이 없습니다." : searchSummary(result),
    dataset: { testid: "palette-search-summary" },
  }));
  appendSearchSection(body, "지형", result.terrain, result.terrainTotal, (hit) => {
    if (hit.kind !== "terrain") return el("span");
    return makeTerrainButton(tileset, hit.card, onRerender);
  });
  appendSearchSection(body, "묶음", result.groups, result.groupTotal, (hit) => {
    if (hit.kind !== "group") return el("span");
    return makeTileButton(tileset, hit.card.paintTile, hit.card.name, `palette-search-group-${hit.card.id}`, "묶음", onSelectTile);
  });
  appendSearchSection(body, "프리팹", result.prefabs, result.prefabTotal, (hit) => {
    if (hit.kind !== "prefab") return el("span");
    return makePrefabButton(tileset, hit.card, onRerender);
  });
  appendSearchSection(body, "개별 타일", result.tiles, result.tileTotal, (hit) => {
    if (hit.kind !== "tile") return el("span");
    return makeTileButton(tileset, hit.index, hit.label, `palette-search-tile-${hit.index}`, "타일", onSelectTile);
  });
  return body;
}

function searchSummary(result: CatalogSearchResult): string {
  return `지형 ${result.terrainTotal} · 묶음 ${result.groupTotal} · 프리팹 ${result.prefabTotal} · 타일 ${result.tileTotal}`;
}

function appendSearchSection(
  body: HTMLElement,
  title: string,
  hits: readonly { readonly kind: string }[],
  total: number,
  renderHit: (hit: CatalogSearchResult["terrain"][number]) => HTMLElement,
): void {
  if (hits.length === 0) return;
  const extra = total > hits.length ? ` · ${total - hits.length}개 더 있음` : "";
  body.append(el("h4", { class: "palette-smart-section", text: `${title}${extra}` }));
  const grid = el("div", { class: "palette-card-grid" });
  for (const hit of hits) grid.append(renderHit(hit as CatalogSearchResult["terrain"][number]));
  body.append(grid);
}

function makeTerrainButton(tileset: TilesetDef, card: TerrainCard, onRerender: () => void): HTMLElement {
  const active = activeTerrainId === card.id && editorState.get().selectedTile === card.paintTile && !editorState.get().activePaletteStamp;
  const kindLabel = card.kind === "autotile" ? "오토타일" : "묶음";
  return makeCardButton({
    testId: `palette-terrain-${card.id}`,
    title: `${card.name} — ${kindLabel}. 지도에 칠하면 이 묶음의 규칙으로 맞춰집니다.`,
    active,
    name: card.name,
    meta: `${kindLabel} · ${card.memberCount}칸`,
    thumb: singleThumb(tileset, card.paintTile),
    onClick: () => {
      selectTerrainCard(card);
      onRerender();
    },
  });
}

function makePrefabButton(tileset: TilesetDef, card: PrefabCard, onRerender: () => void): HTMLElement {
  const stamp = editorState.get().activePaletteStamp;
  const active = stamp?.kitId === card.id;
  return makeCardButton({
    testId: `palette-prefab-${card.id}`,
    title: `${card.name} — ${card.width}×${card.height} ${card.roleLabel}. 클릭해서 찍기`,
    active,
    name: card.name,
    meta: `${card.roleLabel} · ${card.width}×${card.height}`,
    thumb: mosaicThumb(tileset, prefabThumbTiles(card.kit, tileset.count)),
    onClick: () => {
      activeTerrainId = null;
      if (active) {
        editorState.set({ activePaletteStamp: null });
      } else {
        dismissLocationDrawModeForTool("paint");
        recordRecentTile(card.paintTile);
        editorState.set({
          activePaletteStamp: paletteStampFromKit(card.kit),
          tool: "paint",
          paintShape: "pen",
        });
      }
      onRerender();
    },
  });
}

function makeRecentButton(tileset: TilesetDef, card: RecentCard, onSelectTile: (index: number) => void): HTMLElement {
  const active = editorState.get().selectedTile === card.index && !editorState.get().activePaletteStamp;
  return makeTileButton(tileset, card.index, card.label, `palette-recent-${card.index}`, "최근", onSelectTile, active);
}

function makeTileButton(
  tileset: TilesetDef,
  index: number,
  label: string,
  testId: string,
  meta: string,
  onSelectTile: (index: number) => void,
  active = editorState.get().selectedTile === index && !editorState.get().activePaletteStamp,
): HTMLElement {
  return makeCardButton({
    testId,
    title: `${label} — 이 칸을 칠합니다`,
    active,
    name: label,
    meta,
    thumb: singleThumb(tileset, index),
    onClick: () => {
      activeTerrainId = null;
      onSelectTile(index);
    },
  });
}

function makeCardButton(input: {
  readonly testId: string;
  readonly title: string;
  readonly active: boolean;
  readonly name: string;
  readonly meta: string;
  readonly thumb: HTMLElement;
  readonly onClick: () => void;
}): HTMLElement {
  return el("button", {
    class: "palette-card" + (input.active ? " is-active" : ""),
    attrs: { type: "button", title: input.title, "aria-pressed": input.active ? "true" : "false" },
    dataset: { testid: input.testId },
    children: [
      input.thumb,
      el("span", { class: "palette-card-name", text: input.name }),
      el("span", { class: "palette-card-meta", text: input.meta }),
    ],
    on: { click: input.onClick },
  });
}

function singleThumb(tileset: TilesetDef, tile: number): HTMLElement {
  const cell = el("span", {
    class: "palette-card-cell",
    attrs: { "aria-hidden": "true", style: tilesetTileBackgroundStyle(tileset, tile, "100%") },
  });
  return el("span", { class: "palette-card-thumb", attrs: { "aria-hidden": "true" }, children: [cell] });
}

function mosaicThumb(tileset: TilesetDef, mosaic: { readonly columns: number; readonly tiles: readonly number[] }): HTMLElement {
  const thumb = el("span", {
    class: "palette-card-thumb is-mosaic",
    attrs: { "aria-hidden": "true", style: `grid-template-columns:repeat(${Math.max(1, mosaic.columns)}, 1fr)` },
  });
  for (const tile of mosaic.tiles) {
    thumb.append(el("span", {
      class: "palette-card-cell" + (tile < 0 ? " is-empty" : ""),
      attrs: tile < 0 ? { "aria-hidden": "true" } : { "aria-hidden": "true", style: tilesetTileBackgroundStyle(tileset, tile, "100%") },
    }));
  }
  return thumb;
}

function selectTerrainCard(card: TerrainCard): void {
  dismissLocationDrawModeForTool("paint");
  activeTerrainId = card.id;
  recordRecentTile(card.paintTile);
  const state = editorState.get();
  const keep = state.tool === "paint" || state.tool === "fill" || state.tool === "erase";
  const nextLayer = card.layer;
  editorState.set({
    activePaletteStamp: null,
    selectedTile: card.paintTile,
    layer: nextLayer,
    tool: keep ? state.tool : "paint",
    autoConnectMode: card.kind === "autotile" ? true : state.autoConnectMode,
  });
  if (state.layer !== "event" && state.layer !== nextLayer) {
    toast(nextLayer === "upper" ? "상위 레이어 타일 — 상위 레이어 편집으로 전환" : "하위 레이어 타일 — 하위 레이어 편집으로 전환", "ok");
  }
}

function tileLabel(tileset: TilesetDef, index: number): string {
  return tileset.tileMeta?.[index]?.label?.trim() || `타일 ${index}`;
}

/**
 * 카드가 많으면 보이는 줄만 만든다. 높이를 재기 전(테스트 DOM)에는 첫 창만 그린다.
 * 스크롤은 팔레트 전체를 다시 그리지 않고 이 창만 갈아 끼운다.
 */
function mountCardWindow<T>(
  host: HTMLElement,
  items: readonly T[],
  renderItem: (item: T) => HTMLElement,
  emptyText: string,
): void {
  if (items.length === 0) {
    host.append(el("p", {
      class: "palette-smart-note",
      text: emptyText,
      dataset: { testid: "palette-smart-empty" },
    }));
    return;
  }
  const rows = Math.ceil(items.length / CARD_COLUMNS);
  const spacer = el("div", { class: "palette-card-spacer" });
  spacer.style.height = `${rows * CARD_ROW_PX}px`;
  const windowEl = el("div", { class: "palette-card-window" });
  spacer.append(windowEl);
  host.append(spacer);

  const paint = (): void => {
    const height = host.clientHeight;
    const start = height > 0
      ? Math.max(0, Math.floor(host.scrollTop / CARD_ROW_PX) - 1) * CARD_COLUMNS
      : 0;
    const visible = height > 0
      ? (Math.ceil(height / CARD_ROW_PX) + 3) * CARD_COLUMNS
      : PALETTE_CARD_WINDOW;
    const end = Math.min(items.length, start + visible);
    windowEl.style.top = `${Math.floor(start / CARD_COLUMNS) * CARD_ROW_PX}px`;
    windowEl.replaceChildren();
    for (let index = start; index < end; index += 1) {
      const item = items[index];
      if (item !== undefined) windowEl.append(renderItem(item));
    }
  };
  paint();
  host.addEventListener("scroll", paint, { passive: true });
}
