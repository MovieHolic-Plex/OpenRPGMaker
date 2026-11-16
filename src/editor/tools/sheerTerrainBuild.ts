// 깎아지른 지형 시공 — 계획(sheerTerrainPlan.ts)을 버들항 맵에 싣는다: 높이(relief.style "sheer") · 장치 칸 · 물 · 폭포 · 널다리 · 풀 결 · 볼거리 · 상자 · 막기 · 맵 배경.
//
// 도구 build_sheer_terrain(쓰기): 조수 v2 의 route 갈래(make_place type "route" + hints.kind) 빌더가 부른다. 모델은 칸·좌표를 쓰지 않는다.
// 맵 배경: 빈 곳이 있는 갈래(하늘 고원 · 정상)는 견본 파노라마(set_map_properties background.preset 과 같은 값 — mapBackgroundFromPanoramaSet)를 스스로 건다.
//   빈 곳(0 단)은 렌더러가 투명하게 두고, 1층 타일도 비운다(-1) — 그래야 게임이 빈 칸에 배경을 비친다(showInEmptyCells).
// 그림은 타일·킷만 쓴다(새로 그린 화소 없음) — 면 · 장치 그림은 렌더러가 조각(sheerArt)에서 읽는다.
import { tilesetLookGround } from "@/assets/tilesetLooks";
import { mapBackgroundFromPanoramaSet } from "@/assets/oprnPanoramas";
import { canMove, isPassable } from "@/project/collision";
import { activeTilesetLook } from "@/project/kitLook";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { invalidateReliefSlopes } from "@/project/relief/walk";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { layBeodeulGrassGrain } from "./beodeulGrassGrain";
import { planBeodeulCanopy, raiseBeodeulCrowns, shapeBeodeulCanopyMask, writeBeodeulCanopy } from "./beodeulForest";
import { layBeodeulWaterSurface } from "./beodeulWater";
import { planSheerTerrain, SHEER_DEVICES, SHEER_KINDS, sheerKindById, type SheerPlan, type SheerSide } from "./sheerTerrainPlan";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition } from "./types";

const GRASS = 737;
/** 막는 칸(그림 없음 · solid) — 닿지 않는 걷는 칸을 막을 때 3층에 둔다. */
const SOLID_BLANK = 67;
const SIDES: readonly SheerSide[] = ["north", "south", "east", "west"];

export interface SheerBuildReport {
  readonly kind: string; readonly seed: number; readonly width: number; readonly height: number;
  readonly faceCells: number; readonly levels: number; readonly walkablePct: number;
  readonly devices: readonly { kind: string; lo: number; hi: number; at: { x: number; y: number }; extra?: boolean }[];
  readonly reach: { readonly ok: boolean; readonly missing: readonly string[]; readonly sealed: number };
  readonly entry: { x: number; y: number; side: SheerSide };
  readonly exits: readonly { x: number; y: number; side: SheerSide }[];
  readonly landmark?: { kit: string; x: number; y: number; front: { x: number; y: number }; placed: boolean };
  readonly deadEnd?: { x: number; y: number; chest: boolean };
  readonly falls: number; readonly fords: number; readonly forestCells: number;
  readonly background?: { preset: string; view: "horizon" | "surface"; prompt: string };
  readonly warnings: readonly string[];
}

/** 계획을 맵에 싣는다. map 은 버들항 칩셋의 맵(크기는 계획과 같다). */
export function buildSheerTerrain(project: Project, map: GameMap, plan: SheerPlan): SheerBuildReport {
  const tileset = project.tilesets[map.tilesetId]!;
  const { W, H, kind } = plan, N = W * H, warnings = [...plan.warnings];
  const stamp = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object")!;
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const water = tileset.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47")?.variantMap?.["255"] ?? -1;
  const plank = kits.get("bd-pick-fishing-port-jetty-west")?.rows.map((r) => r.tiles?.[0] ?? -1).filter((t) => t >= 0) ?? [];
  // ---------- 1. 바닥: 걷는 땅은 풀, 빈 곳은 비운다(맵 배경이 비친다), 물은 물 몸통 ----------
  for (let c = 0; c < N; c++) {
    for (const L of [2, 3, 4] as const) setLayerTileAt(map, L, c, -1);
    map.lowerTiles[c] = plan.levels[c] ? GRASS : -1;
    if (map.upperTiles) map.upperTiles[c] = -1;
  }
  const fords = new Set(plan.fords);
  if (water >= 0) for (let c = 0; c < N; c++) if (plan.water[c] && !fords.has(c)) map.lowerTiles[c] = water;
  plan.fords.forEach((c, i) => { if (plank.length) map.lowerTiles[c] = plank[1 + (i % Math.max(1, plank.length - 1))] ?? plank[0]!; });
  // ---------- 2. 높이 ----------
  map.relief = { width: W, height: H, levels: Array.from(plan.levels), ramps: Array.from(plan.ramps), style: "sheer" };
  invalidateReliefSlopes(map.relief);
  // ---------- 3. 물 둑 · 깊이 띠 · 폭포 ----------
  const wet = (c: number) => !!plan.water[c];
  if (water >= 0 && plan.water.some(Boolean)) {
    layBeodeulWaterSurface(map, tileset, { seed: plan.seed, wet: (c) => wet(c) || fords.has(c), open: (c) => wet(c) && !fords.has(c) && layerTileAt(map, 2, c) < 0 });
  }
  // 폭포는 렌더러가 그린다(relief.falls — 그린 턱 · 코드로 짠 물기둥 · 물보라, 면 한 띠). 벽면 장식 타일은 깎아지른 면(48px)에 맞지 않는다.
  if (plan.falls.length) map.relief.falls = plan.falls.map((f) => ({ x: f.x0, y: f.y, w: f.x1 - f.x0 + 1 }));
  const falls = plan.falls.length;
  // ---------- 4. 볼거리 · 막다른 턱 상자 · 둘레 꾸밈 ----------
  const put = (kit: string, x: number, y: number): boolean => {
    if (!kits.has(kit)) return false;
    try { stamp.run(project, { objectId: `kit:${tileset.id}/${kit}`, mapId: map.id, x, y }); return true; } catch { return false; }
  };
  const landmarkPlaced = plan.landmark ? put(plan.landmark.kit, plan.landmark.x, plan.landmark.y) : false;
  if (plan.landmark && !landmarkPlaced) warnings.push(`landmark kit ${plan.landmark.kit} could not be stamped`);
  const chest = plan.deadEnd ? put(kind.chest, plan.deadEnd.x, plan.deadEnd.y - 1) || put(kind.chest, plan.deadEnd.x, plan.deadEnd.y) : false;
  // 바깥 숲: 버들항 숲 수관 오토타일(마을 숲과 같은 그림 · 같은 밝기)로 같은 단끼리 덮는다 — 단 끝 너머로 이으면 두 높이에서 칸 선으로 썰린다
  let forestCells = 0;
  if (plan.forest.some(Boolean)) {
    const lv = plan.levels, set = new Set<number>();
    for (let c = 0; c < N; c++) if (plan.forest[c]) set.add(c);
    const sameLv = (a: number, b: number) => lv[a] === lv[b];
    shapeBeodeulCanopyMask(W, H, set, { canFill: () => false, joins: sameLv, minComponent: 12, minExtent: 3, minInterior: 0.15, block: 2 });
    const cp = planBeodeulCanopy(W, H, "leaf", set, (c) => !set.has(c) && lv[c]! > 0 && !plan.water[c] && !plan.ramps[c] && layerTileAt(map, 2, c) < 0, sameLv);
    writeBeodeulCanopy(project, map, tileset, cp);
    raiseBeodeulCrowns(map, tileset, new Set(cp.canopy.keys()), plan.seed);
    forestCells = cp.canopy.size;
  }
  // 꾸밈: 가려지지 않은 넓은 풀밭에 갈래의 꾸밈 킷 몇(장치·물·길 둘레 비움)
  {
    const reserved = new Uint8Array(N);
    const near = (c: number, r: number) => { const x = c % W, y = (c - x) / W; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) reserved[Y * W + X] = 1; } };
    for (const d of plan.devices) for (const c of d.cells) near(c, 2);
    for (const c of [plan.entry, ...plan.exits, ...(plan.landmark ? [plan.landmark.front] : []), ...(plan.deadEnd ? [plan.deadEnd] : [])]) near(c.y * W + c.x, 2);
    for (let c = 0; c < N; c++) if (plan.water[c]) near(c, 1);
    let n = 0;
    for (let i = 0; i < 400 && n < Math.round(N / 140); i++) {
      const c = Math.floor(hash01(i, plan.seed, 41) * N), x = c % W, y = (c - x) / W;
      const kit = kind.dressing[Math.floor(hash01(i, plan.seed, 42) * kind.dressing.length)]!, k = kits.get(kit); if (!k) continue;
      let ok = true;
      for (let j = -1; j <= k.height && ok; j++) for (let q = -1; q <= k.width; q++) { const X = x + q, Y = y + j, e = Y * W + X; if (X < 0 || Y < 0 || X >= W || Y >= H || reserved[e] || !plan.levels[e] || plan.levels[e] !== plan.levels[c] || plan.hidden[e] || plan.ramps[e] || plan.water[e] || plan.forest[e] || layerTileAt(map, 2, e) >= 0) { ok = false; break; } }
      if (ok && put(kit, x, y)) { n++; near(c, 2); }
    }
  }
  // ---------- 5. 풀 결(버들항 풀 변형 섞기) ----------
  const look = activeTilesetLook(tileset);
  // 겉모습이 없는 게임(조수 첫 맵 · 오프라인)은 꽃 섞인 결 — 목표 화면처럼 풀 변형이 섞여 깔린다
  layBeodeulGrassGrain(project, map, look?.grain ?? "flowery", { seed: plan.seed, ...((g) => (g ? { ground: g } : {}))(tilesetLookGround(tileset.id, look)) });
  // ---------- 6. 닿는 길: 그림 칸까지 본 물들이기, 닿지 않는 걷는 칸은 막는다 ----------
  const flood = () => {
    const s = plan.entry.y * W + plan.entry.x, seen = new Set<number>([s]), q = [s];
    for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !canMove(project, map, x, y, nx, ny)) continue; seen.add(n); q.push(n); } }
    return seen;
  };
  let seen = flood();
  const goal = (label: string, c: { x: number; y: number }) => ({ label, c });
  const goals = [...plan.exits.map((e) => goal(`exit ${e.side} (${e.x},${e.y})`, e)), ...(plan.landmark ? [goal(`landmark front (${plan.landmark.front.x},${plan.landmark.front.y})`, plan.landmark.front)] : []), ...(plan.deadEnd ? [goal(`dead-end ledge (${plan.deadEnd.x},${plan.deadEnd.y})`, plan.deadEnd)] : [])];
  let sealed = 0;
  for (let c = 0; c < N; c++) {
    const x = c % W, y = (c - x) / W;
    if (seen.has(c) || !isPassable(project, map, x, y)) continue;
    setLayerTileAt(map, 3, c, SOLID_BLANK); sealed++;
  }
  seen = flood();
  const missing = goals.filter((g) => !seen.has(g.c.y * W + g.c.x)).map((g) => g.label);
  let walk = 0; for (let c = 0; c < N; c++) if (seen.has(c)) walk++;
  // ---------- 7. 맵 배경 ----------
  let background: SheerBuildReport["background"];
  if (kind.backdrop) {
    const bg = mapBackgroundFromPanoramaSet(kind.backdrop.preset);
    if (bg) { map.background = bg; background = { ...kind.backdrop }; }
  }
  return {
    kind: kind.id, seed: plan.seed, width: W, height: H, faceCells: 3, levels: plan.levelCount,
    walkablePct: Math.round((walk / N) * 100),
    devices: plan.devices.map((d) => { const c = d.cells[0] ?? 0; return { kind: d.kind, lo: d.lo, hi: d.hi, at: { x: c % W, y: Math.floor(c / W) }, ...(d.extra ? { extra: true } : {}) }; }),
    forestCells,
    reach: { ok: missing.length === 0, missing, sealed },
    entry: plan.entry, exits: plan.exits,
    ...(plan.landmark ? { landmark: { kit: plan.landmark.kit, x: plan.landmark.x, y: plan.landmark.y, front: plan.landmark.front, placed: landmarkPlaced } } : {}),
    ...(plan.deadEnd ? { deadEnd: { ...plan.deadEnd, chest } } : {}),
    falls, fords: plan.fords.length,
    ...(background ? { background } : {}),
    warnings,
  };
}

const hash01 = (a: number, b: number, c: number): number => {
  let h = Math.imul(a * 73856093 ^ b * 19349663 ^ c * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** 조수 v2 빌더가 부르는 도구 — 이미 만든 버들항 맵 위에 깎아지른 지형 한 장을 시공한다. 조수에게 직접 내놓지 않는다(make_place 의 route 갈래가 부른다). */
export const SHEER_TERRAIN_TOOLS: readonly ToolDefinition[] = [{
  name: "build_sheer_terrain", mode: "write", domains: ["map"], preservesAuthoredRaster: true,
  description: "버들항 맵 한 장에 깎아지른 지형(단 하나 = 면 3칸 · 엽 꼴 고원 · 단마다 장치 · 물길과 폭포 · 볼거리 · 막다른 턱 · 빈 곳에 맵 배경)을 시공한다. "
    + `kind: ${SHEER_KINDS.map((k) => `${k.id}(${k.ko})`).join(" · ")}. 맵 크기는 그대로 쓴다. 결과 data 는 단 수 · 걷는 땅 몫 · 장치 · 닿는 길 검사 · 들어오는/나가는 칸.`,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      kind: { type: "string", enum: SHEER_KINDS.map((k) => k.id) },
      seed: { type: "integer" },
      sides: { type: "array", items: { type: "string", enum: [...SIDES] }, description: "길이 닿을 변(첫째가 들어오는 변). 기본 south · north" },
    },
    required: ["mapId", "kind"], additionalProperties: false,
  },
  run(project, args) {
    const map = project.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵 ${String(args.mapId)} 가 없습니다.`, { code: "map-not-found" });
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset || map.tilesetId !== "beodeul_city") throw new ToolError("버들항(beodeul_city) 맵만 지원합니다.", { code: "unsupported-tileset", mapId: map.id });
    const kind = sheerKindById(String(args.kind));
    if (!kind) throw new ToolError(`kind 는 ${SHEER_KINDS.map((k) => k.id).join("·")} 중 하나입니다.`, { code: "invalid-args", mapId: map.id });
    const seed = Number.isFinite(Number(args.seed)) ? Math.floor(Number(args.seed)) : 1;
    const sides = (Array.isArray(args.sides) ? args.sides : []).map(String).filter((s): s is SheerSide => (SIDES as readonly string[]).includes(s));
    const plan = planSheerTerrain(kind, map.width, map.height, seed, sides.length ? sides : ["south", "north"]);
    const report = buildSheerTerrain(project, map, plan);
    const devices = report.devices.map((d) => `${SHEER_DEVICES[d.kind as keyof typeof SHEER_DEVICES]?.ko ?? d.kind}(${d.lo}→${d.hi})`).join(" · ");
    return {
      summary: `깎아지른 지형 «${kind.ko}» ${map.width}×${map.height}: 단 ${report.levels} · 면 3칸 · 걷는 땅 ${report.walkablePct}% · 장치 ${report.devices.length}(${devices}) · 닿는 길 ${report.reach.ok ? "모두 닿음" : `못 닿음 ${report.reach.missing.join(", ")}`}${report.reach.sealed ? ` · 막은 칸 ${report.reach.sealed}` : ""}${report.background ? ` · 맵 배경 ${report.background.preset}` : ""}`,
      data: { mapId: map.id, ...report },
      ...(report.warnings.length ? { warnings: report.warnings } : {}),
    };
  },
}];
