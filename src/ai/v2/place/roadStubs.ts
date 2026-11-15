// 출구 없이 맵 가장자리까지 간 길은 마을 안에서 끝낸다 — 끝맺음 dead-end-roads 단계가 「막힌 길」 표지보다 먼저 부른다.
//
// 왜(2026-11-15 실모델 확인 판 r5 «물레강 마을» · «갈매기 포구»): 시작 자리 쪽 흙길이 맵 가장자리까지 뻗어 거기서 그냥 끝났다. 출구가 없으니
// 「막힌 길」 표지 둘과 이정표가 섰고, 사람 하나는 가장자리 칸에 서서 말을 걸 수 없었다. 마을을 떠나는 길은 출구에서 끝나거나, 마지막 집·사람·시작 자리에서 멈춘다.
// 규칙(버들항 바깥 맵): 가장자리에 닿은 길 묶음(4칸 이하, 2칸 안에 다른 맵으로 가는 이동이 없다)에서 안쪽으로 길을 따라 한 겹씩 들어가며
//   - 그 겹에 시작 자리·착지 칸·이벤트가 있거나(곁 1칸의 사람·문 포함), 2칸 안에 시공기가 세운 집·기물이 있거나, 길이 넓어지면(마당) 거기서 멈춘다.
//   - 그 겹을 걷으면 안쪽 길이 둘로 갈라지는 갈림목도 멈출 데다(곁길이 줄기에서 떨어지지 않게, 모퉁이 한 겹을 남긴다).
//   - 멈춘 겹 앞의 겹들(남는 길)은 곁의 맨 바닥 타일로 되돌리고, 새 길 끝의 오토타일 가장자리를 다시 맞춘다. 걷는 칸은 줄지 않는다(길 → 풀밭).
//   - 멈출 데를 못 찾으면(30겹 안에 아무것도 없다) 건드리지 않는다 — 그 길에는 예전대로 「막힌 길」 표지가 선다.
// 남는 길 위·곁의 「막힌 길」 표지(다시 끝맺을 때)는 걷는다. 새 그림은 그리지 않는다.
import { isPassable } from "@/project/collision";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { BuildRun } from "../shared/types";
import { isRoadCell, leavesMap } from "./surface";
import { incomingLandings } from "./where";

const MAX_RINGS = 30;
const DEAD_END = "ev_dead_end_";
type Cell = { x: number; y: number };

/** 이 맵으로 들어오는 착지 칸(다른 이벤트의 이동 명령 목적지)과 시작 자리. */
function arrivals(project: Project, mapId: string): Set<number> {
  const w = project.maps[mapId]!.width;
  const out = new Set(incomingLandings(project, mapId).map((c) => c.y * w + c.x));
  if (project.startMapId === mapId && project.startPos) out.add(project.startPos.y * w + project.startPos.x);
  return out;
}

/** 가장자리 길 묶음 하나에서 걷어 낼 겹들과 새 길 끝 겹. 멈출 데가 없으면 undefined. */
export function stubRings(project: Project, map: GameMap, group: readonly Cell[]): { drop: Cell[]; tip: Cell[] } | undefined {
  const w = map.width, h = map.height;
  const road = (x: number, y: number) => isRoadCell(project, map, x, y) && isPassable(project, map, x, y);
  const land = arrivals(project, map.id);
  const events = (map.events ?? []).filter((e) => !e.id.startsWith(DEAD_END));
  const rects = map.structurePlacements ?? [];
  // 가장자리 겹(edge)은 더 좁게 본다 — 그 칸 위의 이벤트·착지, 바로 곁(1칸)의 집·성문만. 집이 맵 끝 가까이 있어도 길은 가장자리 한 칸 앞에서 끝난다.
  const anchored = (c: Cell, edge: boolean): boolean => land.has(c.y * w + c.x)
    || events.some((e) => Math.max(Math.abs(e.x - c.x), Math.abs(e.y - c.y)) <= (edge || isRoadCell(project, map, e.x, e.y) ? 0 : 1))
    || rects.some((r) => Math.max(r.x - c.x, c.x - (r.x + r.w - 1), r.y - c.y, c.y - (r.y + r.h - 1), 0) <= (edge ? 1 : 2));
  const seen = new Set(group.map((c) => c.y * w + c.x));
  // 남은 길에서 이 칸들이 서로 이어져 있나 — 걷어 낸 겹(seen) 밖의 길로만 걷는다. 갈림목을 지나 걷으면 곁길이 줄기에서 떨어진다.
  const joined = (cells: readonly Cell[]): boolean => {
    if (cells.length <= 1) return true;
    const want = new Set(cells.map((c) => c.y * w + c.x)), got = new Set<number>([cells[0]!.y * w + cells[0]!.x]);
    const queue = [cells[0]!];
    for (let k = 0; k < queue.length && got.size < 4000; k += 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = queue[k]!.x + dx, y = queue[k]!.y + dy, i = y * w + x;
      if (x < 0 || y < 0 || x >= w || y >= h || got.has(i) || (seen.has(i) && !want.has(i)) || !road(x, y)) continue;
      got.add(i); queue.push({ x, y });
    }
    return [...want].every((i) => got.has(i));
  };
  let ring: Cell[] = [...group];
  const rings: Cell[][] = [];
  for (let depth = 0; depth < MAX_RINGS && ring.length; depth += 1) {
    // 멈출 데: 시작 자리·사람·집 곁, 또는 넓어진 길(마당) — 그 겹이 새 길 끝이다
    if (ring.some((c) => anchored(c, depth === 0)) || ring.length > group.length + 2) return rings.length ? { drop: rings.flat(), tip: ring } : undefined;
    const next: Cell[] = [];
    for (const c of ring) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = c.x + dx, y = c.y + dy, i = y * w + x;
      if (x < 0 || y < 0 || x >= w || y >= h || seen.has(i) || !road(x, y)) continue;
      seen.add(i); next.push({ x, y });
    }
    // 갈림목: 이 겹을 걷으면 안쪽 길이 둘로 갈라진다 — 이 겹은 두고, 모퉁이가 패이지 않게 바로 앞 겹도 남긴다
    if (!joined(next)) { const tip = rings.pop(); return tip && rings.length ? { drop: rings.flat(), tip } : undefined; }
    rings.push(ring);
    ring = next;
  }
  return undefined;
}

export function pullBackEdgeStubs(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const map0 = run.ctx.project.maps[mapId];
  if (!map0 || map0.tilesetId !== "beodeul_city") return notes;
  if ((map0 as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor") return notes;
  const w = map0.width, h = map0.height;
  const sides: Cell[][] = [
    Array.from({ length: w }, (_, x) => ({ x, y: 0 })), Array.from({ length: w }, (_, x) => ({ x, y: h - 1 })),
    Array.from({ length: h }, (_, y) => ({ x: 0, y })), Array.from({ length: h }, (_, y) => ({ x: w - 1, y })),
  ];
  for (const side of sides) {
    const groups: Cell[][] = [];
    let cur: Cell[] = [];
    for (const c of side) {
      if (isRoadCell(run.ctx.project, map0, c.x, c.y) && isPassable(run.ctx.project, map0, c.x, c.y)) cur.push(c);
      else { if (cur.length) groups.push(cur); cur = []; }
    }
    if (cur.length) groups.push(cur);
    for (const group of groups) {
      if (group.length > 4) continue;
      const project = run.ctx.project, map = project.maps[mapId]!;
      const gate = (e: GameEvent) => leavesMap(e.pages ?? (e as unknown as { commands?: unknown }).commands, mapId);
      if ((map.events ?? []).some((e) => gate(e) && group.some((c) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 2))) continue;
      const cut = stubRings(project, map, group);
      if (!cut) continue;
      // 곁의 맨 바닥 — 남는 길 곁의 길 아닌 걷는 칸에 가장 많이 쓴 바닥 타일(오토타일 구성원이 아닌 것)
      const tileset = project.tilesets[map.tilesetId];
      const surface = tilesetSurface(tileset);
      const autotiled = new Set((tileset?.autotileGroups ?? []).flatMap((g) => g.memberTileIds));
      const counts = new Map<number, number>();
      for (const c of cut.drop) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h || isRoadCell(project, map, x, y) || !isPassable(project, map, x, y)) continue;
        const t = map.lowerTiles[y * w + x];
        if (typeof t === "number" && t >= 0 && !autotiled.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const ground = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (ground === undefined) continue;
      const material = surface.lay.find((l) => cut.tip.some((c) => l.tiles.has(map.lowerTiles[c.y * w + c.x] ?? -1)))?.material;
      const lower = [...map.lowerTiles];
      const overlay = map.lowerOverlayTiles ? [...map.lowerOverlayTiles] : undefined;
      for (const c of cut.drop) { lower[c.y * w + c.x] = ground; if (overlay && surface.road.has(overlay[c.y * w + c.x] ?? -1)) overlay[c.y * w + c.x] = -1; }
      const near = (e: GameEvent) => cut.drop.some((c) => Math.abs(c.x - e.x) + Math.abs(c.y - e.y) <= 3);
      const events = map.events.filter((e) => !(e.id.startsWith(DEAD_END) && near(e)));
      run.ctx.project = { ...project, maps: { ...project.maps, [mapId]: { ...map, lowerTiles: lower, ...(overlay ? { lowerOverlayTiles: overlay } : {}), events } } } as Project;
      // 새 길 끝의 가장자리 그림을 다시 맞춘다(같은 길 재료로 그 겹만 다시 칠한다) — 실패해도 길은 이미 끝났다
      if (material) for (const c of cut.tip) run.call("fill_region", { mapId, material, rect: { x: c.x, y: c.y, w: 1, h: 1 }, _exactCells: true });
      notes.push(`출구 없이 가장자리 ${group.map((c) => `(${c.x},${c.y})`).join("")}까지 간 길 ${cut.drop.length}칸을 걷었다 — 길이 (${cut.tip[0]!.x},${cut.tip[0]!.y}) 에서 끝난다`);
    }
  }
  return notes;
}
