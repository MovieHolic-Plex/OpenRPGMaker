// dress_joseon_market — 조선(joseon_baram) 마을 맵에 장터 좌판 덩이를 한 번에 앉힌다(2026-10-22 마을 종류 표 「조선 장터 마을」).
// 실조수 시험(r1): 모델이 조선 마을 20호를 가져온 뒤 좌판을 손으로 찍다 7번 거절되고, 남은 4개가 관아 마당·밭가에 흩어져 장터로 읽히지 않았다.
// 이 도구는 길에 앞을 둔 3×3 빈 자리(9칸 모두 통행·위층 그림 없음)를 기준점 가까이부터 고르고, 좌판 사이 1칸을 띄우며,
// 찍을 때마다 통행을 다시 재서 원래 닿던 칸(문 앞·길)을 끊는 자리는 되돌린다. 좌판 그림은 번들 조각(jb-market_stall*) 그대로다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const JOSEON = "joseon_baram";
const STALLS = ["jb-market_stall", "jb-market_stall_cloth", "jb-market_stall_pots"] as const;
const SIZE = 3;

const stampTool = (() => {
  const tool = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object");
  if (!tool) throw new Error("stamp_object 가 없습니다");
  return tool;
})();

function reachable(project: Project, map: GameMap, from: { x: number; y: number }): Set<number> {
  const seen = new Set<number>();
  if (!isPassable(project, map, from.x, from.y)) return seen;
  const queue = [from.y * map.width + from.x];
  seen.add(queue[0]!);
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % map.width, y = Math.floor(i / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const ni = ny * map.width + nx;
      if (seen.has(ni) || !isPassable(project, map, nx, ny)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

/** 가장 큰 통행 덩이의 한 칸 — 끊김 검사의 출발점. */
function mainComponentSeed(project: Project, map: GameMap): { x: number; y: number } | null {
  const done = new Set<number>();
  let best: { seed: { x: number; y: number }; size: number } | null = null;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    if (done.has(i) || !isPassable(project, map, x, y)) continue;
    const comp = reachable(project, map, { x, y });
    for (const c of comp) done.add(c);
    if (!best || comp.size > best.size) best = { seed: { x, y }, size: comp.size };
  }
  return best?.seed ?? null;
}

function freeCell(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  if ((map.upperTiles[i] ?? -1) >= 0) return false;
  if (map.events.some((e) => e.x === x && e.y === y)) return false;
  return isPassable(project, map, x, y);
}

export const DRESS_JOSEON_MARKET_TOOL: ToolDefinition = {
  name: "dress_joseon_market",
  mode: "write",
  domains: ["map"],
  description:
    "조선(joseon_baram) 마을 맵에 장터 좌판(jb-market_stall·_cloth·_pots, 3×3) 덩이를 한 번에 앉힌다 — 「조선 장터 마을」은 import_region_reference({id:\"joseon-v20-64x56\"}) 뒤 이 도구 한 번. "
    + "트인 풀밭·흙 마당에서 좌판이 가장 많이 들어가는 자리(또는 near 가까이)를 골라 길을 덮지 않고 좌판 사이 1칸을 띄우고, 찍을 때마다 통행을 다시 재서 길·문 앞을 끊는 자리는 되돌린다. 좌판을 stamp_object 로 하나씩 찍어 흩지 말 것.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "joseon_baram 맵 id" },
      count: { type: "integer", minimum: 2, maximum: 10, description: "좌판 수(기본 6)" },
      near: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false, description: "장터 자리 기준점(생략하면 맵에서 좌판 덩이가 가장 크게 들어가는 트인 풀밭·마당을 고른다)" },
      radius: { type: "integer", minimum: 4, maximum: 30, description: "기준점에서 찾을 반경(near 를 주면 기본 14, 안 주면 맵 전체에서 좌판이 가장 많이 들어가는 자리)" },
    },
    required: ["mapId"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_ref_joseon_v20_64x56", count: 6 },
  run(draft, args): ToolExecResult {
    const map = draft.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${String(args.mapId)}`, { code: "map-not-found" });
    if (map.tilesetId !== JOSEON) throw new ToolError(`dress_joseon_market 은 joseon_baram 맵 전용이다(이 맵: ${map.tilesetId}).`, { code: "wrong-tileset", mapId: map.id });
    const want = Number.isInteger(args.count) ? Math.max(2, Math.min(10, args.count as number)) : 6;
    const nearArg = args.near as { x?: unknown; y?: unknown } | undefined;
    const near = nearArg && Number.isInteger(nearArg.x) && Number.isInteger(nearArg.y) ? { x: nearArg.x as number, y: nearArg.y as number } : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    const radius = Number.isInteger(args.radius) ? (args.radius as number) : nearArg ? 14 : Math.max(map.width, map.height);
    const seed = mainComponentSeed(draft, map);
    if (!seed) throw new ToolError("맵에 걸을 수 있는 칸이 없다.", { code: "no-walkable", mapId: map.id });
    const base = reachable(draft, map, seed);

    // 바닥 갈래: 걸을 수 있는 칸의 절반 이상을 덮는 흔한 바닥 = 풀밭. 나머지(흙길·마당)는 길로 보고, 좌판은 길을 덮지 않는다 —
    // 다만 사방 7칸 넘게 트인 흙 마당(광장)은 장터 자리다. 첫 시험에서 좌판이 큰길·세로길 위에 앉았다.
    const counts = new Map<number, number>();
    let walk = 0;
    for (let i = 0; i < map.lowerTiles.length; i++) {
      if (!isPassable(draft, map, i % map.width, Math.floor(i / map.width))) continue;
      walk++;
      counts.set(map.lowerTiles[i]!, (counts.get(map.lowerTiles[i]!) ?? 0) + 1);
    }
    const grass = new Set<number>();
    let covered = 0;
    for (const [tile, n] of [...counts.entries()].sort((p, q) => q[1] - p[1])) { if (covered >= walk / 2) break; grass.add(tile); covered += n; }
    const isGrass = (x: number, y: number) => grass.has(map.lowerTiles[y * map.width + x]!);
    const run = (x: number, y: number, dx: number, dy: number) => { let n = 0; for (let k = -8; k <= 8; k++) { const nx = x + dx * k, ny = y + dy * k; if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !isGrass(nx, ny) && freeCell(draft, map, nx, ny)) n++; } return n; };
    const plazaCell = (x: number, y: number) => !isGrass(x, y) && run(x, y, 1, 0) >= 7 && run(x, y, 0, 1) >= 7;
    // 후보: 9칸 비고(풀밭이거나 넓은 흙 마당), 앞줄(아래 한 줄) 3칸이 걸을 수 있는 자리. 앞줄이 길·마당이면 먼저.
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = 0; y + SIZE < map.height; y++) for (let x = 0; x + SIZE <= map.width; x++) {
      const d = Math.hypot(x + 1 - near.x, y + 1 - near.y);
      if (d > radius) continue;
      let ok = true;
      for (let dy = 0; dy < SIZE && ok; dy++) for (let dx = 0; dx < SIZE && ok; dx++) ok = freeCell(draft, map, x + dx, y + dy);
      if (!ok) continue;
      let ground = true;
      for (let dy = 0; dy < SIZE && ground; dy++) for (let dx = 0; dx < SIZE && ground; dx++) ground = isGrass(x + dx, y + dy) || plazaCell(x + dx, y + dy);
      if (!ground) continue;
      const front = [0, 1, 2].map((dx) => freeCell(draft, map, x + dx, y + SIZE));
      if (!front.every(Boolean)) continue;
      const road = [0, 1, 2].filter((dx) => !isGrass(x + dx, y + SIZE)).length;
      candidates.push({ x, y, score: d - road * 2 });
    }
    candidates.sort((a, b) => a.score - b.score);
    // 덩이가 가장 크게 들어갈 자리부터 — 기준점 가까운 자리가 좌판 한두 개뿐이면 장터로 읽히지 않는다(첫 시험: 조선 마을 20호 가운데는 빈 3×3 이 둘뿐).
    const packAround = (anchor: { x: number; y: number }) => {
      const picked: { x: number; y: number }[] = [];
      for (const c of candidates) {
        if (picked.length >= want) break;
        if (Math.hypot(c.x - anchor.x, c.y - anchor.y) > 10) continue;
        if (picked.some((p) => c.x < p.x + SIZE + 1 && c.x + SIZE + 1 > p.x && c.y < p.y + SIZE + 1 && c.y + SIZE + 1 > p.y)) continue;
        picked.push(c);
      }
      return picked.length;
    };
    let anchor = candidates[0];
    let anchorFit = anchor ? packAround(anchor) : 0;
    if (!nearArg) for (const c of candidates.slice(0, 200)) { const fit = packAround(c); if (fit > anchorFit) { anchor = c; anchorFit = fit; } }
    if (anchor) candidates.sort((a, b) => Math.hypot(a.x - anchor!.x, a.y - anchor!.y) - Math.hypot(b.x - anchor!.x, b.y - anchor!.y) || a.score - b.score);

    const placed: { x: number; y: number; objectId: string }[] = [];
    const taken = (x: number, y: number) => placed.some((p) => x < p.x + SIZE + 1 && x + SIZE + 1 > p.x && y < p.y + SIZE + 1 && y + SIZE + 1 > p.y);
    let rejected = 0;
    for (const c of candidates) {
      if (placed.length >= want) break;
      if (taken(c.x, c.y)) continue;
      // 이미 놓은 좌판과 너무 멀면(덩이가 흩어지면) 건너뛴다 — 첫 좌판에서 반경 10 안.
      if (placed.length && Math.hypot(c.x - placed[0]!.x, c.y - placed[0]!.y) > 10) continue;
      const objectId = `kit:${JOSEON}/${STALLS[placed.length % STALLS.length]}`;
      const snapshot = structuredClone(draft.maps[map.id]!);
      const startBefore = draft.startPos ? { ...draft.startPos } : undefined;
      try {
        stampTool.run(draft, { objectId, mapId: map.id, x: c.x, y: c.y });
      } catch {
        rejected++;
        draft.maps[map.id] = snapshot;
        continue;
      }
      const current = draft.maps[map.id]!;
      const after = reachable(draft, current, freeCell(draft, current, seed.x, seed.y) ? seed : { x: c.x + 1, y: c.y + SIZE });
      let cut = false;
      for (const i of base) {
        const x = i % map.width, y = Math.floor(i / map.width);
        const inStall = placed.concat([{ x: c.x, y: c.y, objectId }]).some((p) => x >= p.x && x < p.x + SIZE && y >= p.y && y < p.y + SIZE);
        if (!inStall && !after.has(i)) { cut = true; break; }
      }
      if (cut) {
        rejected++;
        draft.maps[map.id] = snapshot;
        if (startBefore) draft.startPos = startBefore;
        continue;
      }
      placed.push({ x: c.x, y: c.y, objectId });
    }
    if (!placed.length) {
      throw new ToolError(`near (${near.x},${near.y}) 반경 ${radius} 안에 길에 앞을 둔 3×3 빈 자리가 없다 — near 를 넓은 마당·큰길가로 옮기거나 radius 를 키운다.`, { code: "no-market-slot", mapId: map.id });
    }
    return {
      summary: `조선 장터 좌판 ${placed.length}개를 (${placed[0]!.x},${placed[0]!.y}) 둘레에 앉혔다${placed.length < want ? ` (원한 ${want}개 중 — 빈 자리 부족)` : ""}. 길·문 앞 통행은 그대로다.`,
      data: { mapId: map.id, stalls: placed, rejected },
      ...(placed.length < want ? { warnings: [`좌판 ${want}개 중 ${placed.length}개만 놓았다 — 빈 자리가 모자란다. 다른 마당에 더하려면 near 를 바꿔 한 번 더 부른다.`] } : {}),
    };
  },
};
