// editor/authoredHouseFormStamp.ts
// 저작 집 형태(행렬 레시피)의 스탬프 — author_house 가 templateId 로 고른 형태를
// 셀 그대로 쓴다. 재료 킷 스탬프(stampFootprintHouseKit)의 날개 문법으로 못 만드는
// 세로 적층 구조(벽→지붕→벽)를 커버한다.
//
// 레이어 정본: rows 의 tiles→lowerTiles, upperTiles→upperTiles. 문 칸은 레시피에
// 벽으로 남아 있고, 문 렌더링은 호출부(buildHouseKit)의 문 기계가 doorAt 으로 한다.

import { findAuthoredHouseForm, type AuthoredHouseFormDef, type AuthoredHouseFormRow } from "@/project/defaults/authoredHouseFormCatalog";
import type { GameMap } from "@/project/types";
import { composeGableHouseFormById } from "./gableHouseCompose";
import {
  allBottomWallTiles,
  doorOffsetForWindows,
  HOUSE_KITS,
  isHouseKitId,
  placeWindowsInRow,
  stampFootprintHouseKit,
  type FootprintHousePlan,
  type RectHouseStampResult,
} from "./houseKit";

const RECIPE_WINDOW_TILES: ReadonlySet<number> = new Set([85, 87]);

/**
 * 고정 셀 레시피(참고 사례 ref-*·저택)의 창을 공통 창 규칙으로 다시 낸다(2026-09-25 사용자 3차).
 * 참고 그림에서 옮긴 창은 문 바로 옆·벽 끝 칸에 붙은 것이 많았다 — 레시피 창을 지우고, 원래 창이 있던 줄
 * (없으면 문 윗줄)에 placeWindowsInRow 로 다시 놓는다. 창 모양(85/87)은 레시피 것을 따른다.
 * 창 자리가 없으면 창 없이 돌려준다 — 마을 자동 추첨은 그런 형태를 뺀다(recipeHasWindow).
 */
export function withWindowRules(form: AuthoredHouseFormDef): AuthoredHouseFormDef {
  if (!isHouseKitId(form.kitId)) return form;
  const kit = HOUSE_KITS[form.kitId];
  const tiles = form.rows.map((row) => [...row.tiles]);
  const uppers = form.rows.map((row) => (row.upperTiles ? [...row.upperTiles] : new Array<number>(form.w).fill(-1)));
  let windowTile = kit.windowTile;
  const rows = new Set<number>();
  uppers.forEach((upper, y) => upper.forEach((tile, x) => {
    if (!RECIPE_WINDOW_TILES.has(tile)) return;
    windowTile = tile;
    rows.add(y);
    upper[x] = -1;
  }));
  if (rows.size === 0 && form.doorAt.y - 1 >= 0) rows.add(form.doorAt.y - 1);
  // 문도 옮길 수 있다(문 그림은 시공기가 doorAt 에 얹는다) — 문 줄 벽 구간에서 한쪽에 민벽 3칸이 남는 자리로.
  const bottoms = allBottomWallTiles();
  const doorRow = tiles[form.doorAt.y] ?? [];
  let doorX = form.doorAt.x;
  if (bottoms.has(doorRow[doorX] ?? -1)) {
    let x0 = doorX;
    let x1 = doorX;
    while (bottoms.has(doorRow[x0 - 1] ?? -1)) x0 -= 1;
    while (bottoms.has(doorRow[x1 + 1] ?? -1)) x1 += 1;
    doorX = x0 + doorOffsetForWindows(x1 - x0 + 1, doorX - x0);
  }
  const doorAt = { x: doorX, y: form.doorAt.y };
  const [postTop, postMid, postBottom] = kit.postColumn?.tiles ?? [-2, -2, -2];
  const below: number[] = [];
  for (const y of [...rows].sort((a, b) => b - a)) {
    const onDoorRow = y >= doorAt.y - 2;
    const placed = placeWindowsInRow(kit, 0, form.w - 1, onDoorRow ? doorAt.x : undefined, {
      lower: (x) => (x < 0 || x >= form.w ? -1 : tiles[y]![x]!),
      upperEmpty: (x) => x >= 0 && x < form.w && uppers[y]![x] === -1,
      setWindow: (x) => { uppers[y]![x] = windowTile; },
      stripPost: (x) => {
        for (const row of tiles) {
          if (row[x] === postTop) row[x] = kit.wall.top[1];
          else if (row[x] === postMid) row[x] = kit.wall.mid[1];
          else if (row[x] === postBottom) row[x] = kit.wall.bottom[1];
        }
      },
    }, onDoorRow ? [] : [...below, doorAt.x]);
    if (onDoorRow) below.push(...placed);
  }
  const outRows: AuthoredHouseFormRow[] = tiles.map((row, y) =>
    uppers[y]!.some((tile) => tile !== -1) ? { tiles: row, upperTiles: uppers[y]! } : { tiles: row });
  return { ...form, doorAt, rows: outRows };
}

/** 레시피에 창이 하나라도 있는가. */
export function recipeHasWindow(form: AuthoredHouseFormDef): boolean {
  return form.rows.some((row) => (row.upperTiles ?? []).some((tile) => RECIPE_WINDOW_TILES.has(tile)));
}

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

function recipeWithWindowRules(id: string): AuthoredHouseFormDef | undefined {
  const form = findAuthoredHouseForm(id);
  return form ? withWindowRules(form) : undefined;
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
      ?? recipeWithWindowRules(plan.templateId);
  if (form === undefined) return stampFootprintHouseKit(map, plan);
  return { ...stampAuthoredHouseForm(map, form, { x: plan.wings[0]?.x ?? 0, y: plan.wings[0]?.y ?? 0 }), formId: form.id };
}
