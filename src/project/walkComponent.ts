// 맵에서 «걸어서 이어진 가장 큰 덩이» — 거리 맵의 큰길·보도가 이루는 주 동선.
// 엔진과 같은 방향 통행 판정(canMove)으로 4방향을 잇는다. 이벤트는 보지 않는다(지형만).
// 쓰임: 거리 건물 문 앞 칸이 이 덩이 밖이면 그 문은 걸어서 갈 수 없다(2026-10-25 시타마치: 남쪽 줄 건물 문 넷이
// 맵 끝 뒷골목에 갇혀 실내로 들어갈 길이 없었다).
import { canMove, isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

export function mainWalkComponent(project: Project, map: GameMap): Set<number> {
  const w = map.width, h = map.height;
  const done = new Uint8Array(w * h);
  let best = new Set<number>();
  for (let i = 0; i < w * h; i++) {
    if (done[i]) continue;
    const x0 = i % w, y0 = Math.floor(i / w);
    if (!isPassable(project, map, x0, y0)) { done[i] = 1; continue; }
    const comp = new Set<number>([i]); done[i] = 1;
    const q = [i];
    while (q.length) {
      const c = q.pop()!; const cx = c % w, cy = Math.floor(c / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (comp.has(k) || !canMove(project, map, cx, cy, nx, ny)) continue;
        comp.add(k); done[k] = 1; q.push(k);
      }
    }
    if (comp.size > best.size) best = comp;
  }
  return best;
}

export function inMainWalkComponent(component: ReadonlySet<number>, map: GameMap, cell: { x: number; y: number }): boolean {
  return component.has(cell.y * map.width + cell.x);
}
