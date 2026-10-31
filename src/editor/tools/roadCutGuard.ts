// editor/tools/roadCutGuard.ts
// 서는 소품의 발(막는 칸)이 길을 두 동강 내면 찍지 않는다.
//
// 왜(2026-10-31 jb1b opus jrpg): 조수가 동굴 출구 앞 외곽 이정표(1×2)를 stamp_object(onOverlap:'nearest')로 찍었는데,
// 그 발이 동굴에서 마을로 내려오는 한 칸 폭 포석 길 (9,3) 한가운데 섰다. 길은 거기서 끊겼고, 남은 우회로는 집 지붕 밑이라 안 보였다.
// 판정자는 마왕을 이긴 뒤 마을로 돌아가는 길을 끝내 못 찾았다. 광장처럼 넓은 포석 위 소품은 길을 끊지 않으므로 그대로 둔다.
import { isPassable } from "@/project/collision";
import { isRoadCell } from "@/ai/v2/edgeExitRoads";
import type { GameMap, Project } from "@/project/types";

type Cell = { x: number; y: number };

/** 길 칸(걸을 수 있는 포석·흙길)끼리 4방으로 이은 덩이 수(크기 minSize 이상만). */
function roadPieces(road: Set<number>, w: number, minSize: number): number {
  const seen = new Set<number>();
  let pieces = 0;
  for (const s of road) {
    if (seen.has(s)) continue;
    let size = 0;
    const stack = [s];
    seen.add(s);
    while (stack.length) {
      const i = stack.pop()!;
      size += 1;
      const x = i % w;
      for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) if (j >= 0 && road.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
    if (size >= minSize) pieces += 1;
  }
  return pieces;
}

/** feet(맵 좌표, 막는 칸)를 막으면 길이 갈라지나 — 갈라지면 끊기는 칸 하나를 돌려준다. */
export function roadCutAt(project: Project, map: GameMap, feet: readonly Cell[]): Cell | undefined {
  const w = map.width;
  const onRoad = feet.filter((c) => c.x >= 0 && c.y >= 0 && c.x < w && c.y < map.height && isRoadCell(project, map, c.x, c.y));
  if (!onRoad.length) return undefined;
  const road = new Set<number>();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) if (isRoadCell(project, map, x, y) && isPassable(project, map, x, y)) road.add(y * w + x);
  const before = roadPieces(road, w, 2);
  for (const c of onRoad) road.delete(c.y * w + c.x);
  return roadPieces(road, w, 2) > before ? onRoad[0] : undefined;
}
