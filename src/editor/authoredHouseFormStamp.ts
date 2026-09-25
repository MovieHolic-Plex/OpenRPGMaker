// editor/authoredHouseFormStamp.ts
// 저작 집 형태(행렬 레시피)의 스탬프 — author_house 가 templateId 로 고른 형태를
// 셀 그대로 쓴다. 재료 킷 스탬프(stampFootprintHouseKit)의 날개 문법으로 못 만드는
// 세로 적층 구조(벽→지붕→벽)를 커버한다.
//
// 레이어 정본: rows 의 tiles→lowerTiles, upperTiles→upperTiles. 문 칸은 레시피에
// 벽으로 남아 있고, 문 렌더링은 호출부(buildHouseKit)의 문 기계가 doorAt 으로 한다.

import { findAuthoredHouseForm, type AuthoredHouseFormDef } from "@/project/defaults/authoredHouseFormCatalog";
import type { GameMap } from "@/project/types";
import { composeGableHouseFormById } from "./gableHouseCompose";
import { stampFootprintHouseKit, type FootprintHousePlan, type RectHouseStampResult } from "./houseKit";

export function stampAuthoredHouseForm(
  map: GameMap,
  form: AuthoredHouseFormDef,
  origin: { readonly x: number; readonly y: number },
): RectHouseStampResult {
  if (form.rows.length !== form.h) return { ok: false, reason: `형태 ${form.id}: rows 수가 h와 다릅니다.` };
  if (origin.x < 0 || origin.y < 0 || origin.x + form.w > map.width || origin.y + form.h > map.height) {
    return { ok: false, reason: `형태 ${form.id}이 맵 경계를 벗어납니다.` };
  }
  for (const [dy, row] of form.rows.entries()) {
    if (row.tiles.length !== form.w || (row.upperTiles !== undefined && row.upperTiles.length !== form.w)) {
      return { ok: false, reason: `형태 ${form.id}: row ${dy} 폭이 w와 다릅니다.` };
    }
    const y = origin.y + dy;
    for (let dx = 0; dx < form.w; dx += 1) {
      const x = origin.x + dx;
      const index = y * map.width + x;
      const lower = row.tiles[dx] as number;
      if (lower !== -1) {
        map.lowerTiles[index] = lower;
        if (map.lowerTileStacks) delete map.lowerTileStacks[index];
      }
      const upper = row.upperTiles?.[dx] ?? -1;
      if (upper !== -1) {
        map.upperTiles[index] = upper;
        if (map.upperTileStacks) delete map.upperTileStacks[index];
      }
    }
  }
  return { ok: true, doorAt: { x: origin.x + form.doorAt.x, y: origin.y + form.doorAt.y } };
}

/**
 * author_house 외장 스탬프의 단일 진입 — templateId 가 저작 형태(셀 레시피)를 가리키면
 * 고정 레시피로 시공하고(formId 표기), 아니면 날개 문법 스탬프로 넘긴다.
 * 형태가면 wings[0] 은 파서가 형태 bbox 로 전개해 둔 앵커다.
 */
export function stampHouseExterior(
  map: GameMap,
  plan: FootprintHousePlan & { readonly templateId?: string; readonly accentSeed?: number },
): RectHouseStampResult & { readonly formId?: string } {
  // 박공 조합 형태(gable-*)는 요청 킷으로 합성한 레시피(accentSeed 가 있으면 지붕 부품 0~2개), 저작 형태는 고정 레시피.
  const form = plan.templateId === undefined
    ? undefined
    : composeGableHouseFormById(plan.templateId, plan.kitId, plan.accentSeed === undefined ? {} : { accentSeed: plan.accentSeed })
      ?? findAuthoredHouseForm(plan.templateId);
  if (form === undefined) return stampFootprintHouseKit(map, plan);
  return { ...stampAuthoredHouseForm(map, form, { x: plan.wings[0]?.x ?? 0, y: plan.wings[0]?.y ?? 0 }), formId: form.id };
}
