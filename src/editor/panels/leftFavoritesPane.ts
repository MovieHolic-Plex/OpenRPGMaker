import { editorState } from "@/editor/editorState";
import { favoriteTilesSnapshot, isFavoriteTile, recentTilesView, TILE_SHORTCUTS_CHANGED_EVENT, toggleFavoriteTile } from "@/editor/panels/tileBrushTools";
import { selectPaletteTile } from "@/editor/panels/tilePalette";
import { gridPaletteDisplayTile } from "@/editor/panels/tilePaletteGrid";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import { isCustomTileset } from "@/project/tilesetKind";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const CELL = 36;

/**
 * 왼쪽 활동 막대 「즐겨찾기」: 별표한 타일과 최근 고른 타일을 큰 칸으로 모아 한 번에 고른다.
 * 같은 목록을 팔레트 필터(최근)와 인스펙터(즐겨찾기 토글)가 쓴다 — 여기는 모아 보는 자리일 뿐이다.
 * 칸을 누르면 팔레트와 같은 경로(selectPaletteTile)로 고른다. 우클릭은 즐겨찾기 토글.
 */
export function createLeftFavoritesPane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-favorites-pane", attrs: { "aria-label": "즐겨찾기와 최근 타일" }, dataset: { testid: "left-favorites-pane" } });
  let lastKey = "";

  const currentTileset = (): TilesetDef | undefined => {
    const project = store.getCurrent();
    const map = project.maps[editorState.get().currentMapId ?? project.startMapId];
    return map ? project.tilesets[map.tilesetId] : undefined;
  };

  const cell = (tileset: TilesetDef, tile: number, selected: number, section: string): HTMLButtonElement => {
    const shown = isCustomTileset(tileset) ? tile : gridPaletteDisplayTile(tileset, tile);
    const label = tileDisplayLabelForIndex(tile);
    const favorite = isFavoriteTile(tile);
    const button = el("button", {
      class: "left-favorites-cell" + (tile === selected ? " is-selected" : ""),
      attrs: {
        type: "button",
        title: `${label}${favorite ? " · 즐겨찾기" : ""} — 우클릭: 즐겨찾기 ${favorite ? "해제" : "추가"}`,
        "aria-label": label,
        "aria-pressed": String(tile === selected),
        style: `width:${CELL}px;height:${CELL}px;${tilesetTileBackgroundStyle(tileset, shown, CELL)}`,
      },
      dataset: { testid: `left-favorites-${section}-${tile}`, tile: String(tile) },
      on: {
        click: () => selectPaletteTile(tile),
        contextmenu: (event: Event) => { event.preventDefault(); toggleFavoriteTile(tile); },
      },
    }) as HTMLButtonElement;
    if (favorite) button.append(el("span", { class: "left-favorites-star", attrs: { "aria-hidden": "true" }, text: "★" }));
    return button;
  };

  const group = (title: string, testid: string, tiles: readonly number[], tileset: TilesetDef, selected: number, empty: string): HTMLElement => {
    const valid = tiles.filter((tile) => tile >= 0 && tile < tileset.count);
    return el("div", {
      class: "left-favorites-group",
      dataset: { testid },
      children: [
        el("h3", { class: "left-favorites-title", children: [el("span", { text: title }), el("span", { class: "left-favorites-count", text: String(valid.length) })] }),
        valid.length
          ? el("div", { class: "left-favorites-grid", attrs: { role: "group", "aria-label": title }, children: valid.map((tile) => cell(tileset, tile, selected, testid === "left-favorites-starred" ? "star" : "recent")) })
          : el("p", { class: "left-favorites-empty", text: empty }),
      ],
    });
  };

  const render = (): void => {
    if (root.hidden) return;
    const tileset = currentTileset();
    const selected = editorState.get().selectedTile;
    const favorites = favoriteTilesSnapshot();
    const recent = recentTilesView().filter((tile) => !favorites.includes(tile));
    const key = [tileset?.id, tileset?.count, selected, favorites.join(","), recent.join(",")].join("|");
    if (key === lastKey) return;
    lastKey = key;
    if (!tileset) {
      root.replaceChildren(el("p", { class: "left-favorites-empty", text: "맵을 열면 이 맵의 타일셋 즐겨찾기가 보입니다." }));
      return;
    }
    root.replaceChildren(
      group("즐겨찾기", "left-favorites-starred", favorites, tileset, selected, "타일을 우클릭하거나 인스펙터에서 ☆ 를 누르면 여기에 모입니다."),
      group("최근", "left-favorites-recent", recent, tileset, selected, "팔레트에서 고른 타일이 여기에 쌓입니다."),
    );
  };

  const onChange = (): void => render();
  const unsubscribe = editorState.subscribe(onChange);
  window.addEventListener(TILE_SHORTCUTS_CHANGED_EVENT, onChange);
  return {
    root,
    show: () => { lastKey = ""; render(); },
    dispose: () => { unsubscribe(); window.removeEventListener(TILE_SHORTCUTS_CHANGED_EVENT, onChange); },
  };
}
