import type { GameMap } from "@/project/types";
import { DUNGEON_STEPS } from "./terrain";
import type { DungeonPoint } from "./topology";

/** One continuous haul line. Only verified native straight/corner pieces are used. */
export function layDungeonRail(map: GameMap, from: DungeonPoint, to: DungeonPoint, open: (x: number, y: number) => boolean): DungeonPoint[] {
  const W = map.width, H = map.height;
  type State = { x: number; y: number; dir: number; run: number; key: number; cost: number; priority: number };
  const keyOf = (x: number, y: number, dir: number, run: number) => ((y * W + x) * 5 + dir) * 4 + run;
  const heap: State[] = [];
  const push = (s: State) => { heap.push(s); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p]!.priority <= s.priority) break; heap[i] = heap[p]!; i = p; } heap[i] = s; };
  const pop = (): State => { const first = heap[0]!, last = heap.pop()!; if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1]!.priority < heap[c]!.priority) c++; if (heap[c]!.priority >= last.priority) break; heap[i] = heap[c]!; i = c; } heap[i] = last; } return first; };
  const firstKey = keyOf(from.x, from.y, 4, 3), costs = new Map([[firstKey, 0]]), parents = new Map<number, number>(), points = new Map<number, DungeonPoint>([[firstKey, from]]);
  push({ ...from, dir: 4, run: 3, key: firstKey, cost: 0, priority: 0 });
  let end: number | null = null, visits = 0;
  while (heap.length && visits++ < W * H * 20) {
    const cur = pop(); if (costs.get(cur.key) !== cur.cost) continue;
    if (cur.x === to.x && cur.y === to.y) { end = cur.key; break; }
    for (let dir = 0; dir < 4; dir++) {
      if (cur.dir < 4 && (dir === (cur.dir + 2) % 4 || dir !== cur.dir && cur.run < 3)) continue;
      const [dx, dy] = DUNGEON_STEPS[dir]!, x = cur.x + dx, y = cur.y + dy;
      if (!open(x, y)) continue;
      const run = dir === cur.dir ? Math.min(3, cur.run + 1) : 1, key = keyOf(x, y, dir, run);
      const nearWall = DUNGEON_STEPS.filter(([ax, ay]) => !open(x + ax, y + ay)).length;
      const cost = cur.cost + 1 + (dir !== cur.dir ? 4 : 0) + nearWall;
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost); parents.set(key, cur.key); points.set(key, { x, y });
      push({ x, y, dir, run, key, cost, priority: cost + Math.abs(x - to.x) + Math.abs(y - to.y) });
    }
  }
  if (end === null) return [];
  const path: DungeonPoint[] = [];
  for (let k: number | undefined = end; k !== undefined; k = parents.get(k)) path.push(points.get(k)!);
  path.reverse();
  if (new Set(path.map(p => p.y * W + p.x)).size !== path.length) return [];
  const corners: Record<number, number> = { 6: 54, 12: 55, 3: 84, 9: 85, 1: 144, 4: 144, 5: 144, 2: 116, 8: 116, 10: 116 };
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!, neighbours = [path[i - 1], path[i + 1]].filter((v): v is DungeonPoint => !!v);
    const bits = DUNGEON_STEPS.reduce((mask, [dx, dy], bit) => mask | (neighbours.some(n => n.x === p.x + dx && n.y === p.y + dy) ? 1 << bit : 0), 0);
    // Preserve the board backing when a rail crosses a local cliff.
    if ([252, 253, 254].includes(map.upperTiles[p.y * W + p.x]!)) map.lowerTiles[p.y * W + p.x] = map.upperTiles[p.y * W + p.x]!;
    map.upperTiles[p.y * W + p.x] = corners[bits] ?? -1;
  }
  return path;
}
