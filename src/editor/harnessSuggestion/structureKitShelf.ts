// harnessSuggestion/structureKitShelf.ts
// §④ⓐ 팔레트 — 등록된 킷은 "미니 조립 렌더 아이콘"으로 고른다.
// 이름·번호가 아니라 생김새가 주인공: 아이콘 = 킷을 3단위쯤 이어붙인 실렌더.

import { editorState } from "@/editor/editorState";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { paletteStampFromKit, structureKitSize } from "@/editor/harnessSuggestion/structureKitModel";
import type { SectionStructureKitDef, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export type StructureKitShelfInput = {
  readonly tileset: TilesetDef;
  readonly activeKitId: string | null;
  readonly rerender: () => void;
  readonly title?: string;
  readonly showNames?: boolean;
};

/** 아이콘 조립 폭 상한(타일) — 킷 단위를 이 폭 안에서 최대한 반복해 보여준다. */
const ICON_MAX_COLUMNS = 6;

/** 등록 킷이 없으면 null — 팔레트에 빈 섹션을 만들지 않는다. */
export function makeStructureKitShelf(input: StructureKitShelfInput): HTMLElement | null {
  const learnedKits = (input.tileset.structureKits ?? []).filter((kit) => kit.kind === "section");
  if (learnedKits.length === 0) return null;

  const shelf = el("div", {
    class: "structure-kit-shelf panel-subsection",
    dataset: { testid: "structure-kit-shelf" },
  });
  shelf.append(el("div", { class: "structure-kit-shelf-title", text: input.title ?? "내 구조물" }));
  const grid = el("div", { class: "structure-kit-shelf-grid", ...(input.showNames ? {attrs:{style:'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px'}} : {}) });
  for (const kit of learnedKits) grid.append(makeKitButton(kit, input));
  shelf.append(grid);
  return shelf;
}

function makeKitButton(kit: SectionStructureKitDef, input: StructureKitShelfInput): HTMLElement {
  const active = input.activeKitId === kit.id;
  const size = structureKitSize(kit);
  const unitWidth = Math.max(1, size.width);
  const columns = kit.ai?.repeatability === 'fixed' ? unitWidth : unitWidth * Math.max(1, Math.floor(ICON_MAX_COLUMNS / unitWidth));
  const icon = renderTileCellsToCanvas({
    tileset: input.tileset,
    widthTiles: columns,
    heightTiles: size.height,
    cells: assembledKitCells(kit, columns),
    scale: input.showNames && columns > 3 ? 1 : 2,
  });
  icon.className = "structure-kit-icon";
  const label = kit.name ?? "구조물";
  const title = input.showNames ? `${label} — 지도에 놓기` : `${label} — ${size.width}×${size.height} 단면 구조물 (클릭해서 찍기)`;
  return el("button", {
    class: "structure-kit-cell" + (active ? " active" : ""),
    attrs: {
      type: "button",
      title,
      "aria-pressed": String(active),
      ...(input.showNames ? {style:'display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;padding:6px'} : {}),
    },
    dataset: { testid: `structure-kit-${kit.id}` },
    children: input.showNames ? [icon,el('span',{text:label.split(' — ')[0]!,attrs:{style:'font-size:11px;line-height:1.3'}})] : [icon],
    on: {
      click: () => {
        if (active) {
          editorState.set({ activePaletteStamp: null });
        } else {
          editorState.set({
            activePaletteStamp: paletteStampFromKit(kit),
            tool: "paint",
            paintShape: "pen",
          });
        }
        input.rerender();
      },
    },
  });
}
