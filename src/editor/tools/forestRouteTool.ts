// editor/tools/forestRouteTool.ts
// 「마을 북쪽에 숲을 구불구불한 맵 N개로 나눠 이어 줘」 — 폴른 스타 속삭이는 숲(flagship/fallen/woodland.ts, B1 활엽 composer)과
// 같은 화가로 숲길 맵을 여러 장 짓고, 시작 맵의 그쪽 가장자리 ↔ 숲1 ↔ 숲2 … 를 왕복 출입구로 잇는다.
// 길은 Catmull-Rom 곡선(폭 2~3.6칸 물결), 빈터·나무 섬·나무 사이 틈(숨은 물건 자리)까지 같은 마스크로 그린다.
// 숲 맵마다 어둡기·안개를 고를 수 있고, 틈에 숨은 물건(조사하면 한 번)을 둘 수 있다.
import { paintWoodland, type Cell, type WoodSpec } from "@/project/flagship/fallen/woodland";
import { isPassable } from "@/project/collision";
import { computeReachableCells } from "@/project/lint/reachability";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { runTool } from "./toolRunner";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export type Side = "north" | "south" | "east" | "west";
type Mood = "normal" | "dim" | "dark" | "fog" | "darkfog";
export const ACROSS = 32, ALONG = 40;

export function call(project: Project, name: string, args: Record<string, unknown>): { data?: unknown; summary?: string } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new ToolError(`${name} 실패: ${res.summary}`);
  Object.assign(project, ctx.project);
  return res as { data?: unknown; summary?: string };
}

/** 추상 좌표(u = 가로지름 0..31, v = 진행 0..39, v=39 가 들어오는 쪽, v=0 이 나가는 쪽)를 실제 맵 칸으로. */
export function toMap(side: Side, u: number, v: number): Cell {
  switch (side) {
    case "north": return { x: u, y: v };
    case "south": return { x: ACROSS - 1 - u, y: ALONG - 1 - v };
    case "east": return { x: ALONG - 1 - v, y: u };
    case "west": return { x: v, y: ACROSS - 1 - u };
  }
}
export const dims = (side: Side): { width: number; height: number } =>
  side === "north" || side === "south" ? { width: ACROSS, height: ALONG } : { width: ALONG, height: ACROSS };
/** 두 칸 폭 문은 「왼쪽/위쪽 칸」 — 가로지름 축이 뒤집히는 쪽은 한 칸 당긴다. */
export function exitCell(side: Side, u: number, v: number): Cell {
  const flip = side === "south" || side === "west";
  const c = toMap(side, Math.floor(u) + (flip ? 1 : 0), v);
  return { x: Math.round(c.x), y: Math.round(c.y) };
}

type Terrain = "forest" | "field" | "edge";
/** 숲 어귀(edge) — 들어오는 쪽 절반 남짓이 트인 풀밭이고, 그 너머로 들쭉날쭉한 나무 벽이 서서 숲길이 그 틈으로 들어간다. */
const EDGE_MEADOW_V = 24;

function forestSpec(id: string, name: string, side: Side, seed: number, last: boolean, entryU: number, terrain: Terrain = "forest"): { spec: WoodSpec; entry: Cell; exit: Cell | null } {
  const field = terrain === "field";
  const edge = terrain === "edge";
  const rnd = mulberry32(seed);
  const across = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const exitU = Math.round(across(7, 24)) + 0.5;
  const endV = last ? across(6, 9) : 0;
  const n = 4;
  const raw: Cell[] = [{ x: entryU, y: ALONG - 1 }];
  for (let i = 1; i <= n; i += 1) {
    const v = ALONG - 1 - ((ALONG - 1 - endV) * i) / (n + 1);
    const swing = (i % 2 === 0 ? 1 : -1) * across(4, 8);
    raw.push({ x: Math.max(4, Math.min(ACROSS - 5, (entryU + exitU) / 2 + swing)), y: v });
  }
  raw.push({ x: last ? across(10, 22) : exitU, y: endV });
  const pts = raw.map((p) => toMap(side, p.x, p.y));
  const mid = raw[2]!;
  const midBlob = centerBlob(side, mid.x, mid.y, across(3.2, 4.6), across(2.4, 3.4));
  const clearings = [
    // 숲 어귀는 가운데 빈터를 두지 않는다 — 풀밭 끝 나무 벽 바로 앞이라 벽에 큰 구멍이 뚫렸다.
    ...(edge ? [] : [midBlob]),
    { ...centerBlob(side, entryU, ALONG - 4, across(3.5, 5), 2.8) },
    ...(last ? [centerBlob(side, raw[raw.length - 1]!.x, endV + 1, 5.5, 4)] : []),
    // 들판: 길 따라 큰 풀밭 빈터 셋 — 나무는 가장자리 띠와 섬으로만 남는다.
    ...(field ? [raw[1]!, raw[2]!, raw[3]!].map((p) => centerBlob(side, Math.max(9, Math.min(ACROSS - 10, p.x)), p.y, across(9, 11.5), across(6, 8))) : []),
    // 숲 어귀: 들어오는 쪽(v 21~39)을 맵 폭 거의 전체의 풀밭으로 — 그 북쪽 끝 들쭉날쭉한 경계가 나무 벽(숲 가장자리)이다.
    ...(edge ? [centerBlob(side, ACROSS / 2 - 0.5, (EDGE_MEADOW_V + ALONG) / 2 + 0.5, ACROSS / 2 - 1.5, (ALONG - EDGE_MEADOW_V) / 2 + 0.5)] : []),
  ];
  const nooks = [raw[1]!, raw[3]!].map((p, k) => {
    const dir = k % 2 === 0 ? 1 : -1;
    const from = toMap(side, Math.round(p.x), Math.round(p.y));
    const to = toMap(side, Math.max(2, Math.min(ACROSS - 3, Math.round(p.x + dir * across(3, 5)))), Math.round(p.y - 1));
    return { from, to };
  });
  const groves = field ? [centerBlob(side, across(6, 10), across(12, 18), 1.6, 1.3), centerBlob(side, across(20, 26), across(22, 30), 1.8, 1.4)]
    // 숲 어귀 풀밭의 나무 섬 둘 — 길 좌우로 엇갈려 서서, 풀밭을 가로지르는 몸을 숨길 덩이·돌아가는 갈래가 된다.
    : edge ? [centerBlob(side, across(5, 9), across(27, 30), 1.9, 1.5), centerBlob(side, across(22, 26), across(31, 34), 1.9, 1.5)] : [];
  const entry = exitCell(side, entryU, ALONG - 1);
  const exit = last ? null : exitCell(side, exitU, 0);
  const { width, height } = dims(side);
  return {
    spec: { id, name, width, height, seed, paths: [{ pts, w: [2.2, 3.4] }], exits: exit ? [entry, exit] : [entry], clearings, nooks, ...(groves.length ? { groves } : {}), ...(field || edge ? { undergrowth: 0.6 } : {}) },
    entry, exit,
  };
}
export function centerBlob(side: Side, u: number, v: number, ru: number, rv: number) {
  const c = toMap(side, u, v);
  const vertical = side === "north" || side === "south";
  return { cx: c.x, cy: c.y, rx: vertical ? ru : rv, ry: vertical ? rv : ru };
}

/** 시작 맵 그쪽 가장자리에서 걸어 닿는 칸 — 길·빈 칸을 가운데 가까운 것부터. 없으면 가까운 칸에서 가장자리까지 윗층을 걷어 길을 낸다. */
/**
 * 시작 칸에서 닿는 칸 — 단, 시작 칸(맵 가운데)이 집 안·나무 사이 같은 작은 섬이면 맵에서 가장 큰 걸을 수 있는 덩이를 쓴다.
 * 가운데가 집 그림 위인 광장 마을에서는 닿는 칸이 몇 칸뿐이라 가장자리를 못 찾고, 곧은 길을 집을 뚫고 내다가
 * 「완성된 집 보호」에 걸려 숲 전체가 실패했다(2026-10-30 isekai-godding: 광장 마을 60×44, 동·북 모두 protected-house-write).
 */
function mainWalkableArea(project: Project, map: GameMap, start: Cell): Set<string> {
  const W = map.width, H = map.height;
  const first = computeReachableCells(project, map, start.x, start.y);
  if (first.size >= W * H * 0.15) return first;
  let best = first;
  const seen = new Set(first);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (seen.has(`${x},${y}`) || !isPassable(project, map, x, y)) continue;
    const area = computeReachableCells(project, map, x, y);
    for (const k of area) seen.add(k);
    if (area.size > best.size) best = area;
  }
  return best;
}

export function originEdge(project: Project, map: GameMap, side: Side, walkFrom?: Cell): Cell {
  const W = map.width, H = map.height;
  // 걸어 닿는 기준 칸 — 주면 그 칸(다른 맵에서 들어오는 입구), 아니면 시작 위치·맵 가운데.
  const start = walkFrom ?? (project.startMapId === map.id && project.startPos ? project.startPos : { x: Math.floor(W / 2), y: Math.floor(H / 2) });
  const reach = walkFrom ? computeReachableCells(project, map, start.x, start.y) : mainWalkableArea(project, map, start);
  const edge: Cell[] = [];
  if (side === "north" || side === "south") for (let x = 1; x < W - 1; x += 1) edge.push({ x, y: side === "north" ? 0 : H - 1 });
  else for (let y = 1; y < H - 1; y += 1) edge.push({ x: side === "west" ? 0 : W - 1, y });
  const midX = W / 2, midY = H / 2;
  const free = (c: Cell) => !map.events.some((e) => e.x === c.x && e.y === c.y);
  const inner = (c: Cell): Cell => side === "north" ? { x: c.x, y: 1 } : side === "south" ? { x: c.x, y: H - 2 } : side === "west" ? { x: 1, y: c.y } : { x: W - 2, y: c.y };
  const ok = edge.filter((c) => reach.has(`${c.x},${c.y}`) && reach.has(`${inner(c).x},${inner(c).y}`) && free(c) && free(inner(c)))
    .sort((a, b) => Math.hypot(a.x - midX, a.y - midY) - Math.hypot(b.x - midX, b.y - midY));
  if (ok[0]) return ok[0];
  // 가장자리에 닿는 칸이 없다 — 그 쪽으로 가장 멀리 나간 닿는 칸에서 곧게 길을 낸다.
  const cells = [...reach].map((k) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y! }; });
  const score = (c: Cell) => side === "north" ? c.y : side === "south" ? -c.y : side === "west" ? c.x : -c.x;
  cells.sort((a, b) => score(a) - score(b) || Math.abs(a.x - midX) + Math.abs(a.y - midY) - (Math.abs(b.x - midX) + Math.abs(b.y - midY)));
  const from = cells[0];
  if (!from) throw new ToolError("시작 맵에서 걸어 닿는 칸이 없어 숲 입구를 낼 수 없다.");
  const step = side === "north" ? { dx: 0, dy: -1 } : side === "south" ? { dx: 0, dy: 1 } : side === "west" ? { dx: -1, dy: 0 } : { dx: 1, dy: 0 };
  const ground = map.lowerTiles[from.y * W + from.x]!;
  let c = { ...from };
  while (c.x > 0 && c.y > 0 && c.x < W - 1 && c.y < H - 1) {
    c = { x: c.x + step.dx, y: c.y + step.dy };
    for (const d of [0, step.dx === 0 ? 1 : W]) {
      const i = c.y * W + c.x + d;
      if (i >= 0 && i < W * H) {
        map.upperTiles[i] = -1; map.lowerTiles[i] = ground;
        // 겹 칸(나무 밑동·덤불)도 걷어야 실제로 지나간다 — 윗층만 걷으면 들판 북쪽 끝이 막힌 채 남았다(2026-10-26).
        const layers = map as unknown as { lowerOverlayTiles?: number[]; upperOverlayTiles?: number[] };
        if (layers.lowerOverlayTiles) layers.lowerOverlayTiles[i] = -1;
        if (layers.upperOverlayTiles) layers.upperOverlayTiles[i] = -1;
      }
    }
  }
  return c;
}

function inward(map: GameMap, at: Cell): { x: number; y: number; direction: "up" | "down" | "left" | "right" } {
  if (at.y === map.height - 1) return { x: at.x, y: at.y - 1, direction: "up" };
  if (at.y === 0) return { x: at.x, y: 1, direction: "down" };
  if (at.x === 0) return { x: 1, y: at.y, direction: "right" };
  return { x: at.x - 1, y: at.y, direction: "left" };
}
export function link(project: Project, a: { mapId: string } & Cell, b: { mapId: string } & Cell): void {
  call(project, "create_transfer_pair", { a, b });
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const map = project.maps[from.mapId]!;
    const land = inward(project.maps[to.mapId]!, to);
    for (const e of map.events) {
      if (e.x !== from.x || e.y !== from.y) continue;
      for (const page of e.pages ?? []) for (const c of page.commands as Array<{ kind: string; mapId?: string; x?: number; y?: number; direction?: string }>) {
        if (c.kind === "transfer" && c.mapId === to.mapId) { c.x = land.x; c.y = land.y; c.direction = land.direction; }
      }
    }
  }
}

const MOODS: Record<Mood, { ambient?: number; color?: string; fog?: number }> = {
  normal: {}, dim: { ambient: 0.55, color: "#3a5a44" }, dark: { ambient: 0.3, color: "#24402f" },
  fog: { fog: 0.55 }, darkfog: { ambient: 0.3, color: "#24402f", fog: 0.6 },
};

const authorForestRoute: ToolDefinition = {
  name: "author_forest_route",
  description:
    "숲(또는 terrain:'field' 트인 들판)을 구불구불한 길 맵 여러 장(1~5)으로 지어 시작 맵의 한쪽 가장자리(north·south·east·west)와 줄줄이 잇는다 — 폴른 스타 속삭이는 숲과 같은 "
    + "B1 활엽수 화가(곡선 숲길·빈터·나무 섬·나무 사이 틈). 「마을 북쪽에 숲을 맵 3개로 나눠 이어 줘」「숲 두 개, 두 번째는 어둡고 안개」의 정본. "
    + "moods[i] = normal·dim·dark·fog·darkfog(실제 조명·안개). hiddenPerMap 개수만큼 나무 사이 틈에 숨은 물건(조사하면 한 번, 그림 없음)을 둔다. "
    + "terrain:'edge' = 숲 어귀 — 들어오는 쪽 절반이 트인 풀밭(나무 섬 둘)이고 그 너머 들쭉날쭉한 나무 벽 틈으로 숲길이 들어간다(성벽 밑을 빠져 숲으로 달아나는 추격·「숲 가장자리」 장면). "
    + "terrains[i] 로 맵마다 따로 줄 수 있다(예: ['edge','field']). "
    + "마지막 숲은 막다른 빈터로 끝난다(보스·사당 자리). 결과 data.maps[i] = {mapId, entry, exit, clearing, terrain, treeline?} — edge 맵의 treeline = 풀밭이 끝나고 나무 벽이 시작되는 줄(y 또는 x).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      fromMapId: { type: "string", description: "숲과 이을 맵(보통 마을)" },
      side: { type: "string", enum: ["north", "south", "east", "west"] },
      count: { type: "integer", description: "숲 맵 수 1~5" },
      names: { type: "array", items: { type: "string" }, description: "맵 이름(생략 = '숲 1'…)" },
      moods: { type: "array", items: { type: "string", enum: ["normal", "dim", "dark", "fog", "darkfog"] } },
      hiddenPerMap: { type: "integer", description: "맵마다 숨은 물건 수 0~3(기본 0)" },
      hiddenItemIds: { type: "array", items: { type: "string" }, description: "숨은 물건 아이템 id(돌아가며 쓴다, 없으면 돈)" },
      terrain: { type: "string", enum: ["forest", "field", "edge"], description: "forest(기본)=나무 사이 숲길 · field=트인 들판(큰 풀밭 빈터, 가장자리만 나무) · edge=숲 어귀(들어오는 쪽 풀밭 → 나무 벽 틈으로 숲길)" },
      terrains: { type: "array", items: { type: "string", enum: ["forest", "field", "edge"] }, description: "맵마다 terrain(i 번째 맵). 빠진 자리는 terrain" },
      linkFrom: { type: "boolean", description: "false 면 시작 맵 가장자리에 길을 내지 않고 이동 이벤트도 두지 않는다 — 성벽 개구멍·뒷문·우물처럼 시작 맵의 정한 칸에서 이벤트로 들여보낼 때. 첫 맵 입구는 data.maps[0].entry(그 칸에 돌아가는 이벤트를 직접 둔다). 기본 true" },
      seed: { type: "integer" },
    },
    required: ["fromMapId", "side"],
  },
  invalidArgsExample: { fromMapId: "map_1", side: "north", count: 3, moods: ["normal", "dim", "darkfog"], hiddenPerMap: 1 },
  run(draft, args): ToolExecResult {
    const from = requireMap(draft, String(args.fromMapId));
    const side = (["north", "south", "east", "west"] as const).find((s) => s === args.side);
    if (!side) throw new ToolError("side 는 north·south·east·west 중 하나.");
    const count = Math.max(1, Math.min(5, Math.floor(Number(args.count ?? 1)) || 1));
    const seed0 = Number.isFinite(Number(args.seed)) ? Number(args.seed) : 7 + Object.keys(draft.maps).length * 13;
    const names = Array.isArray(args.names) ? args.names.map(String) : [];
    const moods = Array.isArray(args.moods) ? args.moods.map(String) as Mood[] : [];
    const hidden = Math.max(0, Math.min(3, Math.floor(Number(args.hiddenPerMap ?? 0)) || 0));
    const itemIds = (Array.isArray(args.hiddenItemIds) ? args.hiddenItemIds.map(String) : []).filter((id) => draft.database.items.some((i) => i.id === id) || draft.database.equipment.some((i) => i.id === id));
    const terrainOf = (i: number): Terrain => {
      const t = Array.isArray(args.terrains) ? args.terrains[i] : undefined;
      const pick = typeof t === "string" ? t : args.terrain;
      return pick === "field" || pick === "edge" ? pick : "forest";
    };
    const warnings: string[] = [];
    const out: Array<{ mapId: string; name: string; entry: Cell; exit: Cell | null; clearing: Cell; hidden: Cell[]; terrain: Terrain; treeline?: number; branches: { from: Cell; end: Cell }[] }> = [];
    const linkFrom = args.linkFrom !== false;
    let prev: ({ mapId: string } & Cell) | null = linkFrom ? { mapId: from.id, ...originEdge(draft, from, side) } : null;
    let used = 0;
    for (let i = 0; i < count; i += 1) {
      const terrain = terrainOf(i);
      const field = terrain === "field";
      // 숲 어귀(edge)는 들판에서 숲으로 드는 맵 — 들판 이름(map_field_*)을 쓴다(들판으로 짓던 맵을 edge 로 바꿔도 id 가 그대로다).
      const kind = field || terrain === "edge" ? "field" : "forest";
      let id = `map_${kind}_${side}_${i + 1}`;
      for (let n = 2; draft.maps[id]; n += 1) id = `map_${kind}_${side}_${i + 1}_${n}`;
      const base = field ? "들판" : "숲";
      const name = names[i] ?? (count > 1 ? `${base} ${i + 1}` : base);
      const entryU = 10 + mulberry32(seed0 + i * 31)() * 12;
      const { spec, entry, exit } = forestSpec(id, name, side, seed0 + i * 97, i === count - 1, entryU, terrain);
      const result = paintWoodland(draft, spec);
      // 시작 맵의 이 숲 묶음 아래로 — 범위 체크포인트가 새 맵을 버리지 않게.
      try { call(draft, "manage_map_tree", { operation: "move", mapId: id, parentId: from.id }); } catch { /* 트리 이동 실패는 무시 */ }
      if (prev) link(draft, prev, { mapId: id, ...entry });
      const mood = MOODS[moods[i] ?? "normal"] ?? {};
      if (mood.ambient !== undefined || mood.fog !== undefined) {
        try {
          call(draft, "set_scene_mood", {
            mapId: id, applyMode: "map",
            ...(mood.ambient !== undefined ? { lighting: { ambient: mood.ambient, color: mood.color } } : {}),
            ...(mood.fog !== undefined ? { weather: { kind: "fog", intensity: mood.fog } } : {}),
          });
        } catch (e) { warnings.push(`${name} 분위기 실패: ${String(e).slice(0, 120)}`); }
      }
      const spots: Cell[] = [];
      for (const pocket of result.pockets.slice(0, hidden)) {
        const itemId = itemIds.length ? itemIds[used % itemIds.length] : undefined;
        used += 1;
        try {
          call(draft, "place_examine_hotspots", {
            mapId: id,
            hotspots: [{ at: pocket, name: "나무 사이", once: true, ...(itemId ? { itemId } : { lines: ["나무 사이에 무언가 반짝인다…"] }) }],
          });
          if (!itemId) {
            const ev = draft.maps[id]!.events.find((e) => e.x === pocket.x && e.y === pocket.y);
            const page = ev?.pages?.[0];
            if (page) page.commands.push({ kind: "changeGold", op: "+=", amount: 60 + 20 * (used % 4) } as never, { kind: "text", body: `${60 + 20 * (used % 4)}골드를 주웠다!` } as never);
          }
          spots.push(pocket);
        } catch (e) { warnings.push(`${name} 숨은 물건 실패: ${String(e).slice(0, 120)}`); }
      }
      if (result.pockets.length < hidden) warnings.push(`${name}: 나무 사이 틈이 ${result.pockets.length}곳뿐이라 숨은 물건 ${result.pockets.length}개만 두었다.`);
      const c = spec.clearings?.[spec.clearings.length - 1];
      const treeline = terrain === "edge" ? (side === "north" ? EDGE_MEADOW_V : side === "south" ? ALONG - 1 - EDGE_MEADOW_V : side === "west" ? EDGE_MEADOW_V : ALONG - 1 - EDGE_MEADOW_V) : undefined;
      // 샛길(nooks)은 큰길에서 갈라져 막다른 끝으로 가는 갈림길이다 — 결과에 좌표로 알린다(2026-10-30 omo-loop-1030b terra forest-path:
      // 갈림길이 이미 있는데 «숲길 빌더는 갈림길을 지정하지 못한다»며 항목을 막힘으로 닫았다).
      const branches = (spec.nooks ?? []).map((nk) => ({ from: { x: Math.round(nk.from.x), y: Math.round(nk.from.y) }, end: { x: Math.round(nk.to.x), y: Math.round(nk.to.y) } }));
      out.push({ mapId: id, name, entry, exit, clearing: c ? { x: Math.round(c.cx), y: Math.round(c.cy) } : entry, hidden: spots, terrain, ...(treeline !== undefined ? { treeline } : {}), branches });
      if (exit) prev = { mapId: id, ...exit };
    }
    return {
      summary: `숲길 ${count}장(${side}): ${out.map((m) => `${m.name}=${m.mapId}(${m.terrain})${m.hidden.length ? ` 숨은 물건 ${m.hidden.length}` : ""}`).join(" → ")} · ${from.id} ${side} 가장자리와 연결`
        + out.filter((m) => m.branches.length).map((m) => ` · ${m.name} 갈림길 ${m.branches.length}곳(큰길에서 갈라지는 막다른 샛길): ${m.branches.map((b) => `(${b.from.x},${b.from.y})→끝 (${b.end.x},${b.end.y})`).join(", ")} — 막다른 끝에 place_chest·place_field_enemy 를 그 좌표로 놓는다`).join("")
        + out.map((m) => ` · ${m.name} ${m.exit ? "" : "막다른 "}빈터 (${m.clearing.x},${m.clearing.y})`).join(""),
      data: { maps: out },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const FOREST_ROUTE_TOOLS: readonly ToolDefinition[] = [authorForestRoute];
