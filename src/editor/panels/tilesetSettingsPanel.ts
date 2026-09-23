import { editorState } from "@/editor/editorState";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { TILESET_ART_STYLES, tilesetArtStyle, type TilesetArtStyleId } from "@/project/tilesetArtStyle";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const TILESET_SELECTION_KEY = "oprn:database.selectedTilesetId";
let selectedTilesetId: string | null = null;
let listQuery = "";
const collapsedArtStyles = new Set<TilesetArtStyleId>(TILESET_ART_STYLES.map((style) => style.id).filter((id) => id !== "easyrpg"));

/** Dedicated tile library: spatial placement controls do not apply to tilesets. */
export function renderTilesetsTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const tilesets = Object.values(project.tilesets);
  const selected = selectTileset(tilesets);
  const rows = el("div", { class: "tileset-library-rows" });
  const search = el("input", { value: listQuery, attrs: { type: "search", placeholder: "타일셋 검색", "aria-label": "타일셋 검색" }, dataset: { testid: "tileset-db-search" } });
  const renderRows = () => {
    rows.replaceChildren();
    const query = listQuery.trim().toLocaleLowerCase();
    const visible = tilesets.filter((tileset) => `${tileset.name} ${tileset.id}`.toLocaleLowerCase().includes(query));
    for (const style of TILESET_ART_STYLES) {
      const members = visible.filter((tileset) => tilesetArtStyle(tileset, tilesets) === style.id);
      if (members.length === 0) continue;
      const expanded = query.length > 0 || !collapsedArtStyles.has(style.id);
      const group = el("section", { class: "tileset-library-style", dataset: { testid: `tileset-style-${style.id}` } });
      group.append(el("button", {
        class: "tileset-library-style-head",
        attrs: { type: "button", "aria-expanded": String(expanded) },
        on: { click: () => { if (collapsedArtStyles.has(style.id)) collapsedArtStyles.delete(style.id); else collapsedArtStyles.add(style.id); renderRows(); } },
        children: [
          el("span", { class: "tileset-library-style-chev", text: expanded ? "▾" : "▸", attrs: { "aria-hidden": "true" } }),
          el("strong", { text: style.label }),
          el("em", { text: String(members.length) }),
        ],
      }));
      if (expanded) {
        for (const tileset of members) {
          group.append(el("button", {
            class: `tileset-library-row${tileset.id === selected?.id ? " active" : ""}`,
            attrs: { type: "button", "aria-label": tileset.name, "aria-current": String(tileset.id === selected?.id) },
            dataset: { testid: `tileset-db-row-${tileset.id}` },
            on: { click: () => { setSelectedTileset(tileset.id); rerender(); } },
            children: [
              el("img", { attrs: { src: tilesetImageUrl(tileset), alt: "", loading: "lazy", style: `object-position:${thumbAnchor(tileset.id)}` } }),
              el("span", { children: [el("strong", { text: shortTilesetLabel(tileset.name) }), el("small", { text: `${tileset.tileSize}×${tileset.tileSize} · ${tileset.count.toLocaleString()}칸` })] }),
            ],
          }));
        }
      }
      rows.append(group);
    }
    if (!rows.childElementCount) rows.append(el("p", { class: "tileset-library-empty", text: "일치하는 타일셋이 없습니다." }));
  };
  search.addEventListener("input", () => { listQuery = search.value; renderRows(); });
  renderRows();
  host.append(el("div", { class: "tileset-library", dataset: { testid: "db-tilesets-workspace" }, children: [
    el("aside", { class: "tileset-library-sidebar", children: [
      el("header", { children: [el("h2", { text: "타일" }), el("span", { text: String(tilesets.length) })] }),
      search, el("p", { class: "tileset-library-hint", text: "화풍별로 묶여 있습니다." }), rows,
    ] }),
    selected ? el("section", { class: "tileset-library-detail", dataset: { testid: "db-detail-form" }, children: [
      el("header", { class: "tileset-library-heading", children: [
        el("div", { children: [el("small", { text: "자료집 / 맵 / 타일" }), el("h2", { text: selected.name })] }),
        el("span", { class: "tileset-library-chip", text: `${selected.tileSize}×${selected.tileSize}px · ${selected.count.toLocaleString()} 타일` }),
      ] }), ...renderAtlasPreview(selected), renderTilesetEditor(selected, rerender),
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
  return mapId ? project.maps[mapId]?.tilesetId ?? null : null;
}

function shortTilesetLabel(name: string): string {
  return name
    .replace(/\s*·\s*EasyRPG\s*\([^)]*\)/u, "")
    .replace(/\s*·\s*OpenGameArt\s*\([^)]*\)/u, "")
    .replace(/\s*·\s*Ivan Voirol\s*\([^)]*\)/u, "")
    .replace(/\s*ChipSet$/u, "")
    .trim();
}

function thumbAnchor(id: string): string {
  if (id === "forest_harmony") return "0% 42%";
  if (id === "tibo_interior_expanded" || id.startsWith("tileset_") || id.startsWith("interior_")) return "0% 46%";
  if (id.includes("dungeon")) return "40% 25%";
  if (id.includes("castle")) return "15% 35%";
  if (id.includes("scarloxy")) return "45% 0%";
  if (id.includes("modern")) return "12% 25%";
  if (id.includes("lpc")) return "0% 8%";
  return "0% 0%";
}

/**
 * 숲 시트에 붙은 선별 소품 안내만 남긴다. 예전엔 모든 타일셋 위에 「시트 · 타일셋 하나」 띠로
 * 시트를 한 번 더 잘라 보였는데, 바로 아래 통행·자동 연결 탭이 같은 시트를 칸 단위로 전부 그린다.
 * 같은 그림 두 장이 화면 위쪽 170px 을 먹었다(2026-09-23 사용자 지적).
 */
function renderAtlasPreview(tileset: TilesetDef): HTMLElement[] {
  const imageUrl = tilesetImageUrl(tileset);
  const bands: HTMLElement[] = [];
  const props = (tileset.structureKits ?? []).filter((kit) => kit.id.startsWith("shared-village:"));
  if (tileset.id === "forest_harmony" && props.length > 0) {
    bands.push(el("article", { class: "tileset-library-band", dataset: { testid: "forest-selected-props" }, children: [
      el("header", { children: [el("strong", { text: "선별 소품 19종" }), el("span", { text: "같은 타일셋 · 2550번부터" })] }),
      el("div", { class: "tileset-library-prop-row", children: [
        el("div", { class: "tileset-library-prop-crop", attrs: { style: `background-image:url("${imageUrl}")` } }),
        el("div", { class: "tileset-library-prop-names", children: props.map((kit) => el("i", { text: kit.name })) }),
      ] }),
      el("p", { class: "tileset-library-prop-note", text: "왼쪽 목록의 줄이 아닙니다. 이 숲 시트의 아래 구간입니다." }),
    ] }));
  }
  return bands.length ? [el("div", { class: "tileset-library-atlas", children: bands })] : [];
}
