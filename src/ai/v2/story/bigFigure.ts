// ai/v2/story/bigFigure.ts
// 두 배로 서는 상대(싸우는 단계의 보스 — stepFoes.foeGraphic 의 scale 2)가 설 칸. 결정적.
//
// 왜(2026-11-13 r3s-fun 플레이): «보일러 수호기» 가 방 구석 (1,4) 에 서서 그림이 왼쪽 벽과 옆의 보일러를 덮었다 — 자리는 한 칸짜리 사람처럼 골랐는데
// 그림은 선 칸의 양옆과 위 줄까지 덮는다. 덮는 칸이 모두 트인 바닥(벽·가구·문·다른 이벤트 없음)인 칸을 고른다 — 고른 자리가 그렇지 않으면 가장 가까운 그런 칸으로 옮긴다.
import { isPassable } from "@/project/collision";
import { objectClusterAt } from "@/project/objectFootprint";
import type { GameMap, Project } from "@/project/types";
import { reachableCells } from "../judge/eventReach";
import { isEntranceArt } from "../place/entrances";

type Cell = { x: number; y: number };
/** 두 배 그림이 덮는 칸(선 칸 기준) — 가로 셋, 선 줄에서 위로 세 줄(그림은 서너 칸 높이다 — 맨 위 줄은 머리 끝이라 벽면에 걸쳐도 둔다). */
const COVERED: readonly (readonly [number, number])[] = [-1, 0, 1].flatMap((dx) => [0, -1, -2].map((dy) => [dx, dy] as const));
/** 세 줄이 트인 자리가 없는 좁은 방에서는 아래 두 줄만 본다. */
const COVERED_LOW = COVERED.filter(([, dy]) => dy >= -1);
/** 고른 자리에서 이 걸음 안에서만 옮긴다 — 방 안쪽이라는 자리의 뜻(들어온 곳에서 먼 곳)을 잃지 않게. */
const REACH = 8;

/** 그 칸에 선 두 배 그림이 덮는 칸들(맵 안). */
export function bigFigureCells(map: Pick<GameMap, "width" | "height">, at: Cell): Cell[] {
  return COVERED.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy })).filter((c) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height);
}

/** at 에 두 배 그림이 설 수 있으면 at, 아니면 가장 가까운 설 수 있는 칸(걸어서 REACH 안, 같은 거리면 위·왼쪽 먼저). 없으면 at 그대로. */
export function bigFigureCell(project: Project, map: GameMap, at: Cell, taken: readonly Cell[] = []): Cell {
  for (const box of [COVERED, COVERED_LOW]) { const hit = clearCell(project, map, at, taken, box); if (hit) return hit; }
  return at;
}

function clearCell(project: Project, map: GameMap, at: Cell, taken: readonly Cell[], box: typeof COVERED): Cell | undefined {
  const reach = reachableCells(project, map);
  const busy = new Set([...(map.events ?? []), ...taken].filter((e) => e.x !== at.x || e.y !== at.y).map((e) => `${e.x},${e.y}`));
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y) && !objectClusterAt(project, map, x, y) && !isEntranceArt(project, map, x, y) && !busy.has(`${x},${y}`);
  const clear = (c: Cell) => box.every(([dx, dy]) => open(c.x + dx, c.y + dy)) && (!reach || !!reach[c.y * map.width + c.x]);
  if (clear(at)) return at;
  const seen = new Set<string>([`${at.x},${at.y}`]);
  let frontier: Cell[] = [at];
  for (let dist = 1; dist <= REACH && frontier.length; dist += 1) {
    const next: Cell[] = [];
    for (const cell of frontier) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const c = { x: cell.x + dx, y: cell.y + dy }, key = `${c.x},${c.y}`;
      if (seen.has(key) || c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
      seen.add(key);
      if (isPassable(project, map, c.x, c.y)) next.push(c);
    }
    const hit = [...next].sort((a, b) => a.y - b.y || a.x - b.x).find(clear);
    if (hit) return hit;
    frontier = next;
  }
  return undefined;
}
