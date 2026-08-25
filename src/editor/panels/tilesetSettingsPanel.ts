import { editorState } from "@/editor/editorState";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const TILESET_SELECTION_KEY = "oprn:database.selectedTilesetId";

let selectedTilesetId: string | null = null;

export function renderTilesetsTab(host: HTMLElement, rerender: () => void): void {
  const tilesets = Object.values(store.getCurrent().tilesets);
  const selected = selectTileset(tilesets);
  if (!selected) {
    host.append(
      el("section", {
        class: "db-detail-form",
        dataset: { testid: "db-detail-form" },
        children: [
          el("div", {
            class: "db-empty-state tileset-db-empty",
            children: [
              el("div", { class: "db-empty-icon", text: "▦" }),
              el("strong", { class: "db-empty-title", text: "타일셋이 없습니다" }),
              el("p", {
                class: "db-empty-copy",
                text: "프로젝트에 타일셋이 없습니다. 소재에서 칩셋을 가져오거나 기본 타일셋을 확인하세요.",
              }),
            ],
          }),
        ],
      }),
    );
    return;
  }
  host.append(renderTilesetDatabaseWorkspace(tilesets, selected, rerender));
}

function renderTilesetDatabaseWorkspace(
  tilesets: readonly TilesetDef[],
  selected: TilesetDef,
  rerender: () => void,
): HTMLElement {
  return el("section", {
    class: "db-detail-form tileset-db-workspace compact oprn-tileset-workspace",
    dataset: { testid: "db-detail-form" },
    children: [renderTilesetList(tilesets, selected.id, rerender), renderTilesetEditor(selected, rerender)],
  });
}

function renderTilesetList(tilesets: readonly TilesetDef[], selectedId: string, rerender: () => void): HTMLElement {
  const rows = tilesets.map((tileset, index) =>
    el("button", {
      class: `tileset-db-list-row${tileset.id === selectedId ? " active" : ""}`,
      attrs: { type: "button", title: tileset.name || tileset.id },
      dataset: { testid: `tileset-db-row-${tileset.id}` },
      on: {
        click: () => {
          setSelectedTileset(tileset.id);
          rerender();
        },
      },
      children: [
        el("span", { class: "db-list-name", text: tileset.name || "(이름 없음)" }),
        el("span", { class: "db-list-number", text: `#${index + 1}` }),
      ],
    }),
  );
  const listbox = el("div", { class: "tileset-db-listbox", children: rows });
  revealSelectedTileset(listbox);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => revealSelectedTileset(listbox));
    observer.observe(listbox);
  }
  return el("aside", {
    class: "tileset-db-list oprn-tileset-list-pane",
    children: [
      el("div", { class: "tileset-db-panel-title", text: "타일셋" }),
      listbox,
      el("button", {
        class: "database-footer-button oprn-maximum-button disabled",
        text: "최대 개수",
        attrs: { type: "button", disabled: "true", title: "타일셋 최대 개수 조정은 아직 지원하지 않습니다." },
        dataset: { testid: "tileset-oprn-maximum-count" },
      }),
    ],
  });
}

function revealSelectedTileset(listbox: HTMLElement): void {
  const selected = listbox.querySelector(".tileset-db-list-row.active");
  if (!(selected instanceof HTMLElement) || typeof selected.scrollIntoView !== "function") return;
  selected.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function selectTileset(tilesets: readonly TilesetDef[]): TilesetDef | undefined {
  if (tilesets.length === 0) {
    selectedTilesetId = null;
    return undefined;
  }
  const storedId = selectedTilesetId ?? readStoredSelectedTilesetId();
  const preferredTilesetId = currentMapTilesetId() ?? "easyrpg_chipset_combined_town";
  const selected = tilesets.find((tileset) => tileset.id === storedId)
    ?? tilesets.find((tileset) => tileset.id === preferredTilesetId)
    ?? tilesets[0];
  selectedTilesetId = selected.id;
  return selected;
}

function setSelectedTileset(tilesetId: string): void {
  selectedTilesetId = tilesetId;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TILESET_SELECTION_KEY, tilesetId);
}

function readStoredSelectedTilesetId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TILESET_SELECTION_KEY);
}

function currentMapTilesetId(): string | null {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  return project.maps[mapId]?.tilesetId ?? null;
}
