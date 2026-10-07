import "@/styles/database/left-props-pane.css";
import { editorState } from "@/editor/editorState";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { filterProps, PROP_CATEGORIES, propRecommendationContext, recommendProps, type PropCategoryId, type PropChoice, type PropRecommendation } from "@/editor/propRecommendations";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { selectPaletteStamp } from "@/editor/panels/tileToolbarActions";
import { isTileCellChange, store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const PAGE_SIZE = 6;

/** The activity bar's quick picker shares the existing object catalogs and stamp painter. */
export function createLeftPropsPane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-props-pane", attrs: { "aria-label": "기물" }, dataset: { testid: "left-props-pane" } });
  let tileset: TilesetDef | undefined;
  let contextKey = "";
  let choices: readonly PropRecommendation[] = [];
  let visibleCount = PAGE_SIZE;
  let category: "recommended" | "all" | PropCategoryId = "recommended";
  let query = "";
  let categorySelect: HTMLSelectElement | null = null;
  let listTitle: HTMLElement | null = null;
  let resultCount: HTMLElement | null = null;
  let noResults: HTMLElement | null = null;
  let grid: HTMLElement | null = null;
  let status: HTMLElement | null = null;
  let lastTileset: TilesetDef | undefined;
  let lastContext: string | null = null;
  let selectionKey: string | null = null;
  let queued = false;
  let disposed = false;

  function current() {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    const map = mapId ? project.maps[mapId] : undefined;
    return { map, tileset: map ? project.tilesets[map.tilesetId] : undefined };
  }

  function clearForeignStamp(): void {
    const stamp = editorState.get().activePaletteStamp;
    const next = current();
    if (stamp?.source.tilesetId && (stamp.source.tilesetId !== next.tileset?.id
      || stamp.source.tileSize !== next.map?.tileSize || stamp.source.tileSize !== next.tileset?.tileSize)) {
      editorState.set({ activePaletteStamp: null });
    }
  }

  function selected(choice: PropChoice): boolean {
    const active = editorState.get().activePaletteStamp;
    return Boolean(active && choice && active.source.tilesetId === tileset?.id
      && (choice.stamp.origin === "curated" ? active.origin === "curated" && active.label === choice.name : active.kitId === choice.id));
  }

  function syncSelection(): void {
    if (root.hidden || !grid || !status) return;
    const active = choices.find(entry => selected(entry.choice))?.choice;
    const key = active?.id ?? "";
    if (selectionKey === key) return;
    selectionKey = key;
    for (const button of grid.querySelectorAll<HTMLButtonElement>("[data-prop-id]")) {
      button.setAttribute("aria-pressed", String(button.dataset.propId === active?.id));
    }
    status.replaceChildren(
      ...(active ? [el("strong", { attrs: { translate: "no" }, text: active.name })] : []),
      el("span", { text: active ? "고른 기물을 맵에 놓으세요." : "기물을 고른 뒤 맵을 클릭해 놓으세요." }),
    );
  }

  function card(entry: PropRecommendation): HTMLButtonElement {
    const { choice } = entry;
    const stamp = choice.stamp;
    const sourceTileset = tileset!;
    const preview = renderTileCellsToCanvas({
      tileset: sourceTileset, widthTiles: stamp.width, heightTiles: stamp.height, cells: stamp.cells,
      scale: Math.min(3, 72 / (16 * Math.max(stamp.width, stamp.height))),
      backgroundTile: null, transparentBackground: true,
    });
    preview.setAttribute("aria-hidden", "true");
    return el("button", {
      class: "left-props-card",
      attrs: { type: "button", "aria-pressed": String(selected(choice)) },
      dataset: { testid: "left-props-card", propId: choice.id },
      children: [
        el("span", { class: "left-props-preview", children: [preview] }),
        el("span", { class: "left-props-name", attrs: { translate: "no" }, text: choice.name }),
        el("span", { class: "left-props-size", text: `${stamp.width}×${stamp.height}` }),
        el("span", { class: "left-props-reason", text: entry.matchesPlace ? "맵의 장소에 어울림" : "이 칩셋에서 사용" }),
      ],
      on: { click: () => {
        // A stale button must never select a stamp from a different map's chipset.
        if (current().tileset !== sourceTileset) return;
        if (editorState.get().layer === "event") editorState.set({ layer: stamp.cells[0]!.layer });
        selectPaletteStamp(choice.stamp);
      } },
    }) as HTMLButtonElement;
  }

  function fillGrid(): void {
    const filtered = filterProps(choices, category === "recommended" || category === "all" ? undefined : category, query);
    grid?.replaceChildren(...filtered.slice(0, visibleCount).map(card));
    if (categorySelect) categorySelect.value = category;
    if (listTitle) listTitle.textContent = category === "recommended" ? "이 맵에 어울리는 기물"
      : PROP_CATEGORIES.find(kind => kind.id === category)?.label ?? "기물 목록";
    if (resultCount) resultCount.textContent = `(${filtered.length})`;
    if (noResults) noResults.hidden = filtered.length !== 0;
    const more = root.querySelector<HTMLButtonElement>("[data-testid='left-props-more']");
    if (more) more.hidden = visibleCount >= filtered.length;
    selectionKey = null;
    syncSelection();
  }

  function render(): void {
    if (root.hidden || disposed) return;
    const next = current();
    const key = next.map ? `${next.map.id}|${next.map.width}x${next.map.height}|${next.map.tileSize}|${propRecommendationContext(next.map)}` : "";
    if (next.tileset === lastTileset && key === lastContext) { syncSelection(); return; }
    lastTileset = tileset = next.tileset;
    lastContext = key;
    if (contextKey !== key) visibleCount = PAGE_SIZE;
    contextKey = key;
    grid = status = null;
    if (!next.map || !tileset) {
      root.replaceChildren(el("p", { class: "left-props-empty", text: "맵을 열면 이 맵에서 쓸 기물을 볼 수 있습니다." }));
      return;
    }
    choices = recommendProps(next.map, tileset);
    const available = PROP_CATEGORIES.filter(kind => choices.some(entry => entry.choice.category === kind.id));
    if (category !== "recommended" && category !== "all" && !available.some(kind => kind.id === category)) category = "all";
    categorySelect = el("select", {
      attrs: { "aria-label": "기물 종류" }, dataset: { testid: "left-props-category" },
      children: [el("option", { value: "recommended", text: "맵 추천" }), el("option", { value: "all", text: "전체 종류" }),
        ...available.map(kind => el("option", { value: kind.id, text: kind.label }))],
      on: { change: () => {
        category = categorySelect!.value as typeof category;
        visibleCount = PAGE_SIZE;
        root.scrollTop = 0;
        fillGrid();
      } },
    });
    const search = el("input", {
      attrs: { type: "search", "aria-label": "기물 검색", placeholder: "의자, 침대, 나무…", autocomplete: "off" },
      value: query, dataset: { testid: "left-props-search" },
      on: { input: () => {
        query = search.value;
        // Starting a search reaches all objects, including those beyond the six recommendations.
        category = "all";
        visibleCount = PAGE_SIZE;
        fillGrid();
      } },
    });
    listTitle = el("h3", { class: "left-props-title" });
    resultCount = el("span", { class: "left-props-result-count", attrs: { translate: "no" } });
    noResults = el("p", { class: "left-props-empty", text: "검색 결과가 없습니다.", dataset: { testid: "left-props-no-results" } });
    grid = el("div", { class: "left-props-grid", attrs: { role: "group", "aria-label": "기물 목록" } });
    status = el("div", { class: "left-props-selection", attrs: { "aria-live": "polite" }, dataset: { testid: "left-props-selection" } });
    root.replaceChildren(
      el("header", { class: "left-props-head", children: [el("h2", { text: "기물" }), el("span", { attrs: { translate: "no" }, text: next.map.name })] }),
      el("div", { class: "left-props-context", children: [el("span", { text: "현재 맵의 칩셋" }), el("strong", { attrs: { translate: "no" }, text: tileset.name })] }),
      ...(choices.length ? [
        el("div", { class: "left-props-browser", children: [
          el("label", { children: [el("span", { text: "기물 검색" }), search] }),
          el("label", { class: "left-props-category-row", children: [el("span", { text: "종류별로 보기" }), categorySelect] }),
        ] }),
        el("div", { class: "left-props-results-head", children: [listTitle, resultCount] }), noResults, grid, el("button", {
        class: "btn left-props-more", attrs: { type: "button" }, text: "다른 기물 더 보기", dataset: { testid: "left-props-more" },
        on: { click: () => { visibleCount += PAGE_SIZE; fillGrid(); } },
      }), status] : [el("p", { class: "left-props-empty", text: "이 칩셋에는 등록된 기물이 없습니다. 자료집의 구조물에서 기물을 등록할 수 있습니다." })]),
    );
    fillGrid();
  }

  function schedule(): void {
    if (root.hidden || queued || disposed) return;
    queued = true;
    const run = () => { queued = false; render(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else queueMicrotask(run);
  }
  const unsubscribeEditor = editorState.subscribe(() => { clearForeignStamp(); schedule(); });
  const unsubscribeStore = store.subscribe((_project, change) => { clearForeignStamp(); if (!isTileCellChange(change)) schedule(); });
  return { root, show: render, dispose: () => { disposed = true; unsubscribeEditor(); unsubscribeStore(); } };
}
