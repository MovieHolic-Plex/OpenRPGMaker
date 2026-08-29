import { characterFootprintCells, footprintBounds, rectsOverlap } from "@/project/footprint";
import type { CharacterFootprint, Dir, FootprintRect } from "@/project/types";

export interface TileCell {
  readonly x: number;
  readonly y: number;
}

const DIRECTION_DELTAS: Record<Dir, TileCell> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

function perpendiculars(dir: Dir): readonly [TileCell, TileCell] {
  const d = DIRECTION_DELTAS[dir];
  return d.x === 0
    ? [{ x: -1, y: 0 }, { x: 1, y: 0 }]
    : [{ x: 0, y: -1 }, { x: 0, y: 1 }];
}

export function swingArcCells(facing: Dir, originX: number, originY: number, range: number): TileCell[] {
  const forward = DIRECTION_DELTAS[facing];
  const cells: TileCell[] = [];
  const seen = new Set<string>();
  const push = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ x, y });
  };
  for (let step = 1; step <= Math.max(1, range); step += 1) {
    const cx = originX + forward.x * step;
    const cy = originY + forward.y * step;
    push(cx, cy);
    if (step === 1) {
      const [p1, p2] = perpendiculars(facing);
      push(cx + p1.x, cy + p1.y);
      push(cx + p2.x, cy + p2.y);
    }
  }
  return cells;
}

export function cellInArc(cells: readonly TileCell[], x: number, y: number): boolean {
  return cells.some((cell) => cell.x === x && cell.y === y);
}

// 소수 타일 좌표의 몸(중심 (tx,ty), 한 칸 크기)이 스윙 호 칸들과 겹치는지.
// 각 칸은 [cx-0.5, cx+0.5] 정사각형으로 보고, 겹침은 양의 면적이 있을 때만 참.
// 타일 반올림 좌표만 보던 판정과 달리 칸 사이를 보간 중인 적도 맞을 수 있다.
export function swingArcOverlapsPoint(facing: Dir, originX: number, originY: number, range: number, targetX: number, targetY: number): boolean {
  const cells = swingArcCells(facing, originX, originY, range);
  return cells.some((cell) => Math.abs(targetX - cell.x) < 0.5 && Math.abs(targetY - cell.y) < 0.5);
}

/**
 * **몸 사각 전체**가 스윙 호와 겹치는지. 발자국이 덮는 칸마다 앵커 규칙을 그대로 적용한다.
 *
 * 1x1 이면 검사가 딱 한 번이고 곧 {@link swingArcOverlapsPoint} 와 **같은 식**이다(항등).
 * 사각 대 사각 AABB 로 쓰지 않은 이유: 원래 규칙은 "적 중심점이 호 칸 안" 이라 사각 겹침보다
 * 좁다. AABB 로 바꾸면 1x1 적의 명중 범위가 조용히 넓어진다.
 *
 * 발자국이 소수 앵커를 받는 것도 의도다 — 걸음 보간 중인 3x3 적의 상체도 맞아야 한다.
 */
export function swingArcOverlapsBody(
  facing: Dir,
  originX: number,
  originY: number,
  range: number,
  targetX: number,
  targetY: number,
  footprint: CharacterFootprint
): boolean {
  const cells = swingArcCells(facing, originX, originY, range);
  // (0,0) 기준 오프셋. 소수 좌표를 characterFootprintCells 에 넘기면 셀 좌표가 소수로 번져
  // 정수 오프셋이 아니게 되므로, 오프셋만 정수로 뽑아 뒤에서 더한다.
  for (const offset of characterFootprintCells(0, 0, footprint)) {
    const bx = targetX + offset.x;
    const by = targetY + offset.y;
    if (cells.some((cell) => Math.abs(bx - cell.x) < 0.5 && Math.abs(by - cell.y) < 0.5)) return true;
  }
  return false;
}

/**
 * 몸 사각 전체에서 뻗는 스윙 호. 발자국 각 칸에서 호를 만들어 합집합하고 **자기 몸 칸은 뺀다**.
 *
 * 1x1 이면 앵커 한 칸의 호이고 호에 앵커 자신이 없으므로 {@link swingArcCells} 와 같다(항등).
 * 3x3 적이 오른쪽을 보면 세 행 모두에서 팔이 나간다 — 발밑 행만 때리면 상체 옆에 선 플레이어가
 * 눈앞의 적에게 맞지 않는다.
 */
export function swingArcCellsFromBody(
  facing: Dir,
  x: number,
  y: number,
  range: number,
  footprint: CharacterFootprint
): TileCell[] {
  const body = footprintBounds(x, y, footprint);
  const cells: TileCell[] = [];
  const seen = new Set<string>();
  for (const origin of characterFootprintCells(x, y, footprint)) {
    for (const cell of swingArcCells(facing, origin.x, origin.y, range)) {
      if (rectsOverlap(body, { left: cell.x, right: cell.x, top: cell.y, bottom: cell.y })) continue;
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push(cell);
    }
  }
  return cells;
}

/** 사각을 사방 `margin` 칸 넓힌다. 인접(8방) 판정을 사각 겹침으로 표현할 때 쓴다. */
export function expandRect(rect: FootprintRect, margin: number): FootprintRect {
  return {
    left: rect.left - margin,
    right: rect.right + margin,
    top: rect.top - margin,
    bottom: rect.bottom + margin,
  };
}
