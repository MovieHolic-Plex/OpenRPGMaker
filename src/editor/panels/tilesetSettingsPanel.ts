import { textControl } from "@/editor/panels/databaseControls";
import { renderTilesetMetadataEditor } from "@/editor/panels/tilesetMetadataEditor";
import { openTilesetSettingsModal } from "@/editor/panels/tilesetPassageModal";
import { store } from "@/project/store";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const TILESET_SELECTION_KEY = "rpg-zzu.database.selectedTilesetId";

let selectedTilesetId: string | null = null;

export function renderTilesetsTab(host: HTMLElement, rerender: () => void): void {
  const tilesets = Object.values(store.getCurrent().tilesets);
  const selected = selectTileset(tilesets);
  host.append(el("h3", { text: "타일셋" }));
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
    class: "db-detail-form tileset-db-workspace compact",
    dataset: { testid: "db-detail-form" },
    children: [renderTilesetList(tilesets, selected.id, rerender), renderTilesetEditor(selected, rerender)],
  });
}

function renderTilesetList(tilesets: readonly TilesetDef[], selectedId: string, rerender: () => void): HTMLElement {
  const rows = tilesets.map((tileset, index) =>
    el("button", {
      class: `tileset-db-list-row${tileset.id === selectedId ? " active" : ""}`,
      text: `${index + 1}: ${tileset.name}`,
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
    class: "tileset-db-list",
    children: [
      el("div", { class: "tileset-db-panel-title", text: "타일셋 목록" }),
      el("div", { class: "tileset-db-listbox", children: rows }),
    ],
  });
}

function renderTilesetEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("section", {
    class: "tileset-db-editor simplified",
    children: [
      renderTilesetProperties(tileset, rerender),
      renderTilesetMetadataEditor(tileset, rerender),
    ],
  });
}

function renderTilesetProperties(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-db-properties",
    children: [
      textControl("이름", tileset.name, (value) => updateTilesetName(tileset.id, value)),
      el("div", { class: "tileset-db-resource", text: `칩셋 파일: ${tileset.image.id}` }),
      el("div", { class: "tileset-db-resource", text: passageSummary(tileset) }),
      el("button", {
        class: "btn primary tileset-settings-open",
        text: "통행 설정",
        attrs: { type: "button", title: "통행 상세 설정" },
        dataset: { testid: "tileset-settings-open" },
        on: { click: () => openTilesetSettingsModal(tileset.id, rerender) },
      }),
    ],
  });
}

function updateTilesetName(tilesetId: string, value: string): void {
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (target) target.name = value;
  });
}

function selectTileset(tilesets: readonly TilesetDef[]): TilesetDef | undefined {
  if (tilesets.length === 0) {
    selectedTilesetId = null;
    return undefined;
  }
  const storedId = selectedTilesetId ?? readStoredSelectedTilesetId();
  const selected = tilesets.find((tileset) => tileset.id === storedId) ?? tilesets[0];
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

function passageSummary(tileset: TilesetDef): string {
  const marks = Array.from({ length: tileset.count }, (_, index) => passageMarkForTile(tileset, index));
  const open = marks.filter((mark) => mark === "o").length;
  const blocked = marks.filter((mark) => mark === "x").length;
  const upper = marks.filter((mark) => mark === "star").length;
  return `통행 O ${open} / X ${blocked} / ★ ${upper}`;
}
