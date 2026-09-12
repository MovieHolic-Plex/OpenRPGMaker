import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { TILE_CATEGORIES, filterTileIndexes, type TileCategoryId } from "@/editor/panels/tilePaletteFilter";
import { isDefaultTilesetTexture, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

/** The browser selects a brush; the owning object editor alone changes its raster. */
export function openTilesetTileBrowser(tileset: TilesetDef, selectedTile: number, onPick: (tile: number) => void): void {
  let selected = Math.min(Math.max(0, selectedTile), tileset.count - 1);
  let query = "";
  let category: TileCategoryId = "all";
  let size = 40;
  const pageSize = Math.max(tileset.tilesPerRow, Math.floor(256 / tileset.tilesPerRow) * tileset.tilesPerRow);
  let page = Math.max(0, Math.floor(selected / pageSize));
  const results = el("div", { class: "tile-browser-results" });
  const detail = el("aside", { class: "tile-browser-detail", attrs: { "aria-label": "선택한 타일" } });
  const count = el("span", { class: "asset-browser-count", attrs: { role: "status" } });
  const search = el("input", { class: "asset-browser-search", attrs: { type: "search", placeholder: "이름·설명·번호로 검색", "aria-label": "타일 검색" },
    dataset: { testid: "tile-browser-search" }, on: { input: event => {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      query = event.currentTarget.value; page = 0; render();
    } },
  });
  const categories = el("nav", { class: "tile-browser-categories", attrs: { "aria-label": "타일 분류" } });
  let close = (): void => {};
  const pick = (): void => { if (selected < 0) return; onPick(selected); close(); };
  const name = (tile: number): string => tileset.tileMeta?.[tile]?.label
    ?? (isDefaultTilesetTexture(tileset) ? describeChipsetTile(tile).label : `타일 ${tile}`);
  function showDetail(): void {
    if (selected < 0) { detail.replaceChildren(el("p", { text: "이 타일셋에는 타일이 없습니다." })); return; }
    detail.replaceChildren(el("div", { class: "tile-browser-large", attrs: { style: tilesetTileBackgroundStyle(tileset, selected, 144) } }),
      el("h3", { text: name(selected) }),
      el("p", { text: tileset.tileMeta?.[selected]?.description ?? "선택한 타일로 오브젝트를 그립니다." }),
      el("dl", { children: [el("dt", { text: "번호" }), el("dd", { text: String(selected) }), el("dt", { text: "원본 위치" }),
        el("dd", { text: `${selected % tileset.tilesPerRow + 1}열 · ${Math.floor(selected / tileset.tilesPerRow) + 1}행` })] }),
      button("이 타일 사용", pick, "tile-browser-use"));
  }
  function render(): void {
    const indexes = filterTileIndexes(tileset, { category, query, recent: [] });
    const pages = Math.max(1, Math.ceil(indexes.length / pageSize));
    page = Math.min(page, pages - 1);
    count.textContent = `${indexes.length}개 타일`;
    categories.replaceChildren(...TILE_CATEGORIES.filter(item => item.id !== "recent").map(item => {
      const node = button(item.label, () => { category = item.id; page = 0; render(); });
      node.classList.toggle("is-selected", item.id === category);
      node.setAttribute("aria-pressed", String(item.id === category));
      return node;
    }));
    const original = !query.trim() && category === "all";
    const grid = el("div", { class: `tile-browser-grid${original ? " is-sheet" : ""}`,
      attrs: { style: `--tile-browser-size:${size}px;--tile-browser-columns:${tileset.tilesPerRow}` },
      dataset: { testid: "tile-browser-grid" },
    });
    for (const tile of indexes.slice(page * pageSize, (page + 1) * pageSize)) {
      const node = el("button", { class: `tile-browser-tile${selected === tile ? " is-selected" : ""}`,
        attrs: { type: "button", "aria-label": `${name(tile)} (${tile})`, "aria-pressed": String(selected === tile), title: name(tile) },
        dataset: { tile: String(tile), testid: `tile-browser-tile-${tile}` },
        children: [el("span", { attrs: { style: tilesetTileBackgroundStyle(tileset, tile, size) } })],
        on: { click: () => {
          selected = tile;
          for (const candidate of grid.querySelectorAll<HTMLElement>(".tile-browser-tile")) {
            const active = candidate.dataset.tile === String(tile);
            candidate.classList.toggle("is-selected", active); candidate.setAttribute("aria-pressed", String(active));
          }
          showDetail();
        }, dblclick: () => { selected = tile; pick(); } },
      });
      grid.append(node);
    }
    results.replaceChildren(grid);
    if (!indexes.length) results.append(el("p", { class: "asset-browser-empty", text: "검색 결과가 없습니다. 검색어나 분류를 바꿔 보세요." }));
    if (pages > 1) {
      const previous = button("이전", () => { page--; render(); }); previous.disabled = page === 0;
      const next = button("다음", () => { page++; render(); }); next.disabled = page + 1 === pages;
      results.append(el("div", { class: "asset-browser-pagination", children: [previous, el("span", { text: `${page + 1} / ${pages}` }), next] }));
    }
  }
  const zoom = el("div", { class: "tile-browser-zoom", children: [
    el("span", { text: "타일 크기" }), ...[24, 40, 64].map(value => button(`${value}px`, () => { size = value; render(); })),
  ] });
  render(); showDetail();
  close = openDialog("tileset-tile-browser", "타일 브라우저", [
    el("div", { class: "tile-browser", children: [
      el("header", { class: "tile-browser-heading", children: [el("h2", { text: tileset.name || "타일셋" }), el("p", { text: "원본 배열 그대로 살펴보고, 필요한 타일을 크게 확인하세요. 두 번 누르면 바로 선택됩니다." })] }),
      el("div", { class: "tile-browser-toolbar", children: [search, categories, zoom, count] }),
      el("div", { class: "tile-browser-body", children: [results, detail] }),
    ] }),
  ], [{ label: "취소", testid: "tile-browser-cancel" }]);
}

function button(text: string, click: () => void, testid?: string): HTMLButtonElement {
  return el("button", { class: "asset-browser-button", text, attrs: { type: "button" },
    ...(testid ? { dataset: { testid } } : {}), on: { click } });
}
