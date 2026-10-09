// editor/tools/wildRouteTool.ts
// 몬스터 수집 장르의 「도로」 맵 — 마을과 마을(동굴·체육관) 사이를 잇는 흙길, 양옆 숲, 길을 가로지르는
// 키큰 풀숲, 풀숲에서만 나오는 야생 조우를 한 번에 시공한다.
//
// 왜 따로 있나(2026-09-24 도그푸딩): 조수는 create_map 으로 빈 잔디 28×22 를 만들고 place_props 로 나무를
// 심으려다 참고문서 게이트에 막혀 끝났다 — 1번 도로가 무늬 없는 초록 벌판, 조우는 맵 전체에서 났다.
// generate_map(forest) 는 forest_harmony 팔레트를 거부한다. 이 도구는 참고문서를 읽어도 결과가 같은
// 결정론 파이프라인이라 타일을 직접 고르지 않는다(마을 시공기의 길·나무·키큰 풀 부품을 그대로 쓴다).

import { TILE } from "@/project/defaults/constants";
import { canMove } from "@/project/collision";
import type { EncounterTableEntry, GameEvent, GameMap, MapNamedLocation, Project, Rect } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";
import { requireMap } from "./mapHelpers";
import { BEODEUL_PLAIN_GRASS, canPaintBeodeulWildRoute, paintBeodeulWildRoute } from "./wildRouteBeodeul";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Point = { x: number; y: number };
const GRASS_LOCATION_PREFIX = "loc_wild_grass_";
const DEFAULT_ROUTE_ENCOUNTER_RATE = 20;

function edgeExit(map: GameMap, value: unknown, label: string): Point {
  const record = value as { x?: unknown; y?: unknown } | null;
  const x = Number(record?.x), y = Number(record?.y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
    throw new ToolError(`${label}는 맵 안 {x,y} 정수 좌표여야 합니다(맵 ${map.width}×${map.height}).`, { code: "invalid-args", mapId: map.id });
  }
  if (x !== 0 && y !== 0 && x !== map.width - 1 && y !== map.height - 1) {
    throw new ToolError(`${label} (${x},${y})는 맵 가장자리 칸이어야 합니다 — 도로 출구는 다음 맵으로 넘어가는 문 자리다.`, { code: "invalid-args", mapId: map.id });
  }
  return { x, y };
}

/** 4칸 격자 값 잡음 — 길이 곧게 뻗지 않고 느슨하게 휘게 한다. */
function noiseField(map: GameMap, rng: Rng): (x: number, y: number) => number {
  const cell = 4;
  const gw = Math.ceil(map.width / cell) + 2, gh = Math.ceil(map.height / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => rng());
  return (x, y) => {
    const gx = x / cell, gy = y / cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
    const at = (a: number, b: number) => grid[b * gw + a]!;
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

/** 두 출구 사이 최소 비용 경로(가장자리 두 칸은 출구 근처만 허용). */
function routePath(map: GameMap, from: Point, to: Point, noise: (x: number, y: number) => number): Point[] {
  const w = map.width, h = map.height;
  const allowed = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const near = (p: Point) => Math.abs(p.x - x) + Math.abs(p.y - y) <= 2;
    if (near(from) || near(to)) return true;
    return x >= 2 && y >= 2 && x < w - 2 && y < h - 2;
  };
  const dist = new Float64Array(w * h).fill(Infinity);
  const prev = new Int32Array(w * h).fill(-1);
  const start = from.y * w + from.x, goal = to.y * w + to.x;
  dist[start] = 0;
  // 맵은 최대 수십×수십 — 선형 탐색 다익스트라로 충분하다.
  const open = new Set<number>([start]);
  while (open.size) {
    let current = -1, best = Infinity;
    for (const index of open) if (dist[index]! < best) { best = dist[index]!; current = index; }
    open.delete(current);
    if (current === goal) break;
    const cx = current % w, cy = Math.floor(current / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (!allowed(nx, ny)) continue;
      const next = ny * w + nx;
      const cost = best + 1 + noise(nx, ny) * 6;
      if (cost < dist[next]!) { dist[next] = cost; prev[next] = current; open.add(next); }
    }
  }
  if (prev[goal] === -1 && goal !== start) throw new ToolError("두 출구를 잇는 길을 찾지 못했습니다.", { code: "wild-route-no-path", mapId: map.id });
  const out: Point[] = [];
  for (let index = goal; index !== -1; index = prev[index]!) out.push({ x: index % w, y: Math.floor(index / w) });
  return out.reverse();
}

/**
 * 꺾임 비용을 준 경로 — 버들항 도로용(2026-10-06). 잡음 경로는 대각선으로 갈 때 한 칸씩 꺾여 계단이 됐다.
 * 포켓몬 도로처럼 곧게 뻗다가 직각으로 꺾이게 방향을 상태에 넣고 꺾일 때마다 turnCost 를 더한다. 잡음은 약하게만 섞는다.
 */
function routePathStraight(map: GameMap, from: Point, to: Point, noise: (x: number, y: number) => number, turnCost = 6): Point[] {
  const w = map.width, h = map.height;
  const allowed = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const near = (p: Point) => Math.abs(p.x - x) + Math.abs(p.y - y) <= 2;
    if (near(from) || near(to)) return true;
    return x >= 2 && y >= 2 && x < w - 2 && y < h - 2;
  };
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  // 상태 = 칸 × 들어온 방향(4) + 출발 상태(방향 없음, 4번).
  const states = w * h * 5;
  const dist = new Float64Array(states).fill(Infinity);
  const prev = new Int32Array(states).fill(-1);
  const start = (from.y * w + from.x) * 5 + 4;
  dist[start] = 0;
  const open = new Set<number>([start]);
  let goalState = -1;
  while (open.size) {
    let current = -1, best = Infinity;
    for (const state of open) if (dist[state]! < best) { best = dist[state]!; current = state; }
    open.delete(current);
    const cell = Math.floor(current / 5), dir = current % 5;
    const cx = cell % w, cy = Math.floor(cell / w);
    if (cx === to.x && cy === to.y) { goalState = current; break; }
    dirs.forEach(([dx, dy], d) => {
      const nx = cx + dx, ny = cy + dy;
      if (!allowed(nx, ny)) return;
      const next = (ny * w + nx) * 5 + d;
      const cost = best + 1 + noise(nx, ny) * 1.5 + (dir !== 4 && dir !== d ? turnCost : 0);
      if (cost < dist[next]!) { dist[next] = cost; prev[next] = current; open.add(next); }
    });
  }
  if (goalState === -1) throw new ToolError("두 출구를 잇는 길을 찾지 못했습니다.", { code: "wild-route-no-path", mapId: map.id });
  const out: Point[] = [];
  for (let state = goalState; state !== -1; state = prev[state]!) {
    const cell = Math.floor(state / 5);
    out.push({ x: cell % w, y: Math.floor(cell / w) });
  }
  return out.reverse();
}

function rectCells(map: GameMap, rect: Rect): number[] {
  const out: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) out.push(y * map.width + x);
  }
  return out;
}

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h;
}

function reachable(project: Project, map: GameMap, from: Point, to: Point): boolean {
  const seen = new Set<number>([from.y * map.width + from.x]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    if (p.x === to.x && p.y === to.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.x + dx, ny = p.y + dy, key = ny * map.width + nx;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key)) continue;
      if (!canMove(project, map, p.x, p.y, nx, ny)) continue;
      seen.add(key); queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

function authoredCells(map: GameMap, ground: number): number {
  let count = 0;
  for (let i = 0; i < map.width * map.height; i++) {
    const lower = map.lowerTiles[i] ?? TILE.EMPTY, upper = map.upperTiles[i] ?? TILE.EMPTY;
    if ((lower !== ground && lower !== TILE.EMPTY) || upper !== TILE.EMPTY) count++;
  }
  return count;
}

/** transfer·callMapEvent 를 가진 문(출입구) 이벤트 — 파이프라인이 미리 만든 링크 문도 포함. */
function isRelayEvent(event: GameEvent): boolean {
  const scan = (commands: readonly unknown[] | undefined): boolean => {
    for (const raw of commands ?? []) {
      if (!raw || typeof raw !== "object") continue;
      const command = raw as Record<string, unknown>;
      if (command.kind === "transfer" || command.kind === "callMapEvent") return true;
      for (const value of Object.values(command)) {
        if (Array.isArray(value) && scan(value)) return true;
        if (value && typeof value === "object") for (const inner of Object.values(value as Record<string, unknown>)) if (Array.isArray(inner) && scan(inner)) return true;
      }
    }
    return false;
  };
  return scan(event.commands) || (event.pages ?? []).some(page => scan(page.commands));
}

interface RouteCorridor { path: Point[]; road: Set<number>; patches: Rect[]; grass: Set<number> }

/**
 * S자 길(폭 2)·기존 문까지 끄는 길·길을 가로지르는 풀숲 사각형을 정한다. 칠하지는 않는다 —
 * 버들항(포석·짙은 풀, wildRouteBeodeul.ts)이 칠한다.
 */
function planRouteCorridor(map: GameMap, exits: readonly Point[], patchCount: number, rng: Rng, noise: (x: number, y: number) => number,
  relayDoors: readonly GameEvent[], warnings: string[],
  route: (from: Point, to: Point) => Point[] = (from, to) => routePath(map, from, to, noise), pruneLoops = false): RouteCorridor {
  const path: Point[] = [];
  // 출구 사이에 옆으로 비낀 경유점 둘을 두어 길이 S자로 굽게 한다(곧은 복도 방지).
  const clampInner = (p: Point): Point => ({ x: Math.max(3, Math.min(map.width - 4, Math.round(p.x))), y: Math.max(3, Math.min(map.height - 4, Math.round(p.y))) });
  const stops: Point[] = [exits[0]!];
  for (let i = 0; i + 1 < exits.length; i++) {
    const a = exits[i]!, b = exits[i + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy));
    const px = -dy / length, py = dx / length, swing = Math.max(3, Math.min(map.width, map.height) / 4);
    const side = rng() < 0.5 ? -1 : 1;
    stops.push(clampInner({ x: a.x + dx / 3 + px * swing * side, y: a.y + dy / 3 + py * swing * side }));
    stops.push(clampInner({ x: a.x + (dx * 2) / 3 - px * swing * side, y: a.y + (dy * 2) / 3 - py * swing * side }));
    stops.push(b);
  }
  for (let i = 0; i + 1 < stops.length; i++) {
    const segment = route(stops[i]!, stops[i + 1]!);
    path.push(...(i === 0 ? segment : segment.slice(1)));
  }
  // 직선 경로(버들항)는 경유점까지 갔다가 같은 칸으로 되돌아와 막다른 가지를 남긴다 — 다시 밟은 칸 사이 고리를 잘라 낸다.
  if (pruneLoops) {
    for (let i = 0; i < path.length; i++) {
      let last = -1;
      for (let j = path.length - 1; j > i; j--) if (path[j]!.x === path[i]!.x && path[j]!.y === path[i]!.y) { last = j; break; }
      if (last > i) path.splice(i + 1, last - i);
    }
  }
  // 폭 2 길: 세로로 가는 칸은 오른쪽, 가로로 가는 칸은 아래 칸을 붙인다.
  const road = new Set<number>();
  path.forEach((p, i) => {
    const next = path[i + 1] ?? path[i - 1] ?? p;
    road.add(p.y * map.width + p.x);
    const vertical = next.x === p.x;
    const ox = vertical ? p.x + 1 : p.x, oy = vertical ? p.y : p.y + 1;
    if (ox < map.width && oy < map.height) road.add(oy * map.width + ox);
  });

  // 기존 transfer 문(동굴·체육관 파이프라인이 링크로 미리 만든 출입구 포함)까지 흙길을 끌어 온다.
  // 안 그러면 replace 재시공이 그 문을 숲 우물에 가두고, 갈아끼운 뒤에는 길이 없어
  // 「1번 도로 → 동굴」 단계에서 엔딩이 끊긴다(2026-09-24 포켓몬풍 r3 실측 (1,1) 링크 문).
  for (const door of relayDoors) {
    let nearest = path[0]!, nearestDistance = Infinity;
    for (const p of path) {
      const distance = Math.abs(p.x - door.x) + Math.abs(p.y - door.y);
      if (distance < nearestDistance) { nearestDistance = distance; nearest = p; }
    }
    if (nearestDistance === 0) continue;
    try {
      for (const p of route({ x: door.x, y: door.y }, nearest)) road.add(p.y * map.width + p.x);
      road.add(door.y * map.width + door.x);
    } catch {
      warnings.push(`기존 문 (${door.x},${door.y})${door.name ? ` '${door.name}'` : ""} 까지 길을 끌 수 없습니다 — 출구와 문이 이어지도록 지형을 확인하세요.`);
    }
  }

  // 풀숲: 길 위 고른 간격 지점을 중심으로, 길을 가로지르게 둔다(돌아갈 수 없게 — 포켓몬 도로의 문법).
  const patches: Rect[] = [];
  for (let i = 0; i < patchCount; i++) {
    const anchor = path[Math.floor(((i + 1) / (patchCount + 1)) * (path.length - 1))]!;
    for (let attempt = 0; attempt < 6; attempt++) {
      const w = 4 + Math.floor(rng() * 4), h = 3 + Math.floor(rng() * 3);
      const rect = {
        x: Math.max(1, Math.min(map.width - 1 - w, anchor.x - Math.floor(w / 2) + Math.round((rng() - 0.5) * 3))),
        y: Math.max(1, Math.min(map.height - 1 - h, anchor.y - Math.floor(h / 2) + Math.round((rng() - 0.5) * 2))),
        w, h,
      };
      const nearExit = exits.some(exit => exit.x >= rect.x - 2 && exit.x < rect.x + rect.w + 2 && exit.y >= rect.y - 2 && exit.y < rect.y + rect.h + 2);
      if (nearExit || patches.some(other => overlaps(rect, other, 1))) continue;
      patches.push(rect);
      break;
    }
  }
  if (patches.length < patchCount) warnings.push(`풀숲 ${patchCount}개 중 ${patches.length}개만 자리를 찾았습니다(맵이 좁거나 출구가 가깝습니다).`);
  const grass = new Set(patches.flatMap(rect => rectCells(map, rect)));
  return { path, road, patches, grass };
}

const authorWildRoute: ToolDefinition = {
  name: "author_wild_route",
  description:
    "몬스터 수집(포켓몬풍) 도로·필드 맵을 시공한다: 출구와 출구를 잇는 흙길, 양옆 숲, 길을 가로지르는 키큰 풀숲 패치, "
    + "그리고 풀숲 안에서만 나오는 야생 조우(encounters → 풀숲마다 로케이션 「풀숲 N」 + encounterTable locationId 조건). "
    + "create_map 으로 만든 빈 잔디 맵에 쓴다(버들항 beodeul_city 계열 — 곧게 뻗다 직각으로 꺾이는 모랫길·짙은 잎 풀숲·길 양옆을 막는 나무 벽·길섶 숲길 소품). 타일을 직접 고르지 않는 결정론 시공이라 참고문서 선행 읽기가 필요 없다. "
    + "exits 는 가장자리 칸 — 다음에 create_transfer_pair 로 그 칸에 문을 단다. 결과 data.trainerSpots 는 길가 트레이너 자리 후보다(place_npc 로 배치). "
    + "이미 타일이 칠해진 맵은 replace:true 일 때만 다시 깐다(이벤트는 보존).",
  mode: "write",
  invalidArgsExample: { mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId: "troop_wild_1", weight: 60 }] },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "시공할 도로 맵 id(create_map 으로 먼저 만든다)" },
      exits: {
        type: "array",
        description: "가장자리 출구 칸 2개 이상 [{x,y}] — 순서대로 길로 잇는다. 예: 남쪽 마을 쪽 (14,21) → 북쪽 동굴 쪽 (14,0)",
        items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      },
      grassPatches: { type: "integer", description: "길을 가로지르는 키큰 풀숲 개수(1~6, 기본 3)" },
      encounters: {
        type: "array",
        description: "풀숲에서 나올 야생 무리 [{troopId, weight}] — 조회한 troop id. 풀숲 밖(흙길·숲)에서는 조우가 없다.",
        items: { type: "object", properties: { troopId: { type: "string" }, weight: { type: "integer" } }, required: ["troopId", "weight"] },
      },
      encounterRate: { type: "integer", description: `풀숲 조우율(기본 ${DEFAULT_ROUTE_ENCOUNTER_RATE})` },
      seed: { type: "integer", description: "길 굽이·풀숲·숲 무늬 시드(기본 1)" },
      replace: { type: "boolean", description: "이미 칠해진 맵을 다시 깔지(기본 false). 이벤트는 그대로 둔다." },
    },
    required: ["mapId", "exits"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !canPaintBeodeulWildRoute(tileset)) {
      throw new ToolError(`author_wild_route 는 버들항 타일셋 맵에서만 시공합니다(현재 ${map.tilesetId}). 숲마을·combined_town 도로는 2026-10-07 저작권 정리로 지웠습니다.`, { code: "wild-route-tileset", mapId: map.id });
    }
    if (map.width < 12 || map.height < 12) throw new ToolError("도로 맵은 12×12 이상이어야 합니다.", { code: "invalid-args", mapId: map.id });
    if (!Array.isArray(args.exits) || args.exits.length < 2) throw new ToolError("exits 는 가장자리 출구 2개 이상이어야 합니다.", { code: "invalid-args", mapId: map.id });
    const exits = args.exits.map((exit, index) => edgeExit(map, exit, `exits[${index}]`));
    const patchCount = args.grassPatches === undefined ? 3 : Number(args.grassPatches);
    if (!Number.isInteger(patchCount) || patchCount < 1 || patchCount > 6) throw new ToolError("grassPatches 는 1~6 정수입니다.", { code: "invalid-args", mapId: map.id });
    const seed = args.seed === undefined ? 1 : Number(args.seed);
    if (!Number.isInteger(seed)) throw new ToolError("seed 는 정수입니다.", { code: "invalid-args", mapId: map.id });
    const encounterInput = args.encounters === undefined ? [] : args.encounters;
    if (!Array.isArray(encounterInput)) throw new ToolError("encounters 는 배열입니다.", { code: "invalid-args", mapId: map.id });
    const encounters = encounterInput.map((entry, index) => {
      const record = entry as { troopId?: unknown; weight?: unknown };
      const troopId = typeof record?.troopId === "string" ? record.troopId : "";
      if (!draft.database.troops.some(troop => troop.id === troopId)) {
        throw new ToolError(`encounters[${index}].troopId 가 없는 troop 입니다: ${troopId || "(비어 있음)"} — upsert_troop 로 만든 id: ${draft.database.troops.slice(-8).map(t => t.id).join(", ")}`, { code: "troop-not-found", mapId: map.id });
      }
      const weight = record.weight === undefined ? 1 : Number(record.weight);
      if (!Number.isInteger(weight) || weight <= 0) throw new ToolError(`encounters[${index}].weight 는 1 이상 정수입니다.`, { code: "invalid-args", mapId: map.id });
      return { troopId, weight };
    });
    const ground = BEODEUL_PLAIN_GRASS;
    const painted = authoredCells(map, ground);
    if (painted > 0 && args.replace !== true) {
      throw new ToolError(`이 맵에는 이미 칠한 칸이 ${painted}개 있습니다. 다시 깔려면 replace:true 를 주세요(이벤트는 보존). 새 도로라면 create_map 으로 빈 맵을 먼저 만드세요.`, { code: "wild-route-map-not-blank", mapId: map.id });
    }
    const warnings: string[] = [];
    // 도로는 필드 맵이다 — stamp_object 가 이 표시를 보고 마을·항구 소품을 거른다(routePropPolicy.ts).
    map.mapRole ??= "field";
    const size = map.width * map.height;
    map.lowerTiles = Array.from({ length: size }, () => ground);
    map.upperTiles = Array.from({ length: size }, () => TILE.EMPTY);
    delete map.lowerTileStacks;
    delete map.upperTileStacks;

    const rng = mulberry32(seed ^ 0x5eed17);
    const noise = noiseField(map, rng);
    const relayDoors = map.events.filter(event => isRelayEvent(event));
    // 버들항: 길 계획을 포석·짙은 잎 풀·버들항 나무 키트로 칠한다(wildRouteBeodeul.ts).
    // 숲마을·combined_town 분기(흙길·키큰 풀 오토타일·굽이숲)는 2026-10-07 저작권 정리로 지웠다.
    const { path, road, patches, grass } = planRouteCorridor(map, exits, patchCount, rng, noise, relayDoors, warnings,
      (from, to) => routePathStraight(map, from, to, noise), true);
    const laid = paintBeodeulWildRoute({ project: draft, map, tileset, road, grass, patches, exits, rng });
    const roadCellCount = laid.roadCells;
    const treeCells = laid.treeCells;
    const fillNote = `, 길섶 소품 ${laid.decor}개, 풀숲은 짙은 잎 풀(버들항엔 키큰 풀이 없다)`;

    for (let i = 0; i + 1 < exits.length; i++) {
      if (!reachable(draft, map, exits[i]!, exits[i + 1]!)) warnings.push(`출구 (${exits[i]!.x},${exits[i]!.y}) → (${exits[i + 1]!.x},${exits[i + 1]!.y}) 가 걸어서 이어지지 않습니다 — show_map_region 으로 확인하세요.`);
    }
    for (const door of relayDoors) {
      if (!reachable(draft, map, exits[0]!, { x: door.x, y: door.y })) {
        warnings.push(`기존 문 (${door.x},${door.y})${door.name ? ` '${door.name}'` : ""} 가 출구 (${exits[0]!.x},${exits[0]!.y}) 에서 걸어서 이어지지 않습니다 — 주변 지형을 확인하세요.`);
      }
    }

    // 풀숲 로케이션 + 풀숲 한정 조우. 이전에 이 도구가 만든 풀숲 로케이션·조우는 갈아 끼운다.
    const oldIds = new Set((map.locations ?? []).filter(location => location.id.startsWith(GRASS_LOCATION_PREFIX)).map(location => location.id));
    const locations: MapNamedLocation[] = patches.map((rect, i) => ({ id: `${GRASS_LOCATION_PREFIX}${i + 1}`, name: `풀숲 ${i + 1}`, ...rect, tags: ["풀숲", "야생 조우"] }));
    map.locations = [...(map.locations ?? []).filter(location => !oldIds.has(location.id)), ...locations];
    if (encounters.length > 0) {
      const kept = (map.encounterTable ?? []).filter(entry => !entry.conditions?.locationId || !oldIds.has(entry.conditions.locationId));
      const unscoped = kept.filter(entry => !entry.conditions?.locationId && !entry.conditions?.region);
      if (unscoped.length > 0) warnings.push(`기존 맵 전체 조우 ${unscoped.length}건(${unscoped.map(e => e.troopId).join(", ")})을 지웠습니다 — 도로에서는 풀숲에서만 야생이 나옵니다.`);
      const table: EncounterTableEntry[] = [
        ...kept.filter(entry => entry.conditions?.locationId || entry.conditions?.region),
        ...locations.flatMap(location => encounters.map(entry => ({ troopId: entry.troopId, weight: entry.weight, conditions: { locationId: location.id } }))),
      ];
      map.encounterTable = table;
      map.encounterRate = args.encounterRate === undefined ? (map.encounterRate && map.encounterRate > 0 ? map.encounterRate : DEFAULT_ROUTE_ENCOUNTER_RATE) : Math.max(0, Math.floor(Number(args.encounterRate)));
    } else {
      warnings.push("encounters 를 주지 않아 풀숲만 깔았습니다 — 야생 조우는 set_encounter_table 의 conditions.locationId(풀숲 로케이션)로 연결하세요.");
    }

    // 길가 트레이너 자리 후보: 길 옆 빈 칸(풀숲·길 아님), 길을 바라보게.
    const trainerSpots: Array<Point & { face: string }> = [];
    for (const fraction of [0.3, 0.55, 0.8]) {
      const p = path[Math.floor(fraction * (path.length - 1))]!;
      for (const [dx, dy, face] of [[-1, 0, "right"], [2, 0, "left"], [0, -1, "down"], [0, 2, "up"]] as const) {
        const x = p.x + dx, y = p.y + dy, index = y * map.width + x;
        if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1 || road.has(index) || grass.has(index)) continue;
        if (map.upperTiles[index] !== TILE.EMPTY || map.events.some(event => event.x === x && event.y === y)) continue;
        trainerSpots.push({ x, y, face });
        break;
      }
    }

    return {
      summary: `${map.name} 도로 시공 — 흙길 ${roadCellCount}칸, 풀숲 ${patches.length}곳(${grass.size}칸), 숲 ${treeCells}칸${fillNote}${encounters.length ? `, 풀숲 조우 ${encounters.length}종 × ${patches.length}곳` : ""}`,
      data: {
        mapId: map.id,
        exits,
        grassPatches: locations.map(({ id, name, x, y, w, h }) => ({ id, name, x, y, w, h })),
        encounterRate: map.encounterRate ?? 0,
        trainerSpots,
      },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const WILD_ROUTE_TOOLS: readonly ToolDefinition[] = [authorWildRoute];
