import { TILE_SIZE } from "@/assets/bundled";
import { editorState } from "@/editor/editorState";
import {
  favoriteTilesSnapshot,
  isAutoConnectCandidate,
  selectUsedLocation,
  similarTilesForTile,
  usedLocationsForTile,
} from "@/editor/panels/tileBrushTools";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const CHIPSET_CELL_SIZE = TILE_SIZE * 2;

export type TileBrushAssistModel = {
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
  row.append(el("span", { class: "tile-brush-label", text: "끌어놓기" }));
  if (!stamp) return row;
  row.append(
    el("button", {
      class: "btn palette-stamp-clear",
      text: `${stamp.width}x${stamp.height}`,
      attrs: {
        title: "끌어놓은 팔레트 도장 지우기",
        "aria-label": "끌어놓은 팔레트 도장 지우기",
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
  const favorites = favoriteTilesSnapshot().filter((tile) => tile >= 0 && tile < model.tileset.count);
  const similar = similarTilesForTile({ tileset: model.tileset, tile: model.selectedTile, limit: 8 });
  const used = map ? usedLocationsForTile({ map, tile: model.selectedTile, limit: 6 }) : [];
  const panel = el("div", { class: "tile-brush-assist", dataset: { testid: "tile-brush-assist" } });
  const autoOn = model.autoConnectMode;
  const candidate = isAutoConnectCandidate(model.selectedTile, model.tileset);
  panel.append(
    el("div", {
      class: "tile-brush-row tile-brush-mode-row",
      children: [
        el("span", { class: "tile-brush-label", text: "이웃 연결" }),
        el("button", {
          class: "btn tile-brush-chip" + (autoOn ? " active" : ""),
          text: autoOn ? "자동" : "수동",
          attrs: {
            type: "button",
            title: autoOn
              ? "자동 연결 켜짐 — 이웃 지형까지 다시 검사해 이어 붙입니다. 누르면 수동으로."
              : "수동 배치 켜짐 — 일반 타일은 그대로 둡니다. 단 오토타일 브러시(흙길·모래·실내 366 등)는 항상 성형됩니다.",
            "aria-pressed": String(autoOn),
            "aria-label": autoOn ? "자동 연결 끄기" : "자동 연결 켜기",
          },
          dataset: { testid: "auto-connect-mode-toggle" },
          on: {
            click: () => {
              editorState.set({ autoConnectMode: !editorState.get().autoConnectMode });
              model.rerender();
            },
          },
        }),
        el("span", {
          class: "tile-brush-hint",
          text: candidate ? (autoOn ? "이웃 성형" : "오토타일 브러시(항상 성형)") : "이 타일 단독",
          dataset: { testid: "auto-connect-mode-hint" },
        }),
      ],
    })
  );
  // 2글자 라벨(즐겨/유사/사용/주변)은 뜻이 전달되지 않았다 — 풀어 쓴다.
  panel.append(makeTileStrip("즐겨찾기", favorites, "favorite-tile-grid", "favorite-tile", model));
  panel.append(makeTileStrip("닮은 타일", similar, "similar-tile-grid", "similar-tile", model));
  panel.append(makeUsedLocations(model.mapId, used, model.rerender));
  panel.append(makeCurrentNeighborhoodSummary());
  return panel;
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
  row.append(el("span", { class: "tile-brush-label", text: "이 맵에서 쓴 곳" }));
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
      el("span", { class: "tile-brush-label", text: "선택 영역" }),
      el("span", { class: "tile-brush-neighborhood-value", text, dataset: { testid: "current-neighborhood-summary" } }),
    ],
  });
}
