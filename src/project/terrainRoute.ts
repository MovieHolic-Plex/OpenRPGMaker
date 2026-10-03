import type { GameMap, Project } from "./types";
import { canMove, inBounds, isPassable } from "./collision";
export interface TerrainRoutePoint { x: number; y: number }
export interface TerrainRouteResult { reachable: boolean; path: TerrainRoutePoint[]; bottlenecks: TerrainRoutePoint[]; blocked: TerrainRoutePoint[]; reason: string }
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
export function inspectTerrainRoute(project: Project, map: GameMap, start: TerrainRoutePoint, end: TerrainRoutePoint, width = 3): TerrainRouteResult {
  if (!inBounds(map, start.x, start.y) || !inBounds(map, end.x, end.y) || !isPassable(project, map, start.x, start.y)) return { reachable: false, path: [], bottlenecks: [], blocked: [start], reason: "출발점이 통행 가능한 땅인지 확인하세요" };
  const count = map.width * map.height, parent = new Int32Array(count).fill(-1), queue = new Int32Array(count), s = start.y * map.width + start.x, goal = end.y * map.width + end.x;
  queue[0] = s; parent[s] = s; let length = 1, closest = s, best = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
  for (let n = 0; n < length; n++) {
    const i = queue[n]!, x = i % map.width, y = Math.floor(i / map.width), distance = Math.abs(x - end.x) + Math.abs(y - end.y);
    if (distance < best) { best = distance; closest = i; }
    if (i === goal) break;
    for (const [dx, dy] of DIRS) { const X = x + dx, Y = y + dy, j = Y * map.width + X; if (inBounds(map, X, Y) && parent[j] === -1 && canMove(project, map, x, y, X, Y)) { parent[j] = i; queue[length++] = j; } }
  }
  const reachable = parent[goal] !== -1, path: TerrainRoutePoint[] = []; let at = reachable ? goal : closest;
  for (;;) { path.push({ x: at % map.width, y: Math.floor(at / map.width) }); if (at === s) break; at = parent[at]!; } path.reverse();
  const blocked = reachable ? [] : DIRS.map(([dx, dy]) => ({ x: closest % map.width + dx, y: Math.floor(closest / map.width) + dy })).filter(p => inBounds(map, p.x, p.y) && !canMove(project, map, closest % map.width, Math.floor(closest / map.width), p.x, p.y) && Math.abs(p.x - end.x) + Math.abs(p.y - end.y) < best);
  const bottlenecks = path.filter((p, n) => {
    if (!n || n === path.length - 1) return false;
    const previous = path[n - 1]!, dx = p.y === previous.y ? 0 : 1, dy = dx ? 0 : 1;
    let span = 1;
    for (const sign of [-1, 1]) for (let k = 1; k < width; k++) { const from = { x: p.x + dx * sign * (k - 1), y: p.y + dy * sign * (k - 1) }, to = { x: p.x + dx * sign * k, y: p.y + dy * sign * k }; if (!canMove(project, map, from.x, from.y, to.x, to.y)) break; span++; }
    return span < width;
  });
  return { reachable, path, blocked: blocked.length ? blocked : reachable ? [] : [end], bottlenecks, reason: reachable ? `${path.length - 1}칸 경로 · 폭 ${width}칸 미만 병목 ${bottlenecks.length}칸` : "경로가 끊겼습니다 · 빨간 칸의 물·물체·단 차를 확인하세요" };
}
