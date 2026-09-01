// editor/operators/materialSlotEdit.ts
// 슬롯 오버라이드 쓰기 — 보드 UI 와 헤드리스 검증이 같은 함수를 쓴다.
//
// 저장하는 것은 **사람이 고친 것뿐**이다(materialSlots.ts 의 계약). 그래서 "번들로 되돌리기"는
// 값을 다시 계산해 넣는 게 아니라 오버라이드를 지우는 것이다 — 그래야 나중에 어휘가 바뀌면
// 자동 해석이 다시 따라간다.

import type { TilesetDef } from "@/project/types";
import type { MaterialSlotId } from "./materialSlots";

export interface SlotOverrideInput {
  readonly tiles: readonly number[];
  readonly pair?: { readonly top: number; readonly bottom: number };
  readonly layer?: "lower" | "upper";
  readonly passage?: "passable" | "solid";
}

/** 슬롯 하나를 사람이 지정한 값으로 고정한다. tiles 가 비면 아무 것도 하지 않는다. */
export function setMaterialSlotOverride(
  tileset: TilesetDef,
  slotId: MaterialSlotId,
  input: SlotOverrideInput,
): boolean {
  const tiles = input.tiles.filter((tile) => Number.isInteger(tile) && tile >= 0);
  if (tiles.length === 0) return false;
  const next = { ...(tileset.materialSlots ?? {}) };
  next[slotId] = {
    tiles: [...tiles],
    ...(input.pair ? { pair: { ...input.pair } } : {}),
    ...(input.layer ? { layer: input.layer } : {}),
    ...(input.passage ? { passage: input.passage } : {}),
  };
  tileset.materialSlots = next;
  return true;
}

/** 오버라이드를 지워 자동 해석으로 되돌린다. */
export function clearMaterialSlotOverride(tileset: TilesetDef, slotId: MaterialSlotId): boolean {
  if (!tileset.materialSlots?.[slotId]) return false;
  const next = { ...tileset.materialSlots };
  delete next[slotId];
  // 빈 객체를 남기면 저장 파일에 의미 없는 키가 쌓인다.
  if (Object.keys(next).length === 0) delete tileset.materialSlots;
  else tileset.materialSlots = next;
  return true;
}

export function hasMaterialSlotOverride(tileset: TilesetDef | undefined, slotId: MaterialSlotId): boolean {
  return Boolean(tileset?.materialSlots?.[slotId]);
}
