// 버들항 조수 결과·예시 배치를 재는 자. 조수 시험(scripts/qa/beodeul-assistant-run.mts)과 예시 배치 저작(author-beodeul-layouts.mts)이 같이 쓴다.
//   originality  원본(정본 맵)과 같은 좌표에서 (아래층, 윗층)이 같은 칸의 비율
//   districts    구역 키트 8+ 가 맵에 찍혀 있는가(찍은 좌표 == 원본 원점인가)
//   reach        문 앞 칸이 육지로 이어지는가 / 포장 길망으로 이어지는가
//   defects      막다른 포장길, 물에 닿아 끝나는 길, 막힌 문 앞, 같은 조각 일렬(3 이상), 통행 없는 빈 포장
import type { GameMap, Project, StructureKitDef, TilesetDef } from "../../../src/project/types.ts";
import { canMove } from "../../../src/project/collision.ts";

export interface Stamp { objectId: string; x: number; y: number }
export const CANON_ORIGIN: Record<string, [number, number]> = {
  "bd-castle": [0, 0], "bd-estate": [36, 2], "bd-forum": [54, 34], "bd-cathedral": [82, 3],
  "bd-windmill": [1, 34], "bd-harbour": [36, 62], "bd-harbour-west": [0, 62], "bd-river-bridge": [26, 24],
};
const PAVED = ["road", "plaza", "bridge", "stair", "gate", "pier", "sand"];

function kitsOf(ts: TilesetDef): Map<string, StructureKitDef> { return new Map((ts.structureKits ?? []).map((k) => [k.id, k])); }
function kindOf(ts: TilesetDef, t: number): string[] { return (ts.tileMeta?.[t]?.tags ?? []) as string[]; }

export function analyzeBeodeul(project: Project, mapId: string, stamps: Stamp[], canon?: { lower: number[]; upper: number[] }) {
  const map: GameMap = project.maps[mapId]!; const ts = project.tilesets[map.tilesetId]!; const W = map.width, H = map.height; const kits = kitsOf(ts);
  const idx = (x: number, y: number) => y * W + x;
  // ---- originality ----
  let same = 0, sameNonEmpty = 0, nonEmpty = 0;
  if (canon) for (let i = 0; i < W * H; i += 1) {
    const eq = map.lowerTiles[i] === canon.lower[i] && map.upperTiles[i] === canon.upper[i];
    if (eq) same += 1;
    if (map.upperTiles[i] >= 0 || canon.upper[i] >= 0) { nonEmpty += 1; if (eq) sameNonEmpty += 1; }
  }
  // ---- districts ----
  const kitStamps = stamps.map((s) => ({ ...s, id: s.objectId.replace(/^kit:beodeul_city\//, "") })).filter((s) => kits.has(s.id));
  const districts = Object.keys(CANON_ORIGIN).map((id) => {
    const hit = kitStamps.filter((s) => s.id === id);
    const ok = (s: { x: number; y: number }) => { const k = kits.get(id)!; let match = 0, total = 0;
      for (let j = 0; j < k.height; j += 1) for (let i = 0; i < k.width; i += 1) { const r = k.rows[j]!; const lo = r.tiles[i]!, up = r.upperTiles?.[i] ?? -1;
        if (lo < 0 && up < 0) continue; total += 1; const x = s.x + i, y = s.y + j; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if ((lo < 0 || map.lowerTiles[idx(x, y)] === lo) && (up < 0 || map.upperTiles[idx(x, y)] === up)) match += 1; }
      return total ? match / total : 0; };
    return { id, stamped: hit.length, present: hit.some((s) => ok(s) > 0.9), atOriginalOrigin: hit.some((s) => s.x === CANON_ORIGIN[id]![0] && s.y === CANON_ORIGIN[id]![1]),
      origins: hit.map((s) => [s.x, s.y]) };
  });
  // ---- paved network + door fronts ----
  const paved = (x: number, y: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const kinds = kindOf(ts, map.lowerTiles[idx(x, y)]!); const up = map.upperTiles[idx(x, y)]!;
    if (up >= 0) { const uk = kindOf(ts, up); if (uk.includes("prop") || uk.includes("building") || uk.includes("tree")) return false; }
    return PAVED.some((k) => kinds.includes(k)); };
  const water = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && kindOf(ts, map.lowerTiles[idx(x, y)]!).includes("water");
  const doors: { kit: string; x: number; y: number; front: [number, number] }[] = [];
  for (const s of kitStamps) for (const p of kits.get(s.id)!.parts ?? []) if (p.kind === "entrance") doors.push({ kit: s.id, x: s.x + p.dx, y: s.y + p.dy, front: [s.x + p.dx, s.y + p.dy + p.h] });
  const bfs = (start: [number, number], ok: (x: number, y: number) => boolean, step: (a: [number, number], b: [number, number]) => boolean) => {
    const seen = new Set<number>([idx(...start)]); const q: [number, number][] = [start];
    while (q.length) { const [x, y] = q.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(idx(nx, ny))) continue; if (!ok(nx, ny) || !step([x, y], [nx, ny])) continue; seen.add(idx(nx, ny)); q.push([nx, ny]); } }
    return seen; };
  const walk = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && canMove(project, map, x, y, x, y) !== undefined;
  const can = (a: [number, number], b: [number, number]) => canMove(project, map, a[0], a[1], b[0], b[1]);
  const landOk = (x: number, y: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; return true; };
  // land reach from the first door front (canMove decides)
  let landReach = { total: doors.length, reached: 0, unreached: [] as unknown[] };
  let streetReach = { total: doors.length, reached: 0, unreached: [] as unknown[] };
  if (doors.length) {
    // the largest paved component is "the street network"
    const seenP = new Set<number>(); let best = new Set<number>();
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (paved(x, y) && !seenP.has(idx(x, y))) { const comp = bfs([x, y], paved, can); comp.forEach((v) => seenP.add(v)); if (comp.size > best.size) best = comp; }
    const startFront = doors.find((d) => best.has(idx(d.front[0], d.front[1])))?.front ?? doors[0]!.front;
    const land = bfs(startFront as [number, number], landOk, can);
    for (const d of doors) {
      const li = idx(d.front[0], d.front[1]);
      if (land.has(li)) landReach.reached += 1; else landReach.unreached.push({ kit: d.kit, front: d.front });
      if (best.has(li)) streetReach.reached += 1; else streetReach.unreached.push({ kit: d.kit, front: d.front });
    }
  }
  // ---- defects ----
  const doorFronts = new Set(doors.map((d) => idx(d.front[0], d.front[1])));
  const deadEnds: [number, number][] = [], intoWater: [number, number][] = [];
  // cells that a stamped kit itself owns (its baked paths, courtyards, stoops) are not authored streets
  const kitOwned = new Set<number>();
  for (const s of kitStamps) { if (/^bd-ground-/.test(s.id)) continue; const k = kits.get(s.id)!; for (let j = 0; j < k.height; j += 1) for (let i = 0; i < k.width; i += 1) {
    const t = k.rows[j]!.tiles[i] ?? -1; const x = s.x + i, y = s.y + j; if (t >= 0 && x < W && y < H && map.lowerTiles[idx(x, y)] === t) kitOwned.add(idx(x, y)); } }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!paved(x, y) || doorFronts.has(idx(x, y)) || kitOwned.has(idx(x, y))) continue;
    const kinds = kindOf(ts, map.lowerTiles[idx(x, y)]!);
    if (!kinds.includes("road") && !kinds.includes("sand")) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => paved(x + dx!, y + dy!)).length;
    const onEdge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    if (n <= 1 && !onEdge) deadEnds.push([x, y]);
    if (!kinds.includes("bridge") && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => water(x + dx!, y + dy!)) && n <= 1) intoWater.push([x, y]);
  }
  // wide street ends: a run (≤3 cells) of paved road cells that all lack a neighbour on one side, with nothing paved just beyond
  // either end of the run, and every cell continuing on the other side. (A 2-wide street's end cells have two paved neighbours,
  // so the per-cell count above never sees them.)
  const isRoad = (x: number, y: number) => paved(x, y) && !kitOwned.has(idx(x, y)) && (kindOf(ts, map.lowerTiles[idx(x, y)]!).some((k) => k === "road" || k === "sand"));
  const streetEnds: [number, number][] = [];
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const px = dy, py = dx; // run direction (perpendicular)
    const seen = new Set<number>();
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (seen.has(idx(x, y)) || !isRoad(x, y) || paved(x + dx, y + dy) || !paved(x - dx, y - dy)) continue;
      const run: [number, number][] = []; let cx = x, cy = y;
      while (cx >= 0 && cy >= 0 && cx < W && cy < H && isRoad(cx, cy) && !paved(cx + dx, cy + dy) && paved(cx - dx, cy - dy)) { run.push([cx, cy]); seen.add(idx(cx, cy)); cx += Math.abs(px); cy += Math.abs(py); }
      if (run.length < 2 || run.length > 3) continue;
      const [ax, ay] = run[0]!, [bx, by] = run[run.length - 1]!;
      if (paved(ax - Math.abs(px), ay - Math.abs(py)) || paved(bx + Math.abs(px), by + Math.abs(py))) continue;
      const edge = run.some(([rx, ry]) => rx + dx < 0 || ry + dy < 0 || rx + dx >= W || ry + dy >= H);
      if (edge || run.some(([rx, ry]) => doorFronts.has(idx(rx, ry)))) continue;
      if (run.some(([rx, ry]) => water(rx + dx, ry + dy))) intoWater.push(run[0]!); else streetEnds.push(run[0]!);
    }
  }
  const blockedFronts = doors.filter((d) => !can([d.front[0], d.front[1] - 1], [d.front[0], d.front[1]]) && !paved(d.front[0], d.front[1])).map((d) => ({ kit: d.kit, front: d.front }));
  // same building kit three times in a row (same y band, within 3 cells of each other)
  const houseStamps = kitStamps.filter((s) => /^bd-(house|tree|prop)-/.test(s.id)).sort((a, b) => a.y - b.y || a.x - b.x);
  const repeats: unknown[] = [];
  for (let i = 0; i + 2 < houseStamps.length; i += 1) { const a = houseStamps[i]!, b = houseStamps[i + 1]!, c = houseStamps[i + 2]!;
    if (a.id === b.id && b.id === c.id && Math.abs(a.y - b.y) <= 1 && Math.abs(b.y - c.y) <= 1 && b.x - a.x <= 12 && c.x - b.x <= 12) repeats.push({ id: a.id, at: [a.x, a.y] }); }
  // object cells outside the district boxes (what the assistant designed itself, as in round 1)
  const cellsInKits = new Set<number>();
  for (const s of kitStamps) { if (!(s.id in CANON_ORIGIN)) continue; const k = kits.get(s.id)!; for (let j = 0; j < k.height; j += 1) for (let i = 0; i < k.width; i += 1) cellsInKits.add(idx(s.x + i, s.y + j)); }
  let designedObjects = 0; for (let i = 0; i < W * H; i += 1) if (map.upperTiles[i]! >= 0 && !cellsInKits.has(i)) designedObjects += 1;
  const emptiness = emptinessOf(map, ts);
  return {
    emptiness,
    originality: canon ? { sameCells: same, ofCells: W * H, sameShare: +(same / (W * H)).toFixed(4), sameShareOfObjectCells: nonEmpty ? +(sameNonEmpty / nonEmpty).toFixed(4) : 0 } : null,
    districts, districtsPresent: districts.filter((d) => d.present).length, districtsAtOriginalOrigin: districts.filter((d) => d.atOriginalOrigin).length,
    stampedKits: kitStamps.length, doors: doors.length, landReach, streetReach,
    defects: { deadEndPavedCells: deadEnds, deadEndStreets: streetEnds, roadIntoWater: intoWater, blockedDoorFronts: blockedFronts, sameKitRepeats: repeats },
    designedObjectCells: designedObjects,
  };
}

/** Emptiness, the supervisor's round-3 criterion (one 20×15 screen may be at most 40% empty floor). Two readings:
 *  - `lawn`: no object (upper -1) on the base lawn (grass group or a lawn-patch kit tile) — strict bare lawn;
 *  - `open`: no object on WALKABLE ground that is not a road / canal / sand autotile or a paving / plaza tile — every unbuilt,
 *    unpaved floor cell (flower lawn, tufts, garden ground too). Buildings drawn on the lower layer are not walkable, so they stay out.
 *  The map is cut into 20×15 screens (the last row/column may be short). */
export function emptinessOf(map: GameMap, ts: any, sw = 20, sh = 15, limit = 0.4) {
  const lawn = new Set<number>(), built = new Set<number>();
  for (const g of (ts.tileGroups ?? []) as any[]) for (const t of g.tileIds) (g.id === "beodeul:grass" ? lawn : built).add(t);
  for (const k of (ts.structureKits ?? []) as any[]) if (/^bd-ground-lawn-/.test(k.id)) for (const r of k.rows) for (const t of r.tiles) if (t >= 0) lawn.add(t);
  const walk = (v: unknown): void => { if (typeof v === "number") built.add(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  for (const a of (ts.autotileGroups ?? []) as any[]) { walk(a.memberTileIds); walk(a.variantMap); }
  for (const t of lawn) built.delete(t);
  const W = map.width, H = map.height;
  const walkable = (t: number) => { const p = ts.passability?.[t]; return !p || p.up || p.down || p.left || p.right; };
  const test = { lawn: (i: number) => map.upperTiles[i]! < 0 && lawn.has(map.lowerTiles[i]!), open: (i: number) => map.upperTiles[i]! < 0 && !built.has(map.lowerTiles[i]!) && walkable(map.lowerTiles[i]!) };
  const read = (fn: (i: number) => boolean) => {
    let total = 0; for (let i = 0; i < W * H; i += 1) if (fn(i)) total += 1;
    const screens: { x: number; y: number; share: number }[] = [];
    for (let y0 = 0; y0 < H; y0 += sh) for (let x0 = 0; x0 < W; x0 += sw) {
      let n = 0, p = 0; for (let y = y0; y < Math.min(H, y0 + sh); y += 1) for (let x = x0; x < Math.min(W, x0 + sw); x += 1) { n += 1; if (fn(y * W + x)) p += 1; }
      screens.push({ x: x0, y: y0, share: +(p / n).toFixed(3) });
    }
    const over = screens.filter((s) => s.share > limit);
    return { share: +(total / (W * H)).toFixed(4), screens: screens.length, over40: over.length, worst: Math.max(...screens.map((s) => s.share)), overAt: over.map((s) => [s.x, s.y, s.share]) };
  };
  return { lawn: read(test.lawn), open: read(test.open) };
}
