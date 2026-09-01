// editor/panels/materialSlotBoard.ts
// 재료 슬롯 보드 — 자동 해석 결과를 사람이 **보고 고치는** 화면.
//
// 왜 필요한가(2026-09-01): 슬롯은 승인 어휘에서 자동으로 유도되는데, 그 매칭이 틀리면
// 사용자는 "왜 이상한 타일로 숲이 깔리는지" 알 방법이 없다. 실제로 구현 중 매칭 함정 4가지가
// 나왔다(오토타일 모서리·2×2 활엽수 페어·"tree" 가 "dry-tree" 를 삼킴·고사목 폴백 누수).
// 보드는 그 결과를 실물 타일로 드러내고, 틀린 칸만 현재 붓 타일로 덮게 한다.
//
// 편집 모델은 최소다: 슬롯당 「현재 타일 넣기」와 「자동으로 되돌리기」 둘뿐.
// 되돌리기는 값을 다시 계산해 넣는 게 아니라 오버라이드를 **지운다** — 어휘가 바뀌면
// 자동 해석이 다시 따라가야 하기 때문이다.

import { editorState } from "@/editor/editorState";
import {
  MATERIAL_SLOT_IDS,
  materialSlotCoverage,
  resolveMaterialSlots,
  type MaterialSlot,
  type MaterialSlotId,
  type ResolvedMaterialSlots,
} from "@/editor/operators/materialSlots";
import {
  clearMaterialSlotOverride,
  hasMaterialSlotOverride,
  setMaterialSlotOverride,
} from "@/editor/operators/materialSlotEdit";
import { MATERIAL_SLOT_LABELS } from "@/editor/operators/materialSlots";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export interface MaterialSlotBoardOptions {
  readonly tileset: TilesetDef;
  /** 슬롯을 고친 뒤 호출 — 저장·재렌더는 호출자가 맡는다. */
  readonly onChange?: () => void;
  /** 테스트 주입: 지금 붓에 물린 타일. 기본은 에디터 상태. */
  readonly currentTile?: () => number;
}

/** 한 칸 타일 칩. 이벤트 편집기의 것과 같은 방식(배경 오프셋)이지만 그쪽은 private 이라 여기 최소 구현. */
function slotTileChip(tile: number, tileset: TilesetDef, imageUrl: string, size = 28): HTMLElement {
  const chip = el("div", {
    class: "slot-board-chip",
    dataset: { testid: `slot-board-chip-${tile}`, tile: String(tile) },
    attrs: { title: `그림 ${tile}` },
  });
  const scale = size / tileset.tileSize;
  const column = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  chip.style.width = `${size}px`;
  chip.style.height = `${size}px`;
  chip.style.backgroundImage = `url("${imageUrl.replace(/"/g, '\\"')}")`;
  chip.style.backgroundSize = `${tileset.tilesPerRow * tileset.tileSize * scale}px auto`;
  chip.style.backgroundPosition = `-${column * tileset.tileSize * scale}px -${row * tileset.tileSize * scale}px`;
  chip.style.imageRendering = "pixelated";
  return chip;
}

function describeSource(slot: MaterialSlot | undefined): string {
  if (!slot) return "비어 있음";
  return slot.source === "user" ? "사용자 지정" : "자동";
}

export function renderMaterialSlotBoard(options: MaterialSlotBoardOptions): HTMLElement {
  const readCurrentTile = options.currentTile ?? (() => editorState.get().selectedTile);
  const host = el("div", { class: "slot-board", dataset: { testid: "material-slot-board" } });

  const render = (): void => {
    const slots: ResolvedMaterialSlots = resolveMaterialSlots(options.tileset);
    const coverage = materialSlotCoverage(slots);
    const imageUrl = tilesetImageUrl(options.tileset);
    host.replaceChildren();
    host.append(el("div", {
      class: "slot-board-head",
      dataset: { testid: "material-slot-coverage" },
      children: [
        el("span", { class: "slot-board-count", text: `${coverage.filled} / ${coverage.total} 채움` }),
        el("span", {
          class: "slot-board-hint",
          text: "비어 있으면 그 재료를 쓰는 생성기가 기본값으로 떨어집니다. 타일을 고른 뒤 [현재 타일]을 누르세요.",
        }),
      ],
    }));

    const grid = el("div", { class: "slot-board-grid" });
    for (const id of MATERIAL_SLOT_IDS) {
      const slot = slots[id];
      const overridden = hasMaterialSlotOverride(options.tileset, id);
      const card = el("div", {
        class: `slot-board-card${slot ? "" : " is-empty"}${overridden ? " is-user" : ""}`,
        dataset: { testid: `material-slot-${id}`, source: slot ? slot.source : "none" },
      });
      card.append(el("div", {
        class: "slot-board-name",
        children: [
          el("span", { text: MATERIAL_SLOT_LABELS[id] }),
          el("span", { class: "slot-board-badge", text: describeSource(slot) }),
        ],
      }));
      const chips = el("div", { class: "slot-board-chips" });
      if (slot) {
        // 대표(본체)를 앞세우고 변형 몇 개만 — 오토타일은 타일이 10개가 넘어 다 그리면 카드가 무너진다.
        const shown = [...new Set([slot.body ?? slot.tiles[0]!, ...slot.tiles])].slice(0, 6);
        for (const tile of shown) chips.append(slotTileChip(tile, options.tileset, imageUrl));
        if (slot.pairs && slot.pairs.length > 1) {
          chips.append(el("span", { class: "slot-board-note", text: `${slot.pairs.length}종` }));
        }
      } else {
        chips.append(el("span", { class: "slot-board-note", text: "재료 없음" }));
      }
      card.append(chips);

      const setButton = el("button", {
        class: "slot-board-set",
        text: "현재 타일",
        attrs: { type: "button", title: "지금 붓에 물린 타일을 이 슬롯으로 지정합니다" },
        dataset: { testid: `material-slot-set-${id}` },
      }) as HTMLButtonElement;
      setButton.addEventListener("click", () => {
        const tile = readCurrentTile();
        if (!Number.isInteger(tile) || tile < 0) return;
        if (!setMaterialSlotOverride(options.tileset, id, { tiles: [tile] })) return;
        options.onChange?.();
        render();
      });
      const resetButton = el("button", {
        class: "slot-board-reset",
        text: "자동",
        attrs: { type: "button", title: "사용자 지정을 지우고 자동 해석으로 되돌립니다" },
        dataset: { testid: `material-slot-reset-${id}` },
      }) as HTMLButtonElement;
      resetButton.disabled = !overridden;
      resetButton.addEventListener("click", () => {
        if (!clearMaterialSlotOverride(options.tileset, id)) return;
        options.onChange?.();
        render();
      });
      card.append(el("div", { class: "slot-board-actions", children: [setButton, resetButton] }));
      grid.append(card);
    }
    host.append(grid);
  };

  render();
  return host;
}

export type { MaterialSlotId };
