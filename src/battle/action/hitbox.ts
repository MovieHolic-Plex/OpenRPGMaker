import type { Dir } from "@/project/types";

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
