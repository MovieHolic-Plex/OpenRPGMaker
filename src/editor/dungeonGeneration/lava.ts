/**
 * 용암 동굴 지형 — 방을 가로지르는 불의 강 하나(다리 자리만 곧게, 판자 다리 upper 141)와
 * 가장자리가 불규칙한 용암 웅덩이. 문서(tiledata/rpg-dungeons/dungeon-lava-cave.md)의 칸을 그대로 쓴다:
 * 적암 바닥 301, 용암 오토타일(몸통 304), 판자 다리 141. 용암 칸은 통행 불가, 다리는 통행 가능.
 */
import type { GameMap } from "@/project/types";
import { createDungeonTerrainAutotileGroups } from "@/project/defaults/dungeonTerrainAutotiles";
import { dungeonPath, nearestDungeonFloor, shapeDungeonTerrain, DUNGEON_STEPS } from "./terrain";
import type { DungeonGraph, DungeonPoint } from "./topology";

export const LAVA_BODY = 304;
export const LAVA_BRIDGE = 141;
const lavaGroup = createDungeonTerrainAutotileGroups().find(g => g.id.endsWith("-lava"));
export const LAVA_TILES: ReadonlySet<number> = new Set(lavaGroup?.memberTileIds ?? [LAVA_BODY]);

export type LavaRiver = { cells: DungeonPoint[]; bridge: DungeonPoint[] };

/**
 * 가장 큰 비입구 방을 동서로 가로지르는 불의 강. 강 끝은 바위(바닥이 아닌 칸)에서 멈춘다.
 * 다리 자리(2칸 폭)는 강 폭 3줄로 곧게 두고 위아래에 딛는 바닥이 있어야 한다.
 * 모든 방이 다리를 건너 입구와 이어질 때만 남기고, 아니면 되돌린다.
 */
export function stampLavaRiver(map: GameMap, graph: DungeonGraph, floor: number, random: () => number): LavaRiver | null {
  const W = map.width, H = map.height, before = [...map.lowerTiles], beforeUpper = [...map.upperTiles];
  const isFloor = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && before[y * W + x] === floor;
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
    && (map.upperTiles[y * W + x] === LAVA_BRIDGE || map.lowerTiles[y * W + x] === floor && map.upperTiles[y * W + x] === -1);
  const connected = (): boolean => {
    const goals = graph.rooms.map(r => nearestDungeonFloor(r, W, H, open));
    const entrance = goals[Math.max(0, graph.rooms.findIndex(r => r.role === "entrance"))];
    return !!entrance && goals.every(p => p && dungeonPath(W, H, entrance, p, open));
  };
  const rooms = graph.rooms.filter(r => r.role !== "entrance").sort((a, b) => b.width * b.height - a.width * a.height);
  // 먼저 방 안에서 양끝이 바위에 닿는 자리(여유 2칸)를 찾고, 없으면 통로 쪽으로 조금 더(6칸) 흘려 본다.
  // 여유가 크면 강이 방을 가로지르지 않고 가로 통로를 따라 눕는다.
  for (const slack of [2, 6]) for (const room of rooms) for (const yOff of [0, 1, -1, 2, -2, 3, -3]) for (const bOff of [0, -2, 2, -3, 3]) {
    const bx = room.x + bOff, y0 = room.y + yOff;
    const amp = room.height >= 10 ? 1.6 : 1.1, freq = .42 + random() * .2, phase = random() * Math.PI * 2;
    const sideSign = [random() < .5 ? -1 : 1, random() < .5 ? -1 : 1];
    // 다리 두 칸(bx, bx+1)과 그 양옆 한 칸은 곧게 3줄. 거기서 멀어질수록 굽이치고 가끔 4줄로 부푼다.
    // (2줄이면 몸통 없이 가장자리 타일만 남아 가는 금처럼 보인다.)
    const topAt = (x: number) => {
      const d = x < bx ? Math.max(0, bx - 1 - x) : Math.max(0, x - bx - 2);
      return y0 + Math.round(amp * Math.sin(d * freq) * sideSign[x < bx ? 0 : 1]!);
    };
    const thickAt = (x: number) => (x >= bx - 1 && x <= bx + 2) ? 3 : 3 + (Math.sin(x * .9 + phase) > .3 ? 1 : 0);
    // 다리 자리: 강 세 줄이 모두 바닥이었고, 위·아래에 딛는 바닥이 있어야 한다.
    if (![bx, bx + 1].every(x => [-1, 0, 1, 2, 3].every(dy => isFloor(x, y0 + dy)))) continue;
    const cells: DungeonPoint[] = [];
    let ok = true, columns = 0;
    for (const dir of [-1, 1]) {
      const limit = Math.ceil(room.width / 2) + slack;
      for (let step = 0, x = dir < 0 ? bx : bx + 1; ; step++, x += dir) {
        if (step > limit) { ok = false; break; }
        const top = topAt(x), t = thickAt(x);
        const column: DungeonPoint[] = [];
        for (let y = top; y < top + t; y++) if (isFloor(x, y)) column.push({ x, y });
        if (!column.length) break; // 바위에 닿았다 — 강 끝.
        cells.push(...column); columns++;
      }
      if (!ok) break;
    }
    if (!ok || columns < Math.max(6, Math.round(room.width * .6))) continue;
    for (const p of cells) map.lowerTiles[p.y * W + p.x] = LAVA_BODY;
    const bridge: DungeonPoint[] = [];
    for (const x of [bx, bx + 1]) for (const y of [y0, y0 + 1, y0 + 2]) { map.upperTiles[y * W + x] = LAVA_BRIDGE; bridge.push({ x, y }); }
    if (connected()) {
      shapeDungeonTerrain(map, "lava", cells);
      return { cells, bridge };
    }
    map.lowerTiles = [...before]; map.upperTiles = [...beforeUpper];
  }
  return null;
}

/**
 * 방마다 가장자리가 불규칙한 용암 웅덩이 1~2개. 예약된 길과 그 바로 옆 칸은 건드리지 않는다.
 * 4칸 미만 조각은 지우고, 용암에 갇혀 입구에서 닿지 않는 작은 바닥 섬(8칸 이하)은 용암으로 메운다.
 */
export function stampLavaPools(map: GameMap, graph: DungeonGraph, floor: number, reserved: ReadonlySet<number>, entrance: DungeonPoint, random: () => number): DungeonPoint[] {
  const W = map.width, H = map.height;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const bare = (x: number, y: number) => inside(x, y) && map.lowerTiles[y * W + x] === floor && map.upperTiles[y * W + x] === -1;
  const nearRoute = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (reserved.has((y + dy) * W + x + dx)) return true;
    return false;
  };
  const painted: number[] = [];
  for (const room of graph.rooms) {
    if (room.role === "entrance") continue;
    const count = room.width * room.height >= 120 ? 2 : 1;
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = room.y - Math.floor(room.height / 2); y <= room.y + Math.floor(room.height / 2); y++) for (let x = room.x - Math.floor(room.width / 2); x <= room.x + Math.floor(room.width / 2); x++) {
      if (!bare(x, y) || nearRoute(x, y)) continue;
      let route = 6;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (reserved.has((y + dy) * W + x + dx)) route = Math.min(route, Math.hypot(dx, dy));
      candidates.push({ x, y, score: route + random() * .8 });
    }
    candidates.sort((a, b) => b.score - a.score);
    const centres: DungeonPoint[] = [];
    for (const c of candidates) {
      if (centres.length >= count) break;
      if (centres.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 6)) continue;
      centres.push(c);
      const rx = 2.4 + random() * 1.4, ry = 1.7 + random() * 1.0, ph = random() * Math.PI * 2;
      for (let y = c.y - 4; y <= c.y + 4; y++) for (let x = c.x - 5; x <= c.x + 5; x++) {
        const n = Math.sin(x * 1.3 + y * .7 + ph) * .28 + Math.cos(x * .5 - y * 1.1 + ph) * .22;
        if (((x - c.x) / rx) ** 2 + ((y - c.y) / ry) ** 2 >= 1 + n || !bare(x, y) || nearRoute(x, y)) continue;
        map.lowerTiles[y * W + x] = LAVA_BODY; painted.push(y * W + x);
      }
    }
  }
  // 가장자리 다듬기: 한 칸짜리 곶(가로세로 이웃 용암 ≤1)은 바닥으로, 세 면이 용암인 바닥 틈은 용암으로.
  // 다리 밑 용암과 예약된 길 곁은 건드리지 않는다. 용암을 줄이는 쪽은 통행을 끊지 않는다.
  const isLava = (x: number, y: number) => inside(x, y) && LAVA_TILES.has(map.lowerTiles[y * W + x]!);
  const lavaAround = (x: number, y: number) => DUNGEON_STEPS.filter(([dx, dy]) => isLava(x + dx, y + dy)).length;
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x;
    if (map.upperTiles[k] === LAVA_BRIDGE || map.lowerTiles[k] === LAVA_BRIDGE) continue;
    if (isLava(x, y) && lavaAround(x, y) <= 1) { map.lowerTiles[k] = floor; painted.push(k); }
    else if (bare(x, y) && !nearRoute(x, y) && lavaAround(x, y) >= 3) { map.lowerTiles[k] = LAVA_BODY; painted.push(k); }
  }
  // 한두 칸짜리 용암 부스러기는 네모 스티커처럼 보인다 — 4칸 미만 조각은 바닥으로 되돌린다.
  const seen = new Set<number>();
  for (const start of painted) {
    if (seen.has(start) || map.lowerTiles[start] !== LAVA_BODY) continue;
    const comp = [start]; seen.add(start);
    for (let i = 0; i < comp.length; i++) for (const [dx, dy] of DUNGEON_STEPS) {
      const x = comp[i]! % W + dx, y = Math.floor(comp[i]! / W) + dy, n = y * W + x;
      if (inside(x, y) && !seen.has(n) && LAVA_TILES.has(map.lowerTiles[n]!)) { seen.add(n); comp.push(n); }
    }
    if (comp.length < 4 && comp.every(k => painted.includes(k))) for (const k of comp) map.lowerTiles[k] = floor;
  }
  // 용암(과 벽)에 갇혀 입구에서 닿지 않는 작은 바닥 섬 메우기.
  const walk = (x: number, y: number) => inside(x, y) && (map.upperTiles[y * W + x] === LAVA_BRIDGE || map.lowerTiles[y * W + x] === LAVA_BRIDGE || map.lowerTiles[y * W + x] === floor);
  const reach = new Set<number>([entrance.y * W + entrance.x]);
  const queue = [entrance.y * W + entrance.x];
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of DUNGEON_STEPS) {
    const x = queue[i]! % W + dx, y = Math.floor(queue[i]! / W) + dy, n = y * W + x;
    if (walk(x, y) && !reach.has(n)) { reach.add(n); queue.push(n); }
  }
  const filled = new Set<number>();
  for (let k = 0; k < W * H; k++) {
    if (reach.has(k) || filled.has(k) || map.lowerTiles[k] !== floor) continue;
    const comp = [k]; filled.add(k);
    for (let i = 0; i < comp.length; i++) for (const [dx, dy] of DUNGEON_STEPS) {
      const x = comp[i]! % W + dx, y = Math.floor(comp[i]! / W) + dy, n = y * W + x;
      if (inside(x, y) && !filled.has(n) && map.lowerTiles[n] === floor) { filled.add(n); comp.push(n); }
    }
    const lavaLocked = comp.length <= 8 && comp.some(c => DUNGEON_STEPS.some(([dx, dy]) => {
      const x = c % W + dx, y = Math.floor(c / W) + dy;
      return inside(x, y) && LAVA_TILES.has(map.lowerTiles[y * W + x]!);
    }));
    if (lavaLocked && comp.every(c => map.upperTiles[c] === -1)) for (const c of comp) { map.lowerTiles[c] = LAVA_BODY; painted.push(c); }
  }
  // 되돌린 칸도 성형 기준점에 넣어야 그 이웃 가장자리가 다시 맞춰진다.
  const touched = [...new Set(painted)].map(k => ({ x: k % W, y: Math.floor(k / W) }));
  shapeDungeonTerrain(map, "lava", touched);
  return touched.filter(p => LAVA_TILES.has(map.lowerTiles[p.y * W + p.x]!));
}

export function countLava(map: GameMap): { lava: number; bridge: number } {
  let lava = 0, bridge = 0;
  for (let k = 0; k < map.lowerTiles.length; k++) {
    if (LAVA_TILES.has(map.lowerTiles[k]!)) lava++;
    if (map.upperTiles[k] === LAVA_BRIDGE && LAVA_TILES.has(map.lowerTiles[k]!)) bridge++;
  }
  return { lava, bridge };
}
