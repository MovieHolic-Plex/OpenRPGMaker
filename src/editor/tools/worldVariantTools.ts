/**
 * derive_world_variant — 기존 월드맵에서 「파멸 후」 같은 변형 세계를 파생한다 (2026-10-15, FF6급 감사 #26).
 *
 * 배경: edit_world_terrain 으로 새 지도를 매번 만들면 파멸 전/후가 5.3% 만 달랐고(감사 실측), 바닥을 잿빛으로 덮으려 하면
 * 여정 도달성 검사가 「너무 일찍 3막에 닿는다」며 거부했다(모래 바다 = 사구 바닥 칸이 장벽이라 바닥을 바꾸면 장벽이 사라진다).
 * 변형은 기준 지도와 같은 지형(작업·바탕·배치 번호)을 그대로 짓고, 만들어진 칸 배열 위에 침수·균열·바닥 갈아엎기·고사목을 얹는다.
 * 여정 검사는 「설계 막 순서」 대신 「모든 장소가 어떤 수단으로든 닿는다」(free)로 바꾸고, 막이 바뀐 장소는 notes 로 알린다.
 *
 * 작업 문법·검사의 정본: tiledata/worldmap-kit/kit/lib/kit_variant.py (이 파일의 스키마는 그 거울).
 */
import type { GameEvent, GameMap, MapId, Project, WorldmapVariantSpec } from "@/project/types";
import type { WorldmapBuildRequest, WorldmapBuildResult } from "@/editor/worldmap/worldmapBuild";
import {
  applyWorldmap, layoutOf, placesSummary, prepareRequest, rememberWorldImage, resultFor, terrainOf, townArtHint,
} from "./worldTerrainTools";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

type Built = Extract<WorldmapBuildResult, { ok: true }>;
type Op = Record<string, unknown>;
type Pt = [number, number];

const GROUNDS = ["grass", "farm", "crop", "savanna", "sand", "dune", "dirt", "badlands", "ash", "basalt", "swamp", "marsh", "tundra", "snow", "glacier", "jungle"] as const;
const FORESTS = ["broad", "conifer", "snow", "jungle", "dead"] as const;
const VARIANT_PALETTES = ["ruin", "ashfall", "dusk", "winter", "original", "bright", "desert", "tropic", "north", "industrial", "gothic", "primeval"] as const;

const polyProp: JsonSchema = { type: "array", items: { type: "array", items: { type: "number" } }, description: "구역 다각형 꼭짓점 [[x,y],...](칸 좌표, 3개 이상)" };
const aroundProp: JsonSchema = {
  type: "object", additionalProperties: false, required: ["place", "r"],
  properties: { place: { type: "string", description: "장소 id(read_world_terrain 의 places)" }, r: { type: "number", description: "반지름(칸)" } },
  description: "장소 둘레 원형 구역",
};
const recolorSchema: JsonSchema = {
  type: "object", additionalProperties: false, required: ["to"],
  properties: {
    to: { type: "string", enum: [...GROUNDS] }, from: { type: "array", items: { type: "string", enum: [...GROUNDS] }, description: "이 바닥만(생략 = 땅 전부)" },
    amount: { type: "number", description: "얼룩 비율 0~1(덩어리로 퍼진다)" }, poly: polyProp, around: aroundProp,
  },
};
const lineProp: JsonSchema = { type: "array", items: { type: "array", items: { type: "number" } }, description: "꺾은선 [[x,y],...]" };
const riftSchema: JsonSchema = { type: "object", additionalProperties: false, required: ["line"], properties: { line: lineProp, width: { type: "integer", description: "폭 1~4(기본 2)" } } };
const fissureSchema: JsonSchema = {
  type: "object", additionalProperties: false, required: ["line", "kind"],
  properties: { line: lineProp, kind: { type: "string", enum: ["lava", "chasm"] }, width: { type: "integer", description: "폭 1~3" } },
};
const zoneSchema: JsonSchema = {
  type: "object", additionalProperties: false,
  description: "구역 단위 변형 — 구역(poly 또는 around)마다 침수·바닥·숲을 따로 준다. 구역이 겹치면 뒤의 것이 이긴다",
  properties: {
    name: { type: "string" }, poly: polyProp, around: aroundProp,
    flood: { type: "object", additionalProperties: false, properties: { depth: { type: "integer" }, amount: { type: "number" } } },
    recolor: { type: "array", items: recolorSchema }, forest: { type: "string", enum: [...FORESTS] },
    clear: { type: "string", enum: ["forest", "mount", "all"], description: "구역 안 물체 치우기" },
  },
};

const ALLOWED = [
  "baseMapId", "newMapId", "name", "preset", "flood", "rifts", "fissures", "recolor", "forest", "zones", "palette", "ruinIcons", "icons", "journey", "variantOps", "copyEvents", "preview",
] as const;

const HELP =
  "변형 작업(variantOps/zones 가 부르는 키트 작업, 칸 좌표 96×72): flood{depth?,amount?} 해안선이 안으로 들어온다(바다가 올라옴, 장소 둘레 2칸과 장소 사이 길은 지킨다) · "
  + "rift{line,width?} 대지가 갈라져 바다가 든다(장소를 잇는 땅 목은 남는다) · recolor{to,from?,amount?} 바닥 갈아엎기 · convert_forest{to} 숲 → 고사목 등 · "
  + "fissure{line,kind:lava|chasm} 용암·균열 줄기 · clear{what} 숲·산 치우기. 구역은 poly 다각형 또는 around{place,r}.";

function reject(message: string, code = "invalid-args"): never {
  throw new ToolError(message, { code });
}

function baseMapOf(project: Project, args: Record<string, unknown>): GameMap {
  const id = typeof args.baseMapId === "string" ? args.baseMapId : "";
  if (!id) reject("baseMapId 가 필요하다 — 파생할 기준 월드맵 id(edit_world_terrain 이 만든 맵). 기준 세계를 아직 안 만들었으면 먼저 edit_world_terrain({ops:[]}) 로 만들어라.");
  const map = project.maps[id as MapId];
  if (!map) reject(`맵을 찾을 수 없다: ${id}`, "map-not-found");
  if (!map.worldmapSource) reject(`맵 ${id} 은 월드맵 키트 지도가 아니다 — 변형은 edit_world_terrain 으로 만든 세계 지도에서만 파생한다. 손으로 칠한 월드맵이면 fill_region 으로 직접 고쳐라.`, "not-worldmap");
  return map;
}

function checkKeys(args: Record<string, unknown>): void {
  const extra = Object.keys(args).filter(k => !(ALLOWED as readonly string[]).includes(k));
  if (extra.length) reject(`derive_world_variant 가 모르는 인자: ${extra.join(", ")} — 있는 것: ${ALLOWED.join(", ")}. 지형 작업을 직접 주려면 variantOps 배열에 {op:"flood"|"rift"|"recolor"|"convert_forest"|"fissure"|"clear",...} 로 넣어라.`);
}

/** 기준 지도를 그대로 다시 빌드하는 요청(미리보기 — 몇 초, 같은 요청은 캐시). 칸 배열·길을 읽는 데 쓴다. */
function baseRequest(map: GameMap): WorldmapBuildRequest {
  const src = map.worldmapSource!;
  return { theme: src.theme, terrain: terrainOf(src.ops ?? [], src.base, src.fitSalt, src.variant?.spec), preview: true };
}

interface BaseLand { cells: number; bbox: [number, number, number, number]; cx: number }

/** 가장 큰 땅덩이(상하좌우 이어진 칸)의 범위 — 자동 균열 위치를 정한다. */
function largestLand(world: Built["world"]): BaseLand | null {
  const h = world.ground.length;
  const w = h ? world.ground[0]!.length : 0;
  const seen = new Uint8Array(w * h);
  let best: BaseLand | null = null;
  for (let sy = 0; sy < h; sy += 1) for (let sx = 0; sx < w; sx += 1) {
    if (seen[sy * w + sx] || world.ground[sy]![sx]! < 10) continue;
    const stack: Array<[number, number]> = [[sx, sy]];
    seen[sy * w + sx] = 1;
    let cells = 0; let x0 = w; let y0 = h; let x1 = 0; let y1 = 0; let sumX = 0;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      cells += 1; sumX += x;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || world.ground[ny]![nx]! < 10) continue;
        seen[ny * w + nx] = 1; stack.push([nx, ny]);
      }
    }
    if (!best || cells > best.cells) best = { cells, bbox: [x0, y0, x1, y1], cx: sumX / cells };
  }
  return best;
}

function autoRift(land: BaseLand | null): Op[] {
  if (!land) return [];
  const [, y0, , y1] = land.bbox;
  const cx = Math.round(land.cx);
  const dy = y1 - y0;
  const line: Pt[] = [[cx - 1, y0 - 1], [cx + 3, y0 + Math.round(dy * .28)], [cx - 2, y0 + Math.round(dy * .55)], [cx + 2, y0 + Math.round(dy * .8)], [cx, y1 + 1]];
  return [{ op: "rift", line, width: 2, note: "대지가 갈라진다(자동 — 가장 큰 대륙 가운데)" }];
}

function zoneMask(z: Record<string, unknown>): Op {
  return z.poly ? { poly: z.poly } : z.around ? { around: z.around } : {};
}

function asArray(value: unknown, name: string): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some(v => !v || typeof v !== "object" || Array.isArray(v))) reject(`${name} 는 객체 배열이다.`);
  return value as Record<string, unknown>[];
}

function floodOp(flood: unknown, mask: Op = {}): Op | null {
  const f = (flood && typeof flood === "object" ? flood : {}) as Record<string, unknown>;
  if (f.depth === 0) return null;                               // depth 0 = 침수 끄기
  const bad = Object.keys(f).filter(k => k !== "depth" && k !== "amount");
  if (bad.length) reject(`flood 가 모르는 키: ${bad.join(", ")} — depth(1~8칸)·amount(0~1)`);
  return { op: "flood", depth: f.depth ?? 3, amount: f.amount ?? .85, ...mask, note: "바다가 올라온다" };
}

/** 인자 → 키트 variant 명세. 기준 세계(base)에서 길 칸·가장 큰 땅덩이를 읽어 보호·자동 균열에 쓴다. */
export function buildVariantSpec(args: Record<string, unknown>, base: Built): { spec: WorldmapVariantSpec; summary: string[] } {
  checkKeys(args);
  const preset = args.preset === undefined ? "ruin" : args.preset;
  if (preset !== "ruin" && preset !== "none") reject("preset 은 ruin(파멸 후 기본 구성) | none(내가 준 것만) 이다.");
  const ruin = preset === "ruin";
  const ops: Op[] = [];
  const summary: string[] = [];

  if (args.flood !== undefined || ruin) {
    const op = floodOp(args.flood === undefined ? {} : args.flood);
    if (op) { ops.push(op); summary.push(`침수 깊이 ${op.depth}칸`); }
  }
  const riftsArg = args.rifts;
  const rifts = riftsArg === undefined && ruin ? autoRift(largestLand(base.world)) : asArray(riftsArg, "rifts").map(r => ({ op: "rift", ...r }));
  ops.push(...rifts);
  if (rifts.length) summary.push(`균열 ${rifts.length}줄`);

  const recolors = args.recolor === undefined
    ? (ruin ? [{ to: "dirt", from: ["grass", "farm", "crop"], amount: .8 }, { to: "badlands", from: ["savanna"], amount: .6 }] : [])
    : asArray(args.recolor, "recolor");
  for (const r of recolors) ops.push({ op: "recolor", ...r });
  if (recolors.length) summary.push(`바닥 갈아엎기 ${recolors.length}건`);

  const forest = args.forest === undefined ? (ruin ? "dead" : "keep") : args.forest;
  if (forest !== "keep") {
    if (typeof forest !== "string" || !(FORESTS as readonly string[]).includes(forest)) reject(`forest 는 keep | ${FORESTS.join(" | ")} 중 하나다.`);
    ops.push({ op: "convert_forest", to: forest });
    summary.push(`숲 → ${forest}`);
  }
  for (const f of asArray(args.fissures, "fissures")) { ops.push({ op: "fissure", ...f }); }
  if (args.fissures !== undefined) summary.push(`갈라진 줄기 ${asArray(args.fissures, "fissures").length}줄`);

  for (const [i, z] of asArray(args.zones, "zones").entries()) {
    const bad = Object.keys(z).filter(k => !["name", "poly", "around", "flood", "recolor", "forest", "clear"].includes(k));
    if (bad.length) reject(`zones[${i}] 가 모르는 키: ${bad.join(", ")} — name·poly|around·flood·recolor·forest·clear`);
    if (!z.poly && !z.around) reject(`zones[${i}] 에 구역(poly 다각형 또는 around{place,r})이 없다.`);
    const mask = zoneMask(z);
    const tag = typeof z.name === "string" ? { note: z.name } : {};
    if (z.flood !== undefined) { const op = floodOp(z.flood, { ...mask, ...tag }); if (op) ops.push(op); }
    for (const r of asArray(z.recolor, `zones[${i}].recolor`)) ops.push({ op: "recolor", ...r, ...mask, ...tag });
    if (z.forest !== undefined) ops.push({ op: "convert_forest", to: z.forest, ...mask, ...tag });
    if (z.clear !== undefined) ops.push({ op: "clear", what: z.clear, ...mask, ...tag });
    summary.push(`구역 ${typeof z.name === "string" ? `「${z.name}」` : i + 1}`);
  }
  for (const o of asArray(args.variantOps, "variantOps")) ops.push(o);

  const palette = args.palette === undefined ? (ruin ? "ruin" : undefined) : args.palette;
  if (palette !== undefined && palette !== null && (typeof palette !== "string" || !(VARIANT_PALETTES as readonly string[]).includes(palette))) {
    reject(`palette 는 ${VARIANT_PALETTES.join(" | ")} 중 하나다(null = 기준 색 그대로).`);
  }
  const journey = args.journey === undefined ? "free" : args.journey;
  if (journey !== "free" && journey !== "keep") reject("journey 는 free(모든 장소가 어떤 수단으로든 닿으면 통과, 막 순서는 안내만) | keep(설계 막 순서 그대로 — 장벽은 안 건드림) 이다.");
  const icons = args.icons === undefined ? undefined : args.icons;
  if (icons !== undefined && (!icons || typeof icons !== "object" || Array.isArray(icons))) reject("icons 는 {장소 id: 아이콘 이름} 객체다(칸 수가 같은 것만).");
  const ruinIcons = args.ruinIcons === undefined ? ruin : args.ruinIcons;
  if (typeof ruinIcons !== "boolean" && (typeof ruinIcons !== "number" || ruinIcons < 0 || ruinIcons > 1)) reject("ruinIcons 는 true|false|0~1(바꿀 장소 비율) 이다.");

  const spec: WorldmapVariantSpec = {
    journey,
    ...(palette ? { palette } : {}),
    ...(ruinIcons ? { icon_preset: "ruin" as const, ...(typeof ruinIcons === "number" ? { icon_ratio: ruinIcons } : {}) } : {}),
    ...(icons ? { icons: icons as Record<string, string> } : {}),
    protect_roads: base.world.road_cells.map(([x, y]) => [x, y] as Pt),
    ops,
  };
  if (!ops.length && !spec.palette && !spec.icon_preset && !spec.icons) {
    reject("변형할 것이 없다 — preset:\"ruin\"(기본)이거나 flood·rifts·recolor·forest·zones·palette·variantOps 중 하나는 있어야 한다.");
  }
  if (spec.palette) summary.push(`색 표 ${spec.palette}`);
  if (spec.icon_preset) summary.push("폐허 아이콘");
  return { spec, summary };
}

export interface VariantDiff {
  cells: number;
  landBase: number;
  landVariant: number;
  /** 바닥 종류나 물체가 바뀐 칸 / 전체 칸 */
  structurePercent: number;
  /** 기준 땅 칸 중 바뀐 칸 비율(바다로 잠김 포함) */
  landChangedPercent: number;
  floodedCells: number;
  groundChanged: number;
  objectChanged: number;
  /** 실제로 그려진 칸 그림(타일 화소)이 바뀐 칸 / 전체 칸 — 완성 빌드에서만(미리보기엔 없음). 감사 합격선 30% */
  tilePercent?: number;
  /** 같은 기준의 땅 칸 변화율(바다로 잠긴 칸 포함) */
  tileLandPercent?: number;
  /** 구역별(3×3 격자) 땅 칸 변화율 — 구역마다 의미 있게 바뀌었는지 */
  zones: Array<{ zone: string; landCells: number; changedPercent: number }>;
}

export function diffWorlds(a: Built["world"], b: Built["world"]): VariantDiff {
  const h = a.ground.length; const w = h ? a.ground[0]!.length : 0;
  let landBase = 0; let landVariant = 0; let changed = 0; let landChanged = 0; let flooded = 0; let groundChanged = 0; let objectChanged = 0;
  const zones = Array.from({ length: 9 }, () => ({ land: 0, changed: 0 }));
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const ga = a.ground[y]![x]!; const gb = b.ground[y]![x]!;
    const oa = a.object[y]![x]!; const ob = b.object[y]![x]!;
    const isLand = ga >= 1;
    if (isLand) landBase += 1;
    if (gb >= 1) landVariant += 1;
    const gd = ga !== gb; const od = oa !== ob;
    if (gd) groundChanged += 1;
    if (od) objectChanged += 1;
    if (gd || od) changed += 1;
    if (isLand) {
      const z = zones[Math.min(2, Math.floor(y / (h / 3))) * 3 + Math.min(2, Math.floor(x / (w / 3)))]!;
      z.land += 1;
      if (gd || od) { landChanged += 1; z.changed += 1; }
    }
    if (isLand && gb === 0) flooded += 1;
  }
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  const names = ["북서", "북", "북동", "서", "중앙", "동", "남서", "남", "남동"];
  return {
    cells: w * h, landBase, landVariant, structurePercent: pct(changed, w * h), landChangedPercent: pct(landChanged, landBase),
    floodedCells: flooded, groundChanged, objectChanged,
    zones: zones.map((z, i) => ({ zone: names[i]!, landCells: z.land, changedPercent: pct(z.changed, z.land) })),
  };
}

/** 타일 재료 키는 그 칸 그림의 해시라, 키가 다르면 실제로 다르게 그려진 칸이다. */
export function tileDiff(base: GameMap, built: Built): { percent: number; landPercent: number } | null {
  const a = base.worldmapSource?.tilemap;
  const b = built.tilemap;
  if (!a || !b || a.lowerTiles.length !== b.lowerTiles.length) return null;
  const world = built.world;
  let changed = 0; let land = 0; let landChanged = 0;
  for (let i = 0; i < a.lowerTiles.length; i += 1) {
    const x = i % world.width; const y = Math.floor(i / world.width);
    const diff = a.materialKeys[a.lowerTiles[i]!] !== b.tiles[b.lowerTiles[i]!]?.key;
    if (diff) changed += 1;
    if ((world.ground[y]?.[x] ?? 0) >= 1) { land += 1; if (diff) landChanged += 1; }
  }
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  return { percent: pct(changed, a.lowerTiles.length), landPercent: pct(landChanged, land) };
}

function variantRequest(map: GameMap, spec: WorldmapVariantSpec, preview: boolean): WorldmapBuildRequest {
  const src = map.worldmapSource!;
  return { theme: src.theme, terrain: terrainOf(src.ops ?? [], src.base, src.fitSalt, spec), preview };
}

function specFor(project: Project | undefined, args: Record<string, unknown>): { map: GameMap; spec: WorldmapVariantSpec; summary: string[]; base: Built } {
  if (!project) reject("프로젝트가 없다", "no-project");
  const map = baseMapOf(project, args);
  const base = resultFor(baseRequest(map));
  const { spec, summary } = buildVariantSpec(args, base);
  return { map, spec, summary, base };
}

const deriveWorldVariant: ToolDefinition = {
  name: "derive_world_variant",
  description:
    "기존 세계 지도에서 같은 대륙의 **변형 세계**(파멸 후·침수·황폐)를 파생해 새 맵으로 만든다. 「파멸 전 세계지도와 파멸 후 세계지도(같은 대륙, 바다가 올라옴)」는 edit_world_terrain 을 두 번 부르지 말고 이 도구를 쓴다 — "
    + "기준 지도와 같은 지형 위에 바다가 올라오고(flood) 대지가 갈라지고(rift) 풀밭이 황무지로 변하고(recolor) 숲이 고사목이 되고(forest) 색 표가 바뀌고(palette) 마을 아이콘이 폐허가 된다(ruinIcons). "
    + "기본 preset:\"ruin\" 은 위를 한꺼번에(침수 3칸·자동 균열·바닥 갈아엎기·고사목·ruin 색 표·폐허 아이콘 70%) 하고, 인자로 덮어쓴다. 구역마다 따로는 zones. "
    + "여정 검사는 설계 막 순서 대신 「모든 장소가 어떤 수단으로든 닿는다」(journey:free)로 하고, 막이 바뀐 장소는 data.journeyCheck.notes 로 알린다(keep 이면 설계 막 순서 그대로). "
    + "{baseMapId, newMapId?, name?, preset?, flood?, rifts?, fissures?, recolor?, forest?, zones?, palette?, ruinIcons?, icons?, journey?, variantOps?, copyEvents?, preview?}. "
    + "기준 지도의 이벤트(마을·던전 입구 등)는 걸을 수 있는 칸에 남으면 같은 자리에 복사한다(copyEvents 기본 true) — 물에 잠긴 입구는 data.events.dropped 로 알린다. "
    + "preview:true 는 저장하지 않고 도식 그림·변화 통계(data.diff)만 본다(몇 초). 실제 빌드는 지형이 바뀌어 처음 2분 남짓. 결과 data.diff 가 바뀐 칸 비율·구역별 변화를 알려 준다. "
    + HELP,
  mode: "write",
  domains: ["map", "world"],
  preservesAuthoredRaster: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["baseMapId"],
    properties: {
      baseMapId: { type: "string", description: "기준 월드맵 키트 지도 id(edit_world_terrain 이 만든 맵)" },
      newMapId: { type: "string", description: "새 변형 맵 id(기본 `<baseMapId>_variant`)" },
      name: { type: "string", description: "새 맵 이름(기본 「<기준 이름> (변형)」)" },
      preset: { type: "string", enum: ["ruin", "none"], description: "ruin(기본) = 파멸 후 구성 한 번에 · none = 내가 준 변형만" },
      flood: {
        type: "object", additionalProperties: false,
        properties: { depth: { type: "integer", description: "해안에서 안쪽으로 먹는 칸 수 1~8(기본 3, 0 = 침수 끄기)" }, amount: { type: "number", description: "먹는 정도 0~1(기본 0.85)" } },
        description: "바다가 올라온다. 생략하면 preset 기본(ruin 이면 깊이 3)",
      },
      rifts: { type: "array", items: riftSchema, description: "갈라지는 선들. 생략 = ruin 이면 가장 큰 대륙 가운데에 자동 한 줄. 끄려면 빈 배열" },
      fissures: { type: "array", items: fissureSchema, description: "용암·균열 줄기" },
      recolor: { type: "array", items: recolorSchema, description: "바닥 갈아엎기. 생략 = ruin 이면 풀·밭→황무지, 사바나→협곡토" },
      forest: { type: "string", enum: ["keep", ...FORESTS], description: "숲을 이 종류로(기본 ruin = dead 고사목, keep = 그대로)" },
      zones: { type: "array", items: zoneSchema, description: "구역 단위 변형" },
      palette: { type: "string", enum: [...VARIANT_PALETTES], description: "색 표 덮어쓰기(기본 ruin = 탁한 녹청 바다·마른 풀·재 낀 산, ashfall = 붉은 하늘 재)" },
      ruinIcons: { type: "boolean", description: "같은 칸 수의 폐허 아이콘으로 바꾸기(기본 ruin 이면 true, fantasy 테마 전용)" },
      icons: { type: "object", additionalProperties: true, description: "{장소 id: 아이콘 이름} 장소별 지정(칸 수가 같은 사람 선택 아이콘만)" },
      journey: { type: "string", enum: ["free", "keep"], description: "free(기본) = 도달성만 · keep = 설계 막 순서 유지(장벽을 안 건드린다)" },
      variantOps: { type: "array", items: { type: "object", additionalProperties: true }, description: "키트 변형 작업 직접 지정 {op,...} — 모르는 키는 거절된다" },
      copyEvents: { type: "boolean", description: "기준 지도 이벤트를 같은 자리에 복사(기본 true)" },
      preview: { type: "boolean", description: "true 면 저장하지 않고 도식·통계만" },
    },
  },
  invalidArgsExample: { baseMapId: "world_map", newMapId: "world_ruin", name: "세계(파멸 후)", preset: "ruin" },
  async prepare(args, project): Promise<void> {
    if (!project) return;
    let map: GameMap;
    try { map = baseMapOf(project, args); checkKeys(args); } catch { return; }    // run 이 같은 사유로 거절한다
    await prepareRequest(baseRequest(map));
    let spec: WorldmapVariantSpec;
    try { spec = buildVariantSpec(args, resultFor(baseRequest(map))).spec; } catch { return; }
    await prepareRequest(variantRequest(map, spec, args.preview === true));
    if (args.preview !== true) await prepareRequest(variantRequest(map, spec, true));   // 변화 통계는 칸 배열(미리보기 빌드)에서
  },
  run(draft, args): ToolExecResult {
    const { map: baseMap, spec, summary, base } = specFor(draft, args);
    const preview = args.preview === true;
    const request = variantRequest(baseMap, spec, preview);
    const result = resultFor(request);
    const statResult = preview ? result : resultFor(variantRequest(baseMap, spec, true));
    const diff = diffWorlds(base.world, statResult.world);
    const tiles = preview ? null : tileDiff(baseMap, result);
    if (tiles) { diff.tilePercent = tiles.percent; diff.tileLandPercent = tiles.landPercent; }
    rememberWorldImage("derive_world_variant", result.imageDataUrl);
    const common = {
      baseMapId: baseMap.id, variant: { ...spec, protect_roads: `[${spec.protect_roads?.length ?? 0}칸]` }, summary, diff,
      journeyCheck: result.journeyCheck, warnings: result.warnings, ascii: result.ascii, places: placesSummary(result), themeNote: result.themeNote,
      iconSelection: result.iconSelection, ...(result.world.layout ? { layout: layoutOf(result, false) } : {}),
    };
    if (result.journeyCheck && !result.journeyCheck.ok) {
      throw new ToolError(
        `변형 지도의 도달성 검사 불일치 — 저장하지 않았다:\n${result.journeyCheck.bad.join("\n")}\n`
        + `침수(flood.amount·depth)를 줄이거나, 끊긴 장소 둘레를 zones 에서 빼거나, journey:"free" 로 두어라(막 순서 규칙을 뺀다).`
        + (result.warnings.length ? `\n경고: ${result.warnings.join(" / ")}` : ""),
        { code: "journey-check-failed" },
      );
    }
    if (preview) {
      return { summary: `변형 미리보기(저장 안 함) — ${summary.join(" · ")} — 구조 변화 ${diff.structurePercent}% / 땅 변화 ${diff.landChangedPercent}%`, data: { preview: true, ...common } };
    }
    const mapId = (typeof args.newMapId === "string" && args.newMapId ? args.newMapId : `${baseMap.id}_variant`) as MapId;
    if (mapId === baseMap.id) reject("newMapId 가 기준 지도와 같다 — 기준 지도를 덮어쓰지 않는다. 다른 id 를 줘라.");
    if (draft.maps[mapId] && !draft.maps[mapId]!.worldmapSource?.variant) reject(`맵 id ${mapId} 가 이미 다른 맵이다 — newMapId 를 바꿔라.`, "map-id-taken");
    const name = typeof args.name === "string" && args.name ? args.name : `${baseMap.name} (변형)`;
    const { created, strandedEvents } = applyWorldmap(draft, mapId, name, request, result, { of: baseMap.id, preset: args.preset === "none" ? "custom" : "ruin" });
    const built = draft.maps[mapId]!;
    if (baseMap.characterScale) built.characterScale = baseMap.characterScale;
    const events = copyEvents(baseMap, built, result, args.copyEvents !== false);
    const warnings = [
      ...result.warnings,
      ...(events.dropped.length ? [`물에 잠기거나 걸을 수 없게 된 칸의 이벤트 ${events.dropped.length}개는 복사하지 않았다: ${events.dropped.slice(0, 8).join(", ")} — 필요하면 create_transfer_pair 로 새 입구를 놓아라`] : []),
      ...(strandedEvents.length ? [`걸을 수 없는 칸의 이벤트 ${strandedEvents.length}개: ${strandedEvents.slice(0, 8).join(", ")}`] : []),
      ...(diff.landChangedPercent < 30 ? [`땅 변화가 ${diff.landChangedPercent}% 뿐이다 — 파멸 전/후로 보이려면 flood.depth·recolor.amount 를 키우거나 zones 로 구역을 더하라`] : []),
    ];
    return {
      summary: `${created ? "변형 세계 지도" : "변형 세계 지도 갱신"} ${mapId}(기준 ${baseMap.id}) — ${summary.join(" · ")} — 칸 그림 변화 ${diff.tilePercent ?? "-"}% (땅 칸 ${diff.tileLandPercent ?? "-"}%) · 바닥·물체 변화 ${diff.landChangedPercent}%(잠긴 땅 ${diff.floodedCells}칸), 이벤트 ${events.copied}개 복사, 여정 검사 통과(${result.seconds}초)`,
      data: { mapId, created, tilesetId: `worldmap_${mapId}`, townArt: townArtHint(request.theme), events, ...common },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

/** 기준 지도의 이벤트를 변형 지도에 같은 자리로 복사 — 걸을 수 없게 된 칸의 것은 뺀다. */
function copyEvents(from: GameMap, to: GameMap, result: Built, enabled: boolean): { copied: number; dropped: string[] } {
  if (!enabled) return { copied: 0, dropped: [] };
  const dropped: string[] = [];
  const copied: GameEvent[] = [];
  for (const event of from.events) {
    if ((result.world.walk[event.y] ?? "")[event.x] === "1") copied.push(structuredClone(event));
    else dropped.push(`${event.name ?? event.id}(${event.x},${event.y})`);
  }
  to.events = copied;
  return { copied: copied.length, dropped };
}

export const WORLD_VARIANT_TOOLS: readonly ToolDefinition[] = [deriveWorldVariant];
