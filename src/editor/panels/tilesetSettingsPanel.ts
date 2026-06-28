import { editorState } from "@/editor/editorState";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const TILESET_SELECTION_KEY = "rpg-zzu.database.selectedTilesetId";

let selectedTilesetId: string | null = null;

export function renderTilesetsTab(host: HTMLElement, rerender: () => void): void {
  const tilesets = Object.values(store.getCurrent().tilesets);
  const selected = selectTileset(tilesets);
  if (!selected) {
    host.append(
      el("section", {
        class: "db-detail-form",
        dataset: { testid: "db-detail-form" },
        text: "타일셋이 없습니다.",
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
    class: "db-detail-form tileset-db-workspace compact rm2k3-tileset-workspace",
    dataset: { testid: "db-detail-form" },
    children: [renderTilesetList(tilesets, selected.id, rerender), renderTilesetEditor(selected, rerender)],
  });
}

function renderTilesetList(tilesets: readonly TilesetDef[], selectedId: string, rerender: () => void): HTMLElement {
  const rows = tilesets.map((tileset, index) =>
    el("button", {
      class: `tileset-db-list-row${tileset.id === selectedId ? " active" : ""}`,
      text: `${recordNumber(index)}:${tileset.name}`,
      attrs: { type: "button" },
      dataset: { testid: `tileset-db-row-${tileset.id}` },
      on: {
        click: () => {
          setSelectedTileset(tileset.id);
          rerender();
        },
      },
    }),
  );
  return el("aside", {
    class: "tileset-db-list rm2k3-tileset-list-pane",
    children: [
      el("div", { class: "tileset-db-panel-title", text: "타일셋" }),
      el("div", { class: "tileset-db-listbox", children: rows }),
      el("button", {
        class: "database-footer-button rm2k3-maximum-button disabled",
        text: "최대 개수",
        attrs: { type: "button", disabled: "true", title: "타일셋 최대 개수 조정은 아직 지원하지 않습니다." },
        dataset: { testid: "tileset-rm2k3-maximum-count" },
      }),
    ],
  });
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

function recordNumber(index: number): string {
  return String(index + 1).padStart(4, "0");
}
