// player/chaseContact.ts
// 「몸이 실제로 닿았는가」— 접촉 전투(eventTouch)는 화면에 그려진 두 몸이 붙었을 때만 시작한다.
//
// 왜(2026-10-29 사용자 지적 「부딪히지도 않았는데 전투가」): 칸 이동은 걸음을 **시작하는 순간** 논리 칸을 다음 칸으로 옮긴다
// (추격자는 moveAutonomousRuntimePosition, 주인공은 movingTo 예약). 접촉을 논리 칸으로만 보면 그림은 아직 1~2칸 떨어져 있는데
// 전투가 열렸다 — 달아나는 주인공이 막 떠난 칸으로 추격자가 한 칸 들어서려는 순간(그림 거리 최대 2칸)이 대표 사례다.
// 그림 자리 = 걸음 진행률로 보간한 칸 좌표. 두 몸의 중심 거리가 TOUCH_REACH 칸 이하일 때만 닿았다고 본다(옆 칸에 붙어 선 것 = 1칸).
import type { AutonomousMover } from "./playSceneTypes";

/** 닿았다고 보는 두 몸 중심 거리(칸). 옆 칸에 붙어 선 것이 1.0 — 대각 이웃(1.41)은 닿지 않았다. */
export const TOUCH_REACH = 1.05;

export type CellPoint = { readonly x: number; readonly y: number };

/** 자율 이동 무버의 화면 자리(칸 단위). 걷는 중이면 진행률로 보간한다. */
export function moverVisualCell(mover: Pick<AutonomousMover, "activeMove" | "moveDurationMs"> | undefined, logical: CellPoint): CellPoint {
  const move = mover?.activeMove;
  if (!move) return logical;
  const duration = Math.max(1, move.durationMs ?? mover!.moveDurationMs);
  const k = Math.max(0, Math.min(1, move.elapsedMs / duration));
  return { x: move.fromX + (move.toX - move.fromX) * k, y: move.fromY + (move.toY - move.fromY) * k };
}

/** 주인공의 화면 자리(칸 단위). 걷는 중이면 moveProgress 로 지금 칸 → 예약 칸 사이를 보간한다. */
export function playerVisualCell(scene: { readonly tileX: number; readonly tileY: number; readonly moving?: boolean; readonly movingTo?: CellPoint; readonly moveProgress?: number }): CellPoint {
  if (!scene.moving || !scene.movingTo) return { x: scene.tileX, y: scene.tileY };
  const k = Math.max(0, Math.min(1, scene.moveProgress ?? 0));
  return { x: scene.tileX + (scene.movingTo.x - scene.tileX) * k, y: scene.tileY + (scene.movingTo.y - scene.tileY) * k };
}

export function bodiesTouch(a: CellPoint, b: CellPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= TOUCH_REACH;
}

export type CellRect = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };

/**
 * 두 통행 사각(칸 단위, 끝 칸 포함)이 화면에서 닿았는가. 각 사각은 그림 자리만큼 옮겨 본다(shift = 화면 자리 − 논리 자리).
 * 가장 가까운 두 칸 중심 거리가 TOUCH_REACH 이하면 닿았다 — 1x1 끼리는 bodiesTouch 와 같다.
 */
export function rectsTouchVisually(a: CellRect, aShift: CellPoint, b: CellRect, bShift: CellPoint): boolean {
  const al = a.left + aShift.x, ar = a.right + aShift.x, at = a.top + aShift.y, ab = a.bottom + aShift.y;
  const bl = b.left + bShift.x, br = b.right + bShift.x, bt = b.top + bShift.y, bb = b.bottom + bShift.y;
  const dx = Math.max(0, bl - ar, al - br);
  const dy = Math.max(0, bt - ab, at - bb);
  return Math.hypot(dx, dy) <= TOUCH_REACH;
}

/** 주인공 그림이 논리 칸(tileX·tileY)에서 얼마나 옮겨 그려져 있는가. */
export function playerVisualShift(scene: Parameters<typeof playerVisualCell>[0]): CellPoint {
  const v = playerVisualCell(scene);
  return { x: v.x - scene.tileX, y: v.y - scene.tileY };
}

/** 무버 그림이 논리 칸(걸음 도착 칸)에서 얼마나 옮겨 그려져 있는가. */
export function moverVisualShift(mover: Parameters<typeof moverVisualCell>[0], logical: CellPoint): CellPoint {
  const v = moverVisualCell(mover, logical);
  return { x: v.x - logical.x, y: v.y - logical.y };
}
