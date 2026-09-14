import type { GameMap } from "@/project/types";
import { createDungeonTerrainAutotileGroups } from "@/project/defaults/dungeonTerrainAutotiles";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { stampCanonicalIceRidge } from "@/project/defaults/iceDiagonalTerrain";
import type { DungeonDesign, DungeonGraph, DungeonPoint } from "./topology";

export type DungeonMaterial = { floor: number; roof: number; roofKey: string; wallTop: number; wallBottom: number };
export function dungeonMaterial(theme: string, character: DungeonDesign["character"]): DungeonMaterial {
  if (theme === "ice") return { floor: 67, roof: 427, roofKey: "abyss-blue", wallTop: 373, wallBottom: 403 };
  if (character === "crypt") return { floor: 187, roof: 430, roofKey: "abyss-gray", wallTop: 22, wallBottom: 52 };
  return { floor: 421, roof: 310, roofKey: "pit-gold", wallTop: 226, wallBottom: 226 };
}
export function shapeDungeonTerrain(map: GameMap, key: string, cells: DungeonPoint[]): void {
  const group = createDungeonTerrainAutotileGroups().find(g => g.id.endsWith(`-${key}`));
  if (group) shapeAutotileGroupAround(map, group, cells);
}
export const DUNGEON_STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
export function dungeonPath(width: number, height: number, from: DungeonPoint, to: DungeonPoint, open: (x: number, y: number) => boolean): DungeonPoint[] | null {
  const start = from.y * width + from.x, end = to.y * width + to.x;
  if (!open(from.x, from.y) || !open(to.x, to.y)) return null;
  const queue = [start], parents = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length && !parents.has(end); i++) {
    const k = queue[i]!;
    for (const [dx, dy] of DUNGEON_STEPS) { const x = k % width + dx, y = Math.floor(k / width) + dy, n = y * width + x; if (x >= 0 && y >= 0 && x < width && y < height && !parents.has(n) && open(x, y)) { parents.set(n, k); queue.push(n); } }
  }
  if (!parents.has(end)) return null;
  const path: DungeonPoint[] = [];
  for (let k = end; k !== -1; k = parents.get(k)!) path.push({ x: k % width, y: Math.floor(k / width) });
  return path.reverse();
}
export function nearestDungeonFloor(point: DungeonPoint, width: number, height: number, open: (x: number, y: number) => boolean): DungeonPoint | null {
  for (let r = 0; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = point.x + dx, y = point.y + dy;
    if (Math.abs(dx) + Math.abs(dy) === r && x >= 0 && y >= 0 && x < width && y < height && open(x, y)) return { x, y };
  }
  return null;
}
export type DungeonCrossing = { x: number; top: number; bottom: number };
/** Native two-front confluence. Its flat tails stop against existing rock, never in open floor. */
export function stampDungeonConfluence(map: GameMap, graph: DungeonGraph, floor: number): DungeonCrossing[] {
  const room = [...graph.rooms].filter(r => r.width >= 22 && r.height >= 18).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!room) return [];
  const { width: W, height: H } = map, cx = room.x, cy = room.y;
  if (cx < 10 || cx > W - 10 || cy < 8 || cy > H - 8) return [];
  const before = [...map.lowerTiles], beforeUpper = [...map.upperTiles];
  const arrays = [[0, 0, 0, 1, 2, 2, 2, 1, 0, -1, -1, -1, -1, -1, -1], [2, 2, 2, 1, 0, -1, -1, -1, -1, 0, 1, 1, 1, 1, 1]];
  const contours = arrays.map((a, ci) => {
    const q: (number | null)[] = Array(W).fill(null), base = cy + (ci === 0 ? -4 : 0);
    for (let j = 0; j < 15; j++) q[cx - 7 + j] = base + a[j]!;
    for (const dir of [-1, 1]) { let x = dir < 0 ? cx - 8 : cx + 8; const top = base + a[dir < 0 ? 0 : 14]!; while (x > 1 && x < W - 2 && [0, 1, 2].every(dy => before[(top + dy) * W + x] === floor)) { q[x] = top; x += dir; } }
    return q;
  });
  type Span = { top: number; bottom: number; upper: number; lower: number };
  const spans: Span[][] = Array.from({ length: W }, () => []);
  for (let x = 0; x < W; x++) for (let ci = 0; ci < 2; ci++) {
    const top = contours[ci]![x]; if (top == null) continue;
    const last = spans[x]!.at(-1);
    if (last && top <= last.bottom + 1) { last.bottom = top + 2; last.lower = ci; }
    else spans[x]!.push({ top, bottom: top + 2, upper: ci, lower: ci });
  }
  for (let x = 0; x < W; x++) for (const s of spans[x]!) {
    const tq = contours[s.upper]!, bq = contours[s.lower]!, down = s.top > (tq[x - 1] ?? s.top), up = (tq[x + 1] ?? s.top) < s.top;
    // Reject a clipped diagonal rather than publishing a partial multi-tile face.
    if ((down || up) && Array.from({ length: s.bottom - s.top + 1 }, (_, i) => before[(s.top + i) * W + x]).some(t => t !== floor)) { map.lowerTiles = before; return []; }
    for (let y = s.top; y <= s.bottom; y++) {
      if (before[y * W + x] !== floor) continue;
      map.lowerTiles[y * W + x] = y === s.top ? down ? 162 : up ? 163 : 196 : y === s.bottom ? s.bottom > (bq[x - 1] ?? s.bottom - 2) + 2 ? 222 : (bq[x + 1] ?? s.bottom - 2) + 2 < s.bottom ? 223 : 226 : down ? 192 : up ? 193 : 226;
    }
  }
  const crossings: DungeonCrossing[] = [];
  for (const [x, ci] of [[cx + 5, 0], [cx - 6, 1]]) {
    const top = contours[ci!]![x!]!, span = spans[x!]!.find(s => s.upper <= ci! && s.lower >= ci!)!;
    if (top === null || !span) continue;
    for (let xx = x! - 1; xx <= x! + 1; xx++) for (let y = top; y <= span.bottom; y++) map.upperTiles[y * W + xx] = xx === x! - 1 ? 252 : xx === x! + 1 ? 254 : 253;
    crossings.push({ x: x!, top, bottom: span.bottom + 1 });
  }
  // Keep authored room centres connected. Add a crossing on a flat outer arm when
  // a chamber connection enters a different terrace; never cut a diagonal face.
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && ([floor, 196].includes(map.lowerTiles[y * W + x]!) || [252, 253, 254].includes(map.upperTiles[y * W + x]!));
  const goals = graph.rooms.map(r => nearestDungeonFloor(r, W, H, open));
  const connected = () => goals.every(p => p && dungeonPath(W, H, goals[0]!, p, open));
  if (!connected()) for (const ci of [0, 1]) {
    const candidates = Array.from({ length: W - 4 }, (_, i) => i + 2).filter(x => {
      const s = spans[x]!.find(v => v.upper === ci && v.lower === ci);
      return s && [-1, 0, 1].every(dx => {
        const n = spans[x + dx]!.find(v => v.upper === ci && v.lower === ci);
        return n && n.top === s.top && n.bottom === s.bottom && before[(n.top - 1) * W + x + dx] === floor && before[(n.bottom + 1) * W + x + dx] === floor;
      }) && !crossings.some(c => Math.abs(c.x - x) < 4);
    });
    const x = ci === 0 ? candidates[0] : candidates.at(-1);
    if (x === undefined) continue;
    const span = spans[x]!.find(v => v.upper === ci && v.lower === ci)!;
    for (let xx = x - 1; xx <= x + 1; xx++) for (let y = span.top; y <= span.bottom; y++) map.upperTiles[y * W + xx] = xx === x - 1 ? 252 : xx === x + 1 ? 254 : 253;
    crossings.push({ x, top: span.top, bottom: span.bottom + 1 });
    if (connected()) break;
  }
  if (!connected()) { map.lowerTiles = before; map.upperTiles = beforeUpper; return []; }
  return crossings;
}
export function stampDungeonIceRelief(map: GameMap, graph: DungeonGraph): boolean {
  for (const room of [...graph.rooms].sort((a, b) => b.width * b.height - a.width * a.height)) {
    const result = stampCanonicalIceRidge({ width: map.width, height: map.height, lower: map.lowerTiles }, { x: room.x - 5, y: room.y - 5 });
    if (result.ok) { map.lowerTiles = [...result.lower]; return true; }
  }
  return false;
}
