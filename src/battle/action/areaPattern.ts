// 적 근접 공격의 범위 모양과 선딜 예고 농도.
//
// 아이디어 출처: OpenWorld(MIT, Copyright (c) 2026 The OpenWorld authors)의 packages/modules/src/kits/pattern.ts
// 와 packages/runtime/src/render/scene.ts — 한 지오메트리 함수로 예고 칸과 실제 타격 칸을 모두 만들고,
// 예고 농도를 선딜 진행도에 비례시킨다는 설계. 코드는 가져오지 않았고 이 저장소의 발자국·칸 모델로 새로 썼다.
import { footprintBounds } from "@/project/footprint";
import type { CharacterFootprint, Dir, EnemyActionAttackShape } from "@/project/types";
import { swingArcCellsFromBody, type TileCell } from "./hitbox";

export const ENEMY_ATTACK_SHAPES: readonly EnemyActionAttackShape[] = ["arc", "circle", "ring", "cross"];

/** 선딜 시작 때 예고 농도. 끝에 가까울수록 진해져 "곧 맞는다" 가 읽힌다. */
export const TELEGRAPH_ALPHA_START = 0.28;
export const TELEGRAPH_ALPHA_END = 0.55;

export function isEnemyAttackShape(value: unknown): value is EnemyActionAttackShape {
  return typeof value === "string" && (ENEMY_ATTACK_SHAPES as readonly string[]).includes(value);
}

/** 선딜 진행도(0..1)에 따른 예고 칸 농도. 범위 밖 값은 끝점으로 자른다. */
export function telegraphAlpha(elapsedMs: number, windupMs: number): number {
  const progress = windupMs > 0 && Number.isFinite(elapsedMs) ? Math.min(1, Math.max(0, elapsedMs / windupMs)) : 1;
  return TELEGRAPH_ALPHA_START + (TELEGRAPH_ALPHA_END - TELEGRAPH_ALPHA_START) * progress;
}

function distanceToBody(cell: TileCell, left: number, right: number, top: number, bottom: number): number {
  const dx = Math.max(left - cell.x, 0, cell.x - right);
  const dy = Math.max(top - cell.y, 0, cell.y - bottom);
  return Math.max(dx, dy);
}

/**
 * 근접 공격이 덮는 칸. 예고(drawTelegraph)와 타격(executeStrike)이 이 함수 하나를 부르므로
 * 그려진 칸과 맞는 칸이 어긋나지 않는다. 자기 몸 칸은 항상 뺀다.
 *
 * - arc: 기존 앞쪽 부채꼴(생략 시 기본, 기존 동작과 같다).
 * - circle: 몸에서 range 칸 이내 전부(대각선 포함, 공격 시작 거리 판정과 같은 체비쇼프 거리).
 * - ring: 몸에서 정확히 range 칸 떨어진 바깥 한 겹(안쪽은 안전).
 * - cross: 몸의 네 변에서 위·아래·왼·오른쪽으로 range 칸씩.
 */
export function enemyMeleeCells(
  shape: EnemyActionAttackShape | undefined,
  facing: Dir,
  x: number,
  y: number,
  range: number,
  footprint: CharacterFootprint
): TileCell[] {
  const reach = Math.max(1, Math.round(range));
  if (shape === undefined || shape === "arc") return swingArcCellsFromBody(facing, x, y, reach, footprint);
  const body = footprintBounds(x, y, footprint);
  const cells: TileCell[] = [];
  if (shape === "cross") {
    for (let step = 1; step <= reach; step += 1) {
      for (let col = body.left; col <= body.right; col += 1) {
        cells.push({ x: col, y: body.top - step }, { x: col, y: body.bottom + step });
      }
      for (let row = body.top; row <= body.bottom; row += 1) {
        cells.push({ x: body.left - step, y: row }, { x: body.right + step, y: row });
      }
    }
    return cells;
  }
  for (let cy = body.top - reach; cy <= body.bottom + reach; cy += 1) {
    for (let cx = body.left - reach; cx <= body.right + reach; cx += 1) {
      const d = distanceToBody({ x: cx, y: cy }, body.left, body.right, body.top, body.bottom);
      if (d <= 0 || d > reach) continue;
      if (shape === "ring" && d <= reach - 1) continue;
      cells.push({ x: cx, y: cy });
    }
  }
  return cells;
}
