import { TILE_SIZE } from "@/assets/bundled";
import { editorState } from "@/editor/editorState";
import {
  favoriteTilesSnapshot,
  selectUsedLocation,
  similarTilesForTile,
  usedLocationsForTile,
} from "@/editor/panels/tileBrushTools";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { isAutoConnectCandidate, tileStampsForTile, type TileStampId } from "@/editor/tileStampBrushes";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const CHIPSET_CELL_SIZE = TILE_SIZE * 2;

export type TileBrushAssistModel = {
  readonly activeStampId: TileStampId | null;
  readonly autoConnectMode: boolean;
  readonly mapId: string;
  readonly onSelectTile: (tile: number) => void;
  readonly rerender: () => void;
  readonly selectedTile: number;
  readonly tileset: TilesetDef;
};

export function makePaletteStampStatus(stamp: PaletteStamp | null, rerender: () => void): HTMLElement {
  const row = el("div", {
    class: "tile-brush-row palette-stamp-status" + (stamp ? "" : " hidden"),
    dataset: { testid: "palette-stamp-status" },
  });
  row.append(el("span", { class: "tile-brush-label", text: "Drag" }));
  if (!stamp) return row;
  row.append(
    el("button", {
      class: "btn palette-stamp-clear",
      text: `${stamp.width}x${stamp.height}`,
      attrs: {
        title: "Clear dragged palette stamp",
        "aria-label": "Clear dragged palette stamp",
      },
      dataset: { testid: "palette-stamp-clear" },
      on: {
        click: () => {
          editorState.set({ activePaletteStamp: null });
          rerender();
        },
      },
    })
  );
  return row;
}

export function makeTileBrushAssistPanel(model: TileBrushAssistModel): HTMLElement {
  const project = store.getCurrent();
  const map = project.maps[model.mapId];
  const stamps = tileStampsForTile(model.selectedTile, model.tileset);
  const favorites = favoriteTilesSnapshot().filter((tile) => tile >= 0 && tile < model.tileset.count);
  const similar = similarTilesForTile({ tileset: model.tileset, tile: model.selectedTile, limit: 8 });
  const used = map ? usedLocationsForTile({ map, tile: model.selectedTile, limit: 6 }) : [];
  const panel = el("div", { class: "tile-brush-assist", dataset: { testid: "tile-brush-assist" } });
  panel.append(
    el("div", {
      class: "tile-brush-row tile-brush-mode-row",
      children: [
        el("span", { class: "tile-brush-label", text: "연결" }),
        el("span", {
          class: "tile-brush-chip" + (model.autoConnectMode && isAutoConnectCandidate(model.selectedTile, model.tileset) ? " active" : ""),
          text: model.autoConnectMode && isAutoConnectCandidate(model.selectedTile, model.tileset) ? "Auto" : "Manual",
          dataset: { testid: "auto-connect-mode-label" },
        }),
      ],
    })
  );
  panel.append(makeStampPicker(stamps, model.activeStampId));
  panel.append(makeTileStrip("즐겨", favorites, "favorite-tile-grid", "favorite-tile", model));
  panel.append(makeTileStrip("유사", similar, "similar-tile-grid", "similar-tile", model));
  panel.append(makeUsedLocations(model.mapId, used, model.rerender));
  panel.append(makeCurrentNeighborhoodSummary());
  return panel;
}

function makeStampPicker(stamps: ReturnType<typeof tileStampsForTile>, activeStampId: TileStampId | null): HTMLElement {
  const row = el("div", { class: "tile-brush-row" });
  row.append(el("span", { class: "tile-brush-label", text: "스탬프" }));
  const picker = el("div", { class: "stamp-picker", dataset: { testid: "stamp-picker" } });
  if (stamps.length === 0) {
    picker.append(el("span", { class: "tile-brush-empty", text: "없음" }));
  }
  for (const stamp of stamps) {
    picker.append(
      el("button", {
        class: "btn stamp-button" + (activeStampId === stamp.id ? " active" : ""),
        text: stamp.label,
        attrs: {
          title: stamp.description,
          "aria-label": stamp.description,
          "aria-pressed": String(activeStampId === stamp.id),
        },
        dataset: { testid: `stamp-${stamp.id}` },
        on: {
          click: () => {
            editorState.set({ activeStampId: editorState.get().activeStampId === stamp.id ? null : stamp.id });
          },
        },
      })
    );
  }
  row.append(picker);
  return row;
}

function makeTileStrip(
  label: string,
  tiles: readonly number[],
  testId: string,
  itemPrefix: string,
  model: TileBrushAssistModel
): HTMLElement {
  if (tiles.length === 0 && testId === "favorite-tile-grid") {
    return el("div", { class: "tile-brush-row hidden", dataset: { testid: testId } });
  }
  const row = el("div", { class: "tile-brush-row" });
  row.append(el("span", { class: "tile-brush-label", text: label }));
  const strip = el("div", { class: "tile-brush-strip", dataset: { testid: testId } });
  if (tiles.length === 0) {
    strip.append(el("span", { class: "tile-brush-empty", text: "없음" }));
  }
  for (const tile of tiles) {
    strip.append(
      el("button", {
        class: "quick-tile-cell tile-brush-mini-cell",
        attrs: {
          title: tileDisplayLabelForIndex(tile),
          "aria-label": tileDisplayLabelForIndex(tile),
          style: tilesetTileBackgroundStyle(model.tileset, tile, CHIPSET_CELL_SIZE),
        },
        dataset: { testid: `${itemPrefix}-${tile}` },
        on: {
          pointerdown: (event) => event.preventDefault(),
          click: (event) => {
            event.preventDefault();
            model.onSelectTile(tile);
          },
        },
      })
    );
  }
  row.append(strip);
  return row;
}

function makeUsedLocations(
  mapId: string,
  locations: ReturnType<typeof usedLocationsForTile>,
  rerender: () => void
): HTMLElement {
  if (locations.length === 0) {
    return el("div", { class: "tile-brush-row hidden", dataset: { testid: "used-location-list" } });
  }
  const row = el("div", { class: "tile-brush-row" });
  row.append(el("span", { class: "tile-brush-label", text: "사용" }));
  const list = el("div", { class: "used-location-list", dataset: { testid: "used-location-list" } });
  if (locations.length === 0) {
    list.append(el("span", { class: "tile-brush-empty", text: "0" }));
  }
  for (const location of locations) {
    const label = `${location.layer === "lower" ? "L" : "U"} ${location.x},${location.y}`;
    list.append(
      el("button", {
        class: "btn used-location-button",
        text: label,
        attrs: { title: "현재 맵에서 이 타일을 쓰는 위치", "aria-label": label },
        dataset: { testid: `used-location-${location.layer}-${location.x}-${location.y}` },
        on: {
          click: () => {
            selectUsedLocation({ mapId, ...location });
            rerender();
          },
        },
      })
    );
  }
  row.append(list);
  return row;
}

function makeCurrentNeighborhoodSummary(): HTMLElement {
  const selection = editorState.get().selection;
  if (!selection) {
    return el("div", { class: "tile-brush-neighborhood hidden", dataset: { testid: "current-neighborhood-summary" } });
  }
  const text = selection ? `${selection.x},${selection.y} / ${selection.width}x${selection.height}` : "-";
  return el("div", {
    class: "tile-brush-neighborhood",
    children: [
      el("span", { class: "tile-brush-label", text: "주변" }),
      el("span", { class: "tile-brush-neighborhood-value", text, dataset: { testid: "current-neighborhood-summary" } }),
    ],
  });
}
