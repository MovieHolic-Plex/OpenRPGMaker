import { editorState } from "@/editor/editorState";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { referenceOwner } from "@/project/tilesetReferences";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const TILESET_SELECTION_KEY = "oprn:database.selectedTilesetId";
let selectedTilesetId: string | null = null;
let listQuery = "";

/** Dedicated tile library: spatial placement controls do not apply to tilesets. */
export function renderTilesetsTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const tilesets = Object.values(project.tilesets);
  const selected = selectTileset(tilesets);
  const rows = el("div", { class: "tileset-library-rows" });
  const search = el("input", { value: listQuery, attrs: { type: "search", placeholder: "타일셋 검색", "aria-label": "타일셋 검색" }, dataset: { testid: "tileset-db-search" } });
  const renderRows = () => {
    rows.replaceChildren();
    for (const tileset of tilesets) {
      if (!`${tileset.name} ${tileset.id}`.toLocaleLowerCase().includes(listQuery.trim().toLocaleLowerCase())) continue;
      let docs = 0;
      try { docs = (referenceOwner(project, tileset).referenceDocuments ?? []).reduce((n, group) => n + group.documents.length, 0); } catch { /* Invalid ownership is explained in the reader. */ }
      rows.append(el("button", {
        class: `tileset-library-row${tileset.id === selected?.id ? " active" : ""}`,
        attrs: { type: "button", "aria-label": tileset.name, "aria-current": String(tileset.id === selected?.id) },
        dataset: { testid: `tileset-db-row-${tileset.id}` },
        on: { click: () => { setSelectedTileset(tileset.id); rerender(); } },
        children: [
          el("img", { attrs: { src: tilesetImageUrl(tileset), alt: "", loading: "lazy" } }),
          el("span", { children: [el("strong", { text: tileset.name }), el("small", { text: `${tileset.tileSize}×${tileset.tileSize} · ${docs ? `참고문서 ${docs}` : "참고문서 없음"}` })] }),
        ],
      }));
    }
    if (!rows.childElementCount) rows.append(el("p", { class: "tileset-library-empty", text: "일치하는 타일셋이 없습니다." }));
  };
  search.addEventListener("input", () => { listQuery = search.value; renderRows(); });
  renderRows();
  host.append(el("div", { class: "tileset-library", dataset: { testid: "db-tilesets-workspace" }, children: [
    el("aside", { class: "tileset-library-sidebar", children: [
      el("header", { children: [el("h2", { text: "타일" }), el("span", { text: String(tilesets.length) })] }),
      search, el("p", { class: "tileset-library-hint", text: "타일셋별 참고문서와 편집 규칙" }), rows,
    ] }),
    selected ? el("section", { class: "tileset-library-detail", dataset: { testid: "db-detail-form" }, children: [
      el("header", { class: "tileset-library-heading", children: [
        el("div", { children: [el("small", { text: "자료집 / 맵 / 타일" }), el("h2", { text: selected.name })] }),
        el("span", { class: "tileset-library-chip", text: `${selected.tileSize}×${selected.tileSize}px · ${selected.count.toLocaleString()} 타일` }),
      ] }), renderTilesetEditor(selected, rerender),
    ] }) : el("div", { class: "tileset-library-empty", text: "소재 관리자에서 타일셋을 가져오세요." }),
  ] }));
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

export function getSelectedTilesetId(): string | null {
  return selectedTilesetId ?? readStoredSelectedTilesetId() ?? currentMapTilesetId();
}

function setSelectedTileset(tilesetId: string): void {
  selectedTilesetId = tilesetId;
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(TILESET_SELECTION_KEY, tilesetId); } catch { /* Session selection still works when storage is unavailable. */ }
}

/** 테스트·세션 리셋용. 폴더 자식이 공유하는 칩셋 선택을 비운다. */
export function clearSelectedTileset(): void {
  selectedTilesetId = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TILESET_SELECTION_KEY);
  } catch {
    // 테스트 스텁이 localStorage 를 안 줄 수 있다.
  }
}

export { setSelectedTileset };

function readStoredSelectedTilesetId(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(TILESET_SELECTION_KEY); } catch { return null; }
}

function currentMapTilesetId(): string | null {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  return project.maps[mapId]?.tilesetId ?? null;
}
