import type { GameMap, Project } from "./types";
import { canMove, canMoveFootprint, inBounds, isPassable } from "./collision";
import { startSession, type PlaySession } from "./session";
import { passageBounds, rectCells, rectsOverlap } from "./footprint";
import { runtimeEventViewsForMap, initialRuntimeEventPositions, type RuntimeEventPositions } from "./runtimeEventState";
import { runtimeMap } from "./runtimeMap";
import { isSpatialPlacementBlocking } from "./spatialOccupancy";
export interface TerrainRouteOptions {
  bodyWidth: number; bodyHeight: number; passRows: number; events: boolean;
  doors: "authored" | "open" | "closed"; doorId?: string;
  switches: Record<string, boolean>;
  session?: PlaySession; positions?: RuntimeEventPositions;
}
export interface TerrainRoutePoint { x: number; y: number }
export interface TerrainRouteResult { reachable: boolean; path: TerrainRoutePoint[]; bottlenecks: TerrainRoutePoint[]; blocked: TerrainRoutePoint[]; reason: string }
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
export function inspectTerrainRoute(project: Project, map: GameMap, start: TerrainRoutePoint, end: TerrainRoutePoint, width = 3, options?: TerrainRouteOptions): TerrainRouteResult {
  const session = options?.session ? structuredClone(options.session) : options ? startSession(project) : undefined;
  if (session && options) { Object.assign(session.switches, options.switches); map = runtimeMap(map, session); }
  const fp = { width: options?.bodyWidth ?? 1, height: options?.bodyHeight ?? 1 }, rows = Math.min(options?.passRows ?? fp.height, fp.height);
  const blockers = session && options?.events ? runtimeEventViewsForMap(project, map, session, options.positions ?? initialRuntimeEventPositions(map.events)).filter(v => {
    if (v.event.id === options.doorId) return options.doors === "closed" || options.doors === "authored" && v.priority === "same" && v.overlapForbidden;
    return v.priority === "same" && v.overlapForbidden;
  }) : [];
  const occupied = (x: number, y: number) => { const rect = passageBounds(x,y,fp,rows); return blockers.some(v => rectsOverlap(v.passRect,rect)) || !!(session && isSpatialPlacementBlocking(project,session,map.id,rect)); };
  const step = (x: number, y: number, X: number, Y: number) => (options ? canMoveFootprint(project,map,x,y,fp,X,Y,rows) && !occupied(X,Y) : canMove(project,map,x,y,X,Y));
  const startPassable = rectCells(passageBounds(start.x,start.y,fp,rows)).every(p => inBounds(map,p.x,p.y) && isPassable(project,map,p.x,p.y)) && !occupied(start.x,start.y);
  if (!inBounds(map, start.x, start.y) || !inBounds(map, end.x, end.y) || !startPassable) return { reachable: false, path: [], bottlenecks: [], blocked: [start], reason: "출발점이 통행 가능한 땅인지 확인하세요" };
  const count = map.width * map.height, parent = new Int32Array(count).fill(-1), queue = new Int32Array(count), s = start.y * map.width + start.x, goal = end.y * map.width + end.x;
  queue[0] = s; parent[s] = s; let length = 1, closest = s, best = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
  for (let n = 0; n < length; n++) {
    const i = queue[n]!, x = i % map.width, y = Math.floor(i / map.width), distance = Math.abs(x - end.x) + Math.abs(y - end.y);
    if (distance < best) { best = distance; closest = i; }
    if (i === goal) break;
    for (const [dx, dy] of DIRS) { const X = x + dx, Y = y + dy, j = Y * map.width + X; if (inBounds(map, X, Y) && parent[j] === -1 && step(x, y, X, Y)) { parent[j] = i; queue[length++] = j; } }
  }
  const reachable = parent[goal] !== -1, path: TerrainRoutePoint[] = []; let at = reachable ? goal : closest;
  for (;;) { path.push({ x: at % map.width, y: Math.floor(at / map.width) }); if (at === s) break; at = parent[at]!; } path.reverse();
  const blocked = reachable ? [] : DIRS.map(([dx, dy]) => ({ x: closest % map.width + dx, y: Math.floor(closest / map.width) + dy })).filter(p => inBounds(map, p.x, p.y) && !step(closest % map.width, Math.floor(closest / map.width), p.x, p.y) && Math.abs(p.x - end.x) + Math.abs(p.y - end.y) < best);
  const bottlenecks = path.filter((p, n) => {
    if (!n || n === path.length - 1) return false;
    const previous = path[n - 1]!, dx = p.y === previous.y ? 0 : 1, dy = dx ? 0 : 1;
    let span = 1;
    for (const sign of [-1, 1]) for (let k = 1; k < width; k++) { const from = { x: p.x + dx * sign * (k - 1), y: p.y + dy * sign * (k - 1) }, to = { x: p.x + dx * sign * k, y: p.y + dy * sign * k }; if (!step(from.x, from.y, to.x, to.y)) break; span++; }
    return span < width;
  });
  return { reachable, path, blocked: blocked.length ? blocked : reachable ? [] : [end], bottlenecks, reason: reachable ? `${path.length - 1}칸 경로 · 폭 ${width}칸 미만 병목 ${bottlenecks.length}칸` : "경로가 끊겼습니다 · 빨간 칸의 물·물체·높이·문·NPC를 확인하세요" };
}
