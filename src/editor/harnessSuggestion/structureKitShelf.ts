// harnessSuggestion/structureKitShelf.ts
// §④ⓐ 팔레트 — 등록된 킷은 "미니 조립 렌더 아이콘"으로 고른다.
// 이름·번호가 아니라 생김새가 주인공: 아이콘 = 킷을 3단위쯤 이어붙인 실렌더.

import { editorState } from "@/editor/editorState";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import type { StructureKitDef, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export type StructureKitShelfInput = {
  readonly tileset: TilesetDef;
  readonly activeKitId: string | null;
  readonly rerender: () => void;
};

/** 아이콘 조립 폭 상한(타일) — 킷 단위를 이 폭 안에서 최대한 반복해 보여준다. */
const ICON_MAX_COLUMNS = 6;

/** 등록된 킷이 없으면 null — 팔레트에 빈 섹션을 만들지 않는다(조용함 유지). */
export function makeStructureKitShelf(input: StructureKitShelfInput): HTMLElement | null {
  const kits = input.tileset.structureKits ?? [];
  if (kits.length === 0) return null;

  const shelf = el("div", {
    class: "structure-kit-shelf panel-subsection",
    dataset: { testid: "structure-kit-shelf" },
  });
  shelf.append(el("div", { class: "structure-kit-shelf-title", text: "내 스탬프" }));
  const grid = el("div", { class: "structure-kit-shelf-grid" });
  for (const kit of kits) {
    grid.append(makeKitButton(kit, input));
  }
  shelf.append(grid);
  return shelf;
}

function makeKitButton(kit: StructureKitDef, input: StructureKitShelfInput): HTMLElement {
  const active = input.activeKitId === kit.id;
  const unitWidth = Math.max(1, kit.width);
  const columns = unitWidth * Math.max(1, Math.floor(ICON_MAX_COLUMNS / unitWidth));
  const icon = renderTileCellsToCanvas({
    tileset: input.tileset,
    widthTiles: columns,
    heightTiles: kit.height,
    cells: assembledKitCells(kit, columns),
    scale: 2,
  });
  icon.className = "structure-kit-icon";
  const label = kit.name ?? "패턴 스탬프";
  return el("button", {
    class: "structure-kit-cell" + (active ? " active" : ""),
    attrs: {
      type: "button",
      title: `${label} — ${kit.width}×${kit.height} 단면 스탬프 (클릭해서 찍기)`,
      "aria-pressed": String(active),
    },
    dataset: { testid: `structure-kit-${kit.id}` },
    children: [icon],
    on: {
      click: () => {
        if (active) {
          editorState.set({ activePaletteStamp: null });
        } else {
          editorState.set({
            activePaletteStamp: paletteStampFromKit(kit),
            activeStampId: null,
            activeStructureStampId: null,
            tool: "paint",
          });
        }
        input.rerender();
      },
    },
  });
}
