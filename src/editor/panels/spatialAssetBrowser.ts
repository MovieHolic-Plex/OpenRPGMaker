import { spatialProjectKey, patchSpatialSession, selectSpatialDesign, type SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { listSpatialGalleryCards, type SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { deferredSpatialCardThumb } from "@/editor/panels/spatialCardThumbs";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import { renderSpatialInspector, renderSpatialChrome, renderSpatialSourceChips } from "@/editor/panels/spatialStage";
import { tilesetListThumb } from "@/editor/panels/tilesetListThumb";
import { addBlankObject } from "@/editor/panels/spatialObjectMutations";
import { el } from "@/util/dom";

type BrowserState = {
  query: string;
  tilesetId: string | null;
  page: number;
  selection?: string;
  railScrollTop: number;
  resultsScrollTop: number;
};
const states = new Map<string, BrowserState>();
let browserScrollEpoch = 0;
const PAGE_SIZE = 48;

export function filterSpatialBrowserCards(cards: readonly SpatialGalleryCard[], query: string, tilesetId: string | null): readonly SpatialGalleryCard[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter(card => (!tilesetId || card.tilesetId === tilesetId)
    && words.every(word => `${card.name} ${card.subtitle ?? ""}`.toLocaleLowerCase().includes(word)));
}

export function renderSpatialAssetBrowser(session: SpatialAuthoringSession, selected: SpatialGalleryCard | undefined, rerender: () => void): HTMLElement {
  const key = `${spatialProjectKey()}:${session.tab}`;
  let saved = states.get(key);
  if (!saved) {
    saved = { query: "", tilesetId: null, page: 0, railScrollTop: 0, resultsScrollTop: 0 };
    states.set(key, saved);
  }
  const state = saved;
  const pageBeforeSelection = state.page;
  const project = visibleAuthoringProject();
  const cards = [...listSpatialGalleryCards(session)].sort((a, b) => Number(b.source === "own") - Number(a.source === "own"));
  if (selected && state.selection !== selected.id) {
    state.selection = selected.id;
    if (!filterSpatialBrowserCards(cards, state.query, state.tilesetId).some(card => card.id === selected.id)) {
      state.query = ""; state.tilesetId = null;
    }
    const index = filterSpatialBrowserCards(cards, state.query, state.tilesetId).findIndex(card => card.id === selected.id);
    state.page = Math.max(0, Math.floor(index / PAGE_SIZE));
  }
  if (state.page !== pageBeforeSelection) state.resultsScrollTop = 0;
  const noun = "오브젝트";
  const title = el("div", { class: "asset-browser-heading", children: [
    el("h2", { text: `${noun} 라이브러리` }),
    el("p", { text: "공용 오브젝트에서 가구와 소품을 골라 배치하거나, 복제해 내 오브젝트로 편집하세요." }),
  ] });
  const chrome = renderSpatialChrome(session, rerender, { browser: true, onAdd: () => addBlankObject(rerender, state.tilesetId ?? undefined) });
  const results = el("div", { class: "asset-browser-results", dataset: { testid: "spatial-browser-results" } });
  const count = el("span", { class: "asset-browser-count", attrs: { role: "status", "aria-live": "polite" } });
  const search = el("input", {
    class: "asset-browser-search", value: state.query,
    attrs: { type: "search", placeholder: `${noun} 이름으로 검색`, "aria-label": `${noun} 검색` },
    dataset: { testid: "spatial-browser-search" },
    on: { input: (event) => {
      const input = event.currentTarget;
      if (!(input instanceof HTMLInputElement)) return;
      state.query = input.value; state.page = 0; renderResults();
    } },
  });
  const rail = el("nav", { class: "asset-browser-rail", attrs: { "aria-label": "타일셋" }, dataset: { testid: "spatial-browser-tilesets" } });
  const chooseTileset = (id: string | null): void => {
    state.tilesetId = id; state.page = 0;
    renderRail(); renderResults();
  };
  function renderRail(): void {
    rail.replaceChildren(el("h3", { text: "타일셋" }), el("button", {
      class: `asset-browser-tileset${state.tilesetId === null ? " is-selected" : ""}`,
      attrs: { type: "button", "aria-pressed": String(state.tilesetId === null) },
      dataset: { testid: "spatial-browser-tileset-all" },
      children: [el("span", { text: "모든 타일셋" }), el("small", { text: String(cards.length) })],
      on: { click: () => chooseTileset(null) },
    }), ...Object.values(project.tilesets).map(tileset => {
      const total = cards.filter(card => card.tilesetId === tileset.id).length;
      return el("button", {
        class: `asset-browser-tileset${state.tilesetId === tileset.id ? " is-selected" : ""}`,
        attrs: { type: "button", "aria-pressed": String(state.tilesetId === tileset.id) },
        dataset: { tilesetId: tileset.id },
        children: [tilesetListThumb(tileset),
          el("span", { text: tileset.name || "이름 없는 타일셋" }), el("small", { text: String(total) })],
        on: { click: () => chooseTileset(tileset.id) },
      });
    }));
  }
  function renderResults(): void {
    const matches = filterSpatialBrowserCards(cards, state.query, state.tilesetId);
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages - 1);
    count.textContent = `${matches.length}개`;
    const grid = el("div", { class: "asset-browser-grid", dataset: { testid: "spatial-gallery" } });
    if (!matches.length) grid.append(el("div", { class: "asset-browser-empty", children: [
      el("h3", { text: state.query ? "검색 결과가 없습니다" : `이 타일셋에는 ${noun}가 없습니다` }),
      el("p", { text: "다른 타일셋을 선택하거나 검색어를 바꿔 보세요." }),
    ] }));
    for (const card of matches.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE)) {
      // 검색 입력·카드 선택마다 이 목록이 통째로 다시 그려진다 — 썸네일은 보일 때 굽는다.
      const art = el("div", {
        class: "asset-browser-card-art",
        children: [deferredSpatialCardThumb(card, () => renderSpatialCardThumb(card))],
      });
      grid.append(el("button", {
        class: `asset-browser-card${selected?.id === card.id ? " is-selected" : ""}`,
        attrs: { type: "button", "aria-pressed": String(selected?.id === card.id) },
        dataset: { cardId: card.id, testid: `spatial-card-${card.id}`, source: card.source },
        children: [art, el("strong", { text: card.name }), el("span", {
          // 분류가 있으면(공용 카탈로그 분류·일본 실내 방 분류) 그걸 보인다 — 출처는 위 출처 칩이 이미 거른다.
          text: card.subtitle ?? (card.source === "default" ? "공용 오브젝트" : card.compatibility ? "방 템플릿" : "내가 만든 항목"),
        })],
        on: { click: () => {
          state.railScrollTop = rail.scrollTop;
          state.resultsScrollTop = results.scrollTop;
          browserScrollEpoch += 1;
          selectSpatialDesign(card.id); patchSpatialSession({ inspectorOpen: true }); rerender();
        } },
      }));
    }
    const navigation = el("div", { class: "asset-browser-pagination", children: [
      pageButton("이전", state.page > 0, () => { state.page--; renderResults(); }),
      el("span", { text: `${state.page + 1} / ${pages}` }),
      pageButton("다음", state.page + 1 < pages, () => { state.page++; renderResults(); }),
    ] });
    results.replaceChildren(grid, ...(pages > 1 ? [navigation] : []));
  }
  renderRail(); renderResults();
  const controls = el("div", { class: "asset-browser-filters", children: [
    search,
    renderSpatialSourceChips(session, source => {
      state.page = 0;
      state.resultsScrollTop = 0;
      browserScrollEpoch += 1;
      patchSpatialSession({ source });
      rerender();
    }), count,
  ] });
  const detail = el("section", { class: "asset-browser-detail", attrs: { "aria-label": `${noun} 편집` } });
  detail.append(renderSpatialInspector(selected, true, rerender));
  const collection = el("section", { class: "asset-browser-collection", attrs: { "aria-label": `${noun} 목록` }, children: [
    controls, results,
  ] });
  const shell = el("div", {
    class: "spatial-shell spatial-asset-browser", dataset: { testid: `spatial-shell-${session.tab}` },
    attrs: { tabindex: "0" },
    children: [el("header", { class: "asset-browser-top", children: [title, chrome] }),
      el("div", { class: "asset-browser-body", children: [rail, collection, detail] })],
  });
  restoreBrowserScroll(rail, results, state);
  return shell;
}

function restoreBrowserScroll(rail: HTMLElement, results: HTMLElement, state: BrowserState): void {
  const railTop = state.railScrollTop;
  const resultsTop = state.resultsScrollTop;
  const epoch = browserScrollEpoch;
  const apply = (): void => {
    if (railTop > 0 && rail.isConnected) rail.scrollTop = railTop;
    if (resultsTop > 0 && results.isConnected) results.scrollTop = resultsTop;
  };
  // 셸은 이 함수가 돌아온 뒤에야 문서에 붙는다. 붙기 전 scrollTop 대입은 무시된다.
  // 이전 목록이 사라지며 쏘는 scroll 0 은 세대가 달라 저장값을 덮지 못한다.
  queueMicrotask(() => {
    apply();
    const remember = (node: HTMLElement, write: (top: number) => void): void => {
      node.addEventListener("scroll", () => {
        if (epoch !== browserScrollEpoch) return;
        if (node.scrollHeight <= node.clientHeight) return;
        write(node.scrollTop);
      }, { passive: true });
    };
    remember(rail, (top) => { state.railScrollTop = top; });
    remember(results, (top) => { state.resultsScrollTop = top; });
  });
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(apply);
}

function pageButton(text: string, enabled: boolean, click: () => void): HTMLButtonElement {
  return el("button", { class: "asset-browser-button", text,
    attrs: { type: "button", ...(enabled ? {} : { disabled: "" }) }, on: { click } });
}
