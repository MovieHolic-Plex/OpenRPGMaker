// panels/comboBrushShelf.ts
// 지형 도구탭의 「조합」 선반 — 큐레이션된 Combo Brush 를 **그림과 이름**으로 고른다.
//
// 왜 별 선반인가 (OPRN-OUT-022 의 2차 개선 부채): 조합을 쓰려면 사용자가 매번 팔레트에서
// 원시 타일 사각형을 다시 찾아내야 했다. 나무 한 그루가 수관 260 + 밑동 290 이라는 사실은
// 화면 어디에도 없었다. 이 선반은 그 지식을 **기능 단위**로 내놓는다 —
// 사용자는 타일 번호를 한 번도 입력하지 않는다.
//
// 목록의 정본은 `@/editor/comboBrushCatalog` 하나뿐이다. 여기서는 목록을 만들지 않는다.

import { editorState } from "@/editor/editorState";
import { comboBrushBadge } from "@/editor/comboBrush";
import {
  COMBO_BRUSH_CATEGORIES,
  curatedComboBrushesForTileset,
  comboBrushStampFromCatalog,
  type ComboBrushCatalogEntry,
} from "@/editor/comboBrushCatalog";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { selectCuratedComboBrush } from "@/editor/panels/tileToolbarActions";
import { isDefaultTilesetTexture } from "@/editor/tilesetImage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export type ComboBrushShelfInput = {
  readonly rerender: () => void;
  readonly tileset: TilesetDef;
};

/** 이 타일셋에서 노출할 큐레이션 조합 — 기본 칩셋 밖에서는 빈 목록이다. */
export function comboBrushShelfEntries(tileset: TilesetDef): readonly ComboBrushCatalogEntry[] {
  return curatedComboBrushesForTileset({
    isDefaultChipset: isDefaultTilesetTexture(tileset),
    tileCount: tileset.count,
  });
}

/** 쓸 조합이 없으면 null — 팔레트에 빈 섹션을 만들지 않는다(구조 킷 선반과 같은 규약). */
export function makeComboBrushShelf(input: ComboBrushShelfInput): HTMLElement | null {
  const entries = comboBrushShelfEntries(input.tileset);
  if (entries.length === 0) return null;

  const shelf = el("div", {
    class: "combo-brush-shelf panel-subsection",
    dataset: { testid: "combo-brush-shelf" },
  });
  shelf.append(
    el("p", {
      class: "combo-brush-shelf-note",
      text: "검토를 통과한 조합만 실립니다 — 타일 번호를 입력할 필요가 없습니다.",
      dataset: { testid: "combo-brush-shelf-note" },
    })
  );
  const active = editorState.get().activePaletteStamp;
  for (const category of COMBO_BRUSH_CATEGORIES) {
    const inCategory = entries.filter((entry) => entry.category === category.id);
    if (inCategory.length === 0) continue;
    shelf.append(
      el("div", {
        class: "combo-brush-shelf-title",
        text: category.label,
        dataset: { testid: `combo-brush-category-${category.id}` },
      })
    );
    const grid = el("div", { class: "combo-brush-shelf-grid" });
    for (const entry of inCategory) {
      grid.append(makeComboBrushButton(entry, input, active?.origin === "curated" && active.label === entry.name));
    }
    shelf.append(grid);
  }
  return shelf;
}

function makeComboBrushButton(
  entry: ComboBrushCatalogEntry,
  input: ComboBrushShelfInput,
  active: boolean,
): HTMLElement {
  const icon = renderTileCellsToCanvas({
    tileset: input.tileset,
    widthTiles: entry.width,
    heightTiles: entry.height,
    cells: entry.cells.map((cell) => ({ dx: cell.dx, dy: cell.dy, layer: cell.layer, tile: cell.tile })),
    scale: 2,
  });
  icon.className = "combo-brush-icon";
  // 배지 문구는 comboBrushBadge 한 곳에서만 나온다 — 선반과 사이드바가 같은 말을 쓴다.
  const badge = comboBrushBadge(comboBrushStampFromCatalog(entry));
  return el("button", {
    class: "combo-brush-cell" + (active ? " active" : ""),
    attrs: {
      type: "button",
      title: `${entry.name} — ${badge}\n${entry.note}`,
      "aria-label": `${entry.name} ${badge}`,
      "aria-pressed": String(active),
    },
    dataset: { testid: `combo-brush-${entry.id}`, comboBrushId: entry.id },
    children: [
      icon,
      el("span", { class: "combo-brush-cell-name", text: entry.name }),
      el("span", { class: "combo-brush-cell-size", text: `${entry.width}×${entry.height}` }),
    ],
    on: {
      click: () => {
        selectCuratedComboBrush(entry, input.tileset);
        input.rerender();
      },
    },
  });
}
