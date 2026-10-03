/**
 * jp_city 참고문서용 엔진 실측 덤프 — 문서의 그림·배열·오류 좌표는 전부 여기서 나온 진짜 도구/엔진 결과다(손으로 쓴 값 없음).
 *
 *   npx --no-install tsx tiledata/jp-city/refs/engine_dump.mts        (저장소 루트에서)
 *
 * 출력 tiledata/jp-city/refs/engine-results.json — scripts/content/jp-city/bake_refs.py 가 읽어 PNG·MD 로 굽는다.
 * 쓰는 실제 코드:
 *   건물      src/editor/tools/jpCityTools.ts  build_jp_city_building / list_jp_city_building_parts (+ 순수 조립기 builder.ts)
 *   오토타일  src/editor/tools/mapTools.ts     paint_tiles · stamp_layer_block · v3 fill_region · lay_path, 엔진 autotileEngine.ts
 *   통행      src/project/collision.ts         isPassable · passabilityOf
 *   층        src/editor/tileLayerPolicy.ts    tileLayerPolicy().home · src/player/characterDepth.ts mapUpperTileDepth
 * 같은 입력이면 같은 JSON(난수·시각 없음).
 */
import fs from "node:fs";
import path from "node:path";
import { allTools } from "../../../src/editor/tools/toolRegistry";
import { createEmptyToolProject } from "../../../src/editor/tools/emptyProject";
import { exampleToToolArgs } from "../../../src/editor/tools/jpCityTools";
import { buildJpCityBuilding, JP_CITY_BUILDING_SPEC as SPEC, JP_CITY_ISSUE_CODES, checkJpCityStructure, jpCityBandMeta } from "../../../src/editor/jpCity/builder";
import { createJpCityTileset } from "../../../src/project/defaults/jpCity";
import { autotileLayerView, autotileVariantForCell, autotileGroupLayer } from "../../../src/project/defaults/autotileEngine";
import { isPassable, passabilityOf } from "../../../src/project/collision";
import { tileLayerPolicy } from "../../../src/editor/tileLayerPolicy";
import { MAP_UPPER_LAYER_DEPTH, mapUpperTileDepth } from "../../../src/player/characterDepth";
import type { GameMap, Project, AutotileGroup } from "../../../src/project/types";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TS = createJpCityTileset();
const TOOLS = new Map(allTools().map((t) => [t.name, t]));
const tool = (name: string) => TOOLS.get(name) ?? (() => { throw new Error(`도구 없음: ${name}`); })();
const ST = SPEC.street;
const SW = ST.sw!, ROAD = ST.road_c!, GRAVEL = ST.gravel!, LAWN = ST.lawn!, WATER = ST.water!;

type Layers = { "1": number[]; "2": number[]; "3": number[]; "4": number[] };
function mkProject(W: number, H: number, fill: number): { p: Project; map: GameMap } {
  const p = createEmptyToolProject("jp-refs");
  p.tilesets.jp_city = createJpCityTileset();
  const map = { id: "m", name: "m", width: W, height: H, tilesetId: "jp_city", tileSize: 16,
    lowerTiles: new Array(W * H).fill(fill), upperTiles: new Array(W * H).fill(-1), events: [] } as unknown as GameMap;
  p.maps.m = map;
  return { p, map };
}
const layersOf = (map: GameMap): Layers => ({
  "1": [...map.lowerTiles], "2": [...(map.lowerOverlayTiles ?? new Array(map.width * map.height).fill(-1))],
  "3": [...map.upperTiles], "4": [...(map.upperOverlayTiles ?? new Array(map.width * map.height).fill(-1))],
});
const grid = (a: number[], W: number): number[][] => { const out: number[][] = []; for (let i = 0; i < a.length; i += W) out.push(a.slice(i, i + W)); return out; };
const call = (p: Project, name: string, args: Record<string, unknown>) => {
  try { const r = tool(name).run(p, args); return { ok: true as const, summary: r.summary, warnings: r.warnings ?? [], data: r.data }; }
  catch (e) { const err = e as { message: string; code?: string }; return { ok: false as const, summary: err.message, code: err.code ?? "", warnings: [] as string[], data: undefined }; }
};

const OUT: Record<string, unknown> = {};

// =============================================================================================== 1. 층·통행 감사(엔진 판정 대조)
{
  const groupOf = new Map<number, string>();
  for (const g of TS.tileGroups ?? []) for (const t of g.tileIds) if (!groupOf.has(t)) groupOf.set(t, g.id);
  const depthClass = (d: number) => (d === MAP_UPPER_LAYER_DEPTH ? "above" : d < 100_000 ? "below" : "ysort");
  const expectClass: Record<string, string> = { solid: "ysort", passable: "below", star: "above" };
  // 엔진 규칙(src/player/characterDepth.ts isWalkableStairTile): ★ 칸이라도 태그에 stair·계단·사다리가 있으면 「밟는 계단」이라 항상 위가 아니라 캐릭터 아래(y 정렬 아래)로 그린다.
  // 설계된 동작이므로 어긋남이 아니다 — 별도 목록(walkableStairs)으로 세고 기대 그림 순서를 below 로 본다.
  const isStair = (m: { tags?: string[] }) => (m.tags ?? []).some((tag) => /stair/i.test(tag) || tag.includes("계단") || tag.includes("사다리"));
  const walkableStairs: number[] = [];
  const blank = new Set<number>();
  let checked = 0;
  const byGroup: Record<string, Record<string, number>> = {};
  const mism: { tile: number; label: string; group: string; problems: string[] }[] = [];
  const kindCount: Record<string, number> = {};
  const codes: string[] = new Array(TS.count).fill("");
  const asphalt = ROAD;
  for (let t = 0; t < TS.count; t++) {
    const m = TS.tileMeta![t]!;
    if (!m || (m.label ?? "").startsWith("빈 칸") || (m.label ?? "").startsWith("미사용")) { blank.add(t); continue; }
    checked++;
    const pol = tileLayerPolicy(TS, t);
    const home = pol.home;
    const walk = passabilityOf(TS, asphalt, -1, t, -1).up;
    const cls = depthClass(mapUpperTileDepth(TS, t, 10, 16));
    const problems: string[] = [];
    const stair = m.passage === "star" && isStair(m);
    if (stair) walkableStairs.push(t);
    const want = stair ? "below" : m.passage ? expectClass[m.passage] : undefined;
    if (m.passage && want && want !== cls) problems.push(`passage=${m.passage} 인데 엔진 그림 순서 ${cls}`);
    if (m.passage === "solid" && walk) problems.push("passage=solid 인데 엔진은 걸을 수 있다");
    if ((m.passage === "passable" || m.passage === "star") && !walk) problems.push(`passage=${m.passage} 인데 엔진은 막힘`);
    if (m.defaultLayer && m.defaultLayer !== home) problems.push(`defaultLayer=${m.defaultLayer} 인데 엔진 홈 ${home}`);
    const g = groupOf.get(t) ?? "(그룹 없음)";
    codes[t] = `${home === "upper" ? "u" : home === "lower" ? "l" : "b"}${walk ? "1" : "0"}${cls === "above" ? "a" : cls === "below" ? "b" : "y"}`;
    const key = `${m.passage}|prio=${TS.priority[t]}|home=${home}|depth=${cls}`;
    (byGroup[g] ??= {})[key] = (byGroup[g]![key] ?? 0) + 1;
    kindCount[key] = (kindCount[key] ?? 0) + 1;
    if (problems.length) mism.push({ tile: t, label: m.label ?? "", group: g, problems });
  }
  // 그룹 층 감사: 그룹 defaultLayer·layerHome 이 멤버 칸의 엔진 홈(tileLayerPolicy().home)과 맞는가 — 전부 위=upper, 전부 아래=lower, 섞이면 mixed(+perCell).
  const groupLayerMismatches: { group: string; declared: string; layerHome: string | undefined; homes: Record<string, number> }[] = [];
  for (const g of TS.tileGroups ?? []) {
    if (g.defaultLayer === "event") continue;
    const homes: Record<string, number> = {};
    for (const t of g.tileIds) { if (blank.has(t)) continue; const h = tileLayerPolicy(TS, t).home; homes[h] = (homes[h] ?? 0) + 1; }
    const keys = Object.keys(homes);
    if (keys.length === 0) continue;
    const wantLayer = keys.length === 1 ? keys[0]! : "mixed";
    const wantHome = keys.length === 1 ? keys[0]! : "perCell";
    if (g.defaultLayer !== wantLayer || g.layerHome !== wantHome) groupLayerMismatches.push({ group: g.id, declared: g.defaultLayer, layerHome: g.layerHome, homes });
  }
  OUT.layerAudit = { walkableStairs, groupLayerMismatches, groups: (TS.tileGroups ?? []).length, codes, count: TS.count, checked, blank: blank.size, mismatches: mism.length, byGroup, kindCount, examples: mism.slice(0, 60),
    mismatchByProblem: mism.reduce<Record<string, number>>((a, r) => { for (const p of r.problems) { const k = p.replace(/\d+/g, "N"); a[k] = (a[k] ?? 0) + 1; } return a; }, {}) };
}

// =============================================================================================== 2. 오토타일 17세트
type AtDemo = { id: string; layer: 1 | 2 | 3; outside: number; under: number; pattern: string[] };
const P8 = ["............", ".######.....", ".######..##.", ".##..###.##.", ".##..###....", ".#######.#..", ".#######.##.", "............"];
const P4 = ["............", ".########...", ".#......#...", ".#......####", ".#......#...", ".#####..#...", ".....#..###.", "............"];
const AT_DEMOS: AtDemo[] = [
  { id: "jp-sidewalk-curb", layer: 1, outside: ROAD, under: ROAD, pattern: P8 },
  { id: "jp-lane-road", layer: 1, outside: SW, under: SW, pattern: P8 },
  { id: "jp-lawn-dirt", layer: 1, outside: GRAVEL, under: GRAVEL, pattern: P8 },
  { id: "jp-gravel-lawn", layer: 1, outside: LAWN, under: LAWN, pattern: P8 },
  { id: "jp-plaza-pave", layer: 1, outside: LAWN, under: LAWN, pattern: P8 },
  { id: "jp-water-pond", layer: 1, outside: LAWN, under: LAWN, pattern: P8 },
  { id: "jp-water-canal", layer: 1, outside: SW, under: SW, pattern: P8 },
  { id: "jp-wall-block", layer: 3, outside: SW, under: SW, pattern: P4 },
  { id: "jp-hedge", layer: 3, outside: LAWN, under: LAWN, pattern: P4 },
  { id: "jp-fence-mesh", layer: 3, outside: SW, under: SW, pattern: P4 },
  { id: "jp-guardrail", layer: 3, outside: SW, under: SW, pattern: P4 },
  { id: "jp-rail-track", layer: 1, outside: GRAVEL, under: GRAVEL, pattern: P4 },
  { id: "jp-lane-center", layer: 2, outside: ROAD, under: ROAD, pattern: P4 },
  { id: "jp-lane-dash", layer: 2, outside: ROAD, under: ROAD, pattern: P4 },
  { id: "jp-crosswalk-ew", layer: 2, outside: ROAD, under: ROAD, pattern: ["............", "............", ".##########.", ".##########.", "............", "............", "............", "............"] },
  { id: "jp-crosswalk-ns", layer: 2, outside: ROAD, under: ROAD, pattern: ["............", "..##........", "..##........", "..##........", "..##........", "..##........", "..##........", "............"] },
  { id: "jp-tactile", layer: 2, outside: SW, under: SW, pattern: P4 },
];

function atIssues(map: GameMap, g: AutotileGroup, expectLayer: 1 | 2 | 3) {
  const members = new Set(g.memberTileIds);
  const L = layersOf(map);
  const issues: { code: string; x: number; y: number; layer: number; tile: number; want?: number }[] = [];
  for (const layer of [1, 2, 3, 4] as const) {
    const arr = L[String(layer) as keyof Layers];
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i]!;
      if (!members.has(t)) continue;
      const x = i % map.width, y = Math.floor(i / map.width);
      if (layer !== expectLayer) { issues.push({ code: "wrong-layer", x, y, layer, tile: t }); continue; }
      const view = autotileLayerView(map, layer as 1 | 2 | 3 | 4);
      const want = autotileVariantForCell(view, g, x, y);
      if (want !== undefined && want !== t) issues.push({ code: "autotile-stale", x, y, layer, tile: t, want });
    }
  }
  return issues;
}

const autotiles: unknown[] = [];
for (const d of AT_DEMOS) {
  const g = TS.autotileGroups!.find((x) => x.id === d.id)!;
  const W = d.pattern[0]!.length, H = d.pattern.length;
  const nbr = g.neighborhood ?? 4;
  const body = g.variantMap[String(nbr === 8 ? 255 : 15)]!;
  const cells = d.pattern.flatMap((row, y) => [...row].map((ch, x) => (ch === "#" ? { x, y } : null))).filter((c): c is { x: number; y: number } => c !== null);
  const fresh = () => {
    const { p, map } = mkProject(W, H, d.outside);
    if (d.layer !== 1) for (let i = 0; i < map.lowerTiles.length; i++) map.lowerTiles[i] = d.under;
    return { p, map };
  };
  // (정상) 실제 paint_tiles 도구로 칠한다 — 도구가 이웃을 보고 모양을 다시 잡는다.
  const A = fresh();
  const rA = call(A.p, "paint_tiles", { mapId: "m", layer: String(d.layer), mode: "cells", tile: body, cells });
  const issuesA = atIssues(A.map, g, d.layer);
  // (오류 1) 찍기만 하고 재계산하지 않음 — stamp_layer_block reshape:false 로 몸통 칸만 번호 그대로.
  const B = fresh();
  const stampRows: number[][] = d.pattern.map((row) => [...row].map((ch) => (ch === "#" ? body : -1)));
  const rB = call(B.p, "stamp_layer_block", { mapId: "m", x: 0, y: 0, layers: { [String(d.layer)]: stampRows }, reshape: false });
  const issuesB = atIssues(B.map, g, d.layer);
  // (오류 2) 잘못된 층 — 같은 칸을 맞는 모양(정상 결과)째로 다른 층에 옮겨 찍는다.
  const wrongLayer = d.layer === 1 ? 3 : d.layer === 3 ? 1 : 1;
  const C = fresh();
  const goodRows = grid(layersOf(A.map)[String(d.layer) as keyof Layers], W).map((row, y) => row.map((t, x) => (d.pattern[y]![x] === "#" ? t : -1)));
  const rC = call(C.p, "stamp_layer_block", { mapId: "m", x: 0, y: 0, layers: { [String(wrongLayer)]: goodRows }, reshape: false });
  const issuesC = atIssues(C.map, g, d.layer);
  // (참고) 투명 오버레이를 paint_tiles 1층으로 요청하면 도구가 어느 층에 놓고 모양을 잡는가
  let reroute: unknown = null;
  if (d.layer === 2) {
    const R = fresh();
    const rr = call(R.p, "paint_tiles", { mapId: "m", layer: "1", mode: "cells", tile: body, cells });
    const li = layersOf(R.map);
    reroute = { ok: rr.ok, summary: rr.summary, warnings: rr.warnings, onLayer3: li["3"].filter((t) => t >= 0).length, onLayer2: li["2"].filter((t) => t >= 0).length,
      distinct: [...new Set(li["3"].filter((t) => t >= 0))].length, issues: atIssues(R.map, g, 2).length, layers: li };
  }
  const masksUsed = new Set<number>();
  for (const c of cells) { let m = 0; const on = (x: number, y: number) => d.pattern[y]?.[x] === "#";
    if (on(c.x, c.y - 1)) m |= 1; if (on(c.x + 1, c.y)) m |= 2; if (on(c.x, c.y + 1)) m |= 4; if (on(c.x - 1, c.y)) m |= 8;
    if (nbr === 8) { if (on(c.x + 1, c.y - 1)) m |= 16; if (on(c.x + 1, c.y + 1)) m |= 32; if (on(c.x - 1, c.y + 1)) m |= 64; if (on(c.x - 1, c.y - 1)) m |= 128; }
    masksUsed.add(m); }
  autotiles.push({ id: d.id, layer: d.layer, outside: d.outside, under: d.under, pattern: d.pattern, W, H, nbr, body, wrongLayer, cells: cells.length,
    normal: { ok: rA.ok, summary: rA.summary, warnings: rA.warnings, layers: layersOf(A.map), issues: issuesA },
    staleErr: { ok: rB.ok, summary: rB.summary, layers: layersOf(B.map), issues: issuesB },
    layerErr: { ok: rC.ok, summary: rC.summary, layers: layersOf(C.map), issues: issuesC }, reroute, distinctMasks: masksUsed.size });
}
OUT.autotiles = autotiles;

// 8방 변형표가 「정규화 규칙」을 따르는지(문서에 적는 규칙의 근거): variantMap[m] == variantMap[canon(m)]
{
  const rule: Record<string, { ok: boolean; canonCount: number; bad: number[] }> = {};
  const canon = (m: number): number => { let c = m & 15; if ((m & 1) && (m & 2) && (m & 16)) c |= 16; if ((m & 2) && (m & 4) && (m & 32)) c |= 32; if ((m & 4) && (m & 8) && (m & 64)) c |= 64; if ((m & 8) && (m & 1) && (m & 128)) c |= 128; return c; };
  for (const g of TS.autotileGroups!) {
    if ((g.neighborhood ?? 4) !== 8) continue;
    const bad: number[] = [];
    for (let m = 0; m < 256; m++) if (g.variantMap[String(m)] !== g.variantMap[String(canon(m))]) bad.push(m);
    rule[g.id] = { ok: bad.length === 0, canonCount: new Set(Array.from({ length: 256 }, (_, m) => canon(m))).size, bad: bad.slice(0, 8) };
  }
  OUT.canonRule = rule;
}

// =============================================================================================== 3. 건물 조립 도구 — 완성 예제 25
function ctxFor(rect: { w: number; h: number }, tweak?: (lower: number[], W: number, H: number) => void) {
  const W = rect.w + 4, H = rect.h + 5;
  const { p, map } = mkProject(W, H, SW);
  for (let y = rect.h + 2; y < H; y++) for (let x = 0; x < W; x++) map.lowerTiles[y * W + x] = ROAD;
  tweak?.(map.lowerTiles, W, H);
  return { p, map, W, H };
}
function probe(input: Record<string, unknown>) {
  const r = buildJpCityBuilding({ ...(input as object), x: 20, y: 40 } as never);
  return { rect: r.rect, dx0: r.rect.x0 - 20, dy0: r.rect.y0 - 40, ok: r.ok };
}
function runBuilding(toolArgsNoPos: Record<string, unknown>, builderInput: Record<string, unknown>, tweak?: (lower: number[], W: number, H: number) => void) {
  const pr = probe(builderInput);
  const ctx = ctxFor(pr.rect, tweak);
  const fx = 2 - pr.dx0, fy = 1 - pr.dy0;
  const snap = (m: GameMap) => JSON.stringify([m.lowerTiles, m.upperTiles, m.lowerOverlayTiles ?? null, m.upperOverlayTiles ?? null]);
  const before = snap(ctx.map);
  const preMap = structuredClone(ctx.map);   // 짓기 전 땅(검사·「지었다면」 계산은 이것을 기준으로)
  const res = call(ctx.p, "build_jp_city_building", { ...toolArgsNoPos, mapId: "m", x: fx, y: fy });
  // 도구는 성공하면 draft.maps[mapId] 를 새 객체로 바꾼다(structuredClone) — 이전 참조를 계속 읽으면 건물이 안 보인다.
  const unchanged = snap(ctx.p.maps.m as GameMap) === before;
  ctx.map = ctx.p.maps.m as GameMap;
  const rect = { x0: 2, y0: 1, w: pr.rect.w, h: pr.rect.h };
  const walk: string[] = [];
  for (let y = 0; y <= rect.y0 + rect.h; y++) { let s = ""; for (let x = 0; x < ctx.W; x++) s += isPassable(ctx.p, ctx.map, x, y) ? "." : "#"; walk.push(s); }
  return { res, ctx, rect, foot: { x: fx, y: fy }, walk, unchanged, preMap };
}
const buildings: unknown[] = [];
for (const [name, ex] of Object.entries(SPEC.examples)) {
  const input = ex.input as Record<string, unknown>;
  const args = exampleToToolArgs(input);
  const r = runBuilding(args, input);
  const data = r.res.ok ? (r.res.data as { doors: unknown; access: unknown; solidCells: number; placedCells: number; warnings: string[] }) : null;
  // 거부된 예제는 「지었다면 이렇게」를 보이기 위해 조립기 계산 결과(placements)를 따로 싣는다(맵에 쓰지 않음).
  let wouldBe: Layers | null = null; let issues: unknown[] = [];
  const raw = buildJpCityBuilding({ ...(input as object), x: r.foot.x, y: r.foot.y } as never, { world: { width: r.ctx.W, height: r.ctx.H, passable: (x, y) => isPassable(r.ctx.p, r.preMap, x, y) } });
  issues = raw.issues.map((i) => ({ severity: i.severity, code: i.code, x: i.x, y: i.y, message: i.message, detail: i.detail }));
  if (!r.res.ok) {
    const { p, map } = mkProject(r.ctx.W, r.ctx.H, SW);
    map.lowerTiles = [...r.preMap.lowerTiles];
    for (const pl of raw.placements) { const i = pl.y * map.width + pl.x; if (pl.lower !== undefined) map.lowerTiles[i] = pl.lower; if (pl.upper !== undefined) map.upperTiles[i] = pl.upper; if (pl.overlay !== undefined) { map.upperOverlayTiles ??= new Array(map.width * map.height).fill(-1); map.upperOverlayTiles[i] = pl.overlay; } }
    void p; wouldBe = layersOf(map);
  }
  buildings.push({ name, ko: ex.ko, input, toolArgs: { ...args, x: r.foot.x, y: r.foot.y }, ok: r.res.ok, code: r.res.ok ? "" : (r.res as { code: string }).code, summary: r.res.summary,
    W: r.ctx.W, H: r.ctx.H, rect: r.rect, foot: r.foot, layers: r.res.ok ? layersOf(r.ctx.map) : null, wouldBe, walk: r.walk, data, issues,
    asm: raw.assembled ? { n: raw.assembled.n, rows: raw.assembled.rows } : null });
}
OUT.buildings = buildings;

// =============================================================================================== 4. 변조 실험(건물) — 정상/오류 쌍
const base = { w: 6, floors: 3, floorKind: "pairs", wall: "shiro", ground: "gr.konbini.0", roof: "roof.ac.tank", door: { type: "auto", col: 2 } };
type Tamper = { id: string; title: string; want: string; build: Record<string, unknown>; tweak?: (lower: number[], W: number, H: number) => void; good?: Record<string, unknown>; goodTweak?: (lower: number[], W: number, H: number) => void; what: string };
const wallN = (x0: number, y: number, n: number) => (lower: number[], W: number) => { for (let i = 0; i < n; i++) lower[y * W + x0 + i] = WATER; };
const TAMPERS: Tamper[] = [
  { id: "B1", title: "문 없음", want: "NO_DOOR", build: { ...base, door: { type: "none" } }, what: "door.type 을 none 으로" },
  { id: "B2", title: "너무 좁음(w=2)", want: "TOO_NARROW", build: { ...base, w: 2, door: undefined }, what: "폭 w 를 2 로 줄임" },
  { id: "B3", title: "지붕 없음", want: "ROOF_ORDER", build: { ...base, roof: undefined }, what: "roof 를 뺌" },
  { id: "B4", title: "지붕 자리에 1층 띠", want: "ROOF_ORDER", build: { ...base, roof: "gr.izakaya" }, what: "roof 에 gr.izakaya(1층 띠)를 넣음" },
  { id: "B5", title: "층 자리에 1줄 띠", want: "FLOOR_PAIR", build: { ...base, floors: [{ band: "terrace" }] }, what: "floorPlan 의 층 하나를 terrace(한 줄 띠)로" },
  { id: "B6", title: "모르는 1층 종류", want: "UNKNOWN_PART", build: { ...base, ground: "gr.nope" }, what: "ground 에 사전에 없는 id" },
  { id: "B7", title: "부착물이 창을 가림", want: "DECO_CLASH", build: { ...base, decos: [{ deco: "sign_h.aka", col: 1, floor: 0 }] }, what: "쌍창(pairs) 층 창 위에 가로 간판 sign_h.aka 를 얹음" },
  { id: "B8", title: "문 앞 접근칸이 물", want: "DOOR_BLOCKED", build: base, tweak: (lower, W) => { /* 접근칸 두 칸을 물로 */ lower[(1 + 11) * W + 2 + 2] = WATER; lower[(1 + 11) * W + 2 + 3] = WATER; }, what: "문 바로 아래 접근칸 두 칸의 1층을 물(막힘)로" },
  { id: "B9", title: "문 앞이 물웅덩이로 고립", want: "DOOR_BLOCKED", build: base, tweak: (lower, W, H) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lower[y * W + x] = WATER; lower[(1 + 11) * W + 2 + 2] = SW; lower[(1 + 11) * W + 2 + 3] = SW; }, what: "접근칸 두 칸만 보도로 남기고 둘레를 전부 물로(이어진 칸 6개 미만)" },
  { id: "B10", title: "L자 본채 문이 별채에 가려짐", want: "DOOR_BLOCKED", build: { w: 7, floors: 3, floorKind: "pairs", wall: "shiro", ground: "gr.shutter.sora", roof: "roof.ac.tank", door: { type: "steel", col: 3 }, wing: { w: 4, ground: "gr.glass.kii", roof: "roof.plain.plain", door: { type: "cafe", col: 1 }, side: "L", depth: 2 } }, what: "본채 문 열을 별채가 서는 열(3)로" },
  { id: "B11", title: "건물이 맵 밖으로", want: "OUT_OF_MAP", build: base, what: "건물 발을 맵 가장자리 밖으로(x=맵 폭-3)" },
];
const tamperOut: unknown[] = [];
for (const t of TAMPERS) {
  const args = exampleToToolArgs(t.build as Record<string, unknown>);
  const goodBuild = (t.good ?? (t.id === "B10" ? { ...(t.build as object), door: { type: "steel", col: 5 } } : base)) as Record<string, unknown>;
  const good = runBuilding(exampleToToolArgs(goodBuild), goodBuild);
  // 변조본
  let bad: ReturnType<typeof runBuilding>;
  if (t.id === "B11") {
    const pr = probe(t.build);
    const ctx = ctxFor(pr.rect);
    const fx = ctx.W - 3 - pr.dx0, fy = 1 - pr.dy0;
    const preMap11 = structuredClone(ctx.map);
    const snap0 = JSON.stringify([ctx.map.lowerTiles, ctx.map.upperTiles, ctx.map.upperOverlayTiles ?? null]);
    const res = call(ctx.p, "build_jp_city_building", { ...args, mapId: "m", x: fx, y: fy });
    const m2 = ctx.p.maps.m as GameMap;
    const unchanged0 = JSON.stringify([m2.lowerTiles, m2.upperTiles, m2.upperOverlayTiles ?? null]) === snap0;
    ctx.map = m2;
    bad = { res, ctx, rect: { x0: ctx.W - 3, y0: 1, w: pr.rect.w, h: pr.rect.h }, foot: { x: fx, y: fy }, walk: [], unchanged: unchanged0, preMap: preMap11 };
  } else bad = runBuilding(args, t.build, t.tweak);
  const raw = buildJpCityBuilding({ ...(t.build as object), x: bad.foot.x, y: bad.foot.y } as never, { world: { width: bad.ctx.W, height: bad.ctx.H, passable: (x, y) => isPassable(bad.ctx.p, bad.preMap, x, y) } });
  const errs = raw.issues.filter((i) => i.severity === "error");
  // 「지었다면」 그림: 조립기 계산 결과를 오류 맵 위에 겹친다(도구는 쓰지 않았다)
  const { map } = mkProject(bad.ctx.W, bad.ctx.H, SW);
  map.lowerTiles = [...bad.preMap.lowerTiles];
  for (const pl of raw.placements) { if (pl.x < 0 || pl.y < 0 || pl.x >= map.width || pl.y >= map.height) continue; const i = pl.y * map.width + pl.x; if (pl.lower !== undefined) map.lowerTiles[i] = pl.lower; if (pl.upper !== undefined) map.upperTiles[i] = pl.upper; if (pl.overlay !== undefined) { map.upperOverlayTiles ??= new Array(map.width * map.height).fill(-1); map.upperOverlayTiles[i] = pl.overlay; } }
  tamperOut.push({ id: t.id, title: t.title, what: t.what, want: t.want, toolOk: bad.res.ok, toolCode: bad.res.ok ? "" : (bad.res as { code: string }).code, toolMessage: bad.res.summary.slice(0, 260),
    mapUnchanged: bad.unchanged && !bad.res.ok,
    errors: errs.map((i) => ({ code: i.code, x: i.x, y: i.y })), good: { ok: good.res.ok, rect: good.rect, W: good.ctx.W, H: good.ctx.H, layers: good.res.ok ? layersOf(good.ctx.map) : null },
    bad: { W: bad.ctx.W, H: bad.ctx.H, rect: bad.rect, foot: bad.foot, layers: layersOf(map) } });
}
OUT.tampers = tamperOut;
OUT.issueCodes = JP_CITY_ISSUE_CODES;
// 조립 결과 손상(구조 검사) — 입력으로는 만들 수 없는 코드
{
  const okRes = buildJpCityBuilding({ ...base, x: 6, y: 14 } as never, { world: { width: 30, height: 20, passable: () => true } });
  const meta = jpCityBandMeta({ ...base, x: 6, y: 14 } as never)!;
  const clone = () => structuredClone(okRes.assembled!);
  const out: unknown[] = [];
  { const a = clone(); const fl = meta.find((m) => m.bid.startsWith("fl."))!; a.cells[fl.r0 + 1]![a.n - 1] = null; out.push({ what: "층 띠 아랫줄 오른쪽 끝 칸을 비움", got: checkJpCityStructure(a, meta).map((i) => `${i.code}@(${i.x},${i.y})`) }); }
  { const a = clone(); a.doors = [[2, 3]]; out.push({ what: "문 칸을 윗층(행 2)으로", got: checkJpCityStructure(a, meta).map((i) => `${i.code}@(${i.x},${i.y})`) }); }
  { const a = clone(); a.doors = []; out.push({ what: "문 칸 목록 비움", got: checkJpCityStructure(a, meta).map((i) => `${i.code}@(${i.x},${i.y})`) }); }
  OUT.structureTampers = out;
}


// =============================================================================================== 5. 도로·교차로 키트(실제 stamp_object)
const KITS = new Map((TS.structureKits ?? []).map((k) => [k.id, k]));
const kitOf = (id: string) => KITS.get(id) as unknown as { id: string; name: string; width: number; height: number; rows: { tiles: number[]; upperTiles: number[] }[] };
function stampKit(p: Project, id: string, x: number, y: number, layers?: string) {
  return call(p, "stamp_object", { objectId: `kit:jp_city/${id}`, mapId: "m", x, y, ...(layers ? { layers } : {}) });
}
type Comp = { name: string; W: number; H: number; under: number; placements: [string, number, number][] };
function compose(c: Comp, extra?: (p: Project, map: GameMap) => unknown) {
  const { p, map } = mkProject(c.W, c.H, c.under);
  const log = c.placements.map(([id, x, y]) => { const r = stampKit(p, id, x, y); return { kit: id, x, y, ok: r.ok, summary: r.summary, warnings: r.warnings }; });
  const ex = extra?.(p, map);
  return { name: c.name, W: c.W, H: c.H, under: c.under, placements: c.placements, log, layers: layersOf(map), extra: ex ?? null };
}
const roadComps: unknown[] = [];
roadComps.push(compose({ name: "lane-chain", W: 30, H: 32, under: SW, placements: [
  ["jp-road-lane-h", 0, 0], ["jp-road-lane-t-s", 6, 0], ["jp-road-lane-h", 18, 0], ["jp-road-lane-h", 24, 0],
  ["jp-road-lane-v", 10, 8], ["jp-road-lane-x", 6, 14], ["jp-road-lane-h", 0, 18], ["jp-road-lane-h", 18, 18], ["jp-road-lane-h", 24, 18], ["jp-road-lane-end-s", 10, 26]] }));
roadComps.push(compose({ name: "lane-bends", W: 28, H: 22, under: SW, placements: [
  ["jp-road-lane-end-w", 0, 2], ["jp-road-lane-bend-es", 6, 2], ["jp-road-lane-v", 10, 10], ["jp-road-lane-bend-ne", 10, 16], ["jp-road-lane-h", 18, 16], ["jp-road-lane-end-e", 24, 16]] }));
roadComps.push(compose({ name: "trunk-cross", W: 45, H: 29, under: SW, placements: [["jp-road-trunk-h", 0, 6], ["jp-road-trunk-x", 8, 0], ["jp-road-trunk-h", 37, 6]] }));
roadComps.push(compose({ name: "fumikiri", W: 8, H: 21, under: SW, placements: [["jp-road-lane-v", 2, 0], ["jp-fumikiri-v", 0, 6], ["jp-road-lane-v", 2, 15]] }));
roadComps.push(compose({ name: "fumikiri-closed", W: 9, H: 21, under: SW, placements: [["jp-road-lane-h", 0, 8], ["jp-fumikiri-h-closed", 6, 6]] }));
OUT.roadComps = roadComps;

// 이음 실험: 키트 둘레를 오토타일(jp-lane-road / jp-rail-track)로 이으면 키트 칸(복사본)이 이웃으로 세어지는가
{
  const exp: Record<string, unknown> = {};
  const laneAt = TS.autotileGroups!.find((g) => g.id === "jp-lane-road")!;
  { const { p, map } = mkProject(18, 4, SW); stampKit(p, "jp-road-lane-h", 0, 0);
    const r = call(p, "fill_region", { mapId: "m", material: "생활도로", rect: { x: 6, y: 0, w: 12, h: 4 } });
    exp.laneJoin = { fill: r.summary, layers: layersOf(map), kitTiles: [...new Set(kitOf("jp-road-lane-h").rows.flatMap((r) => r.tiles).filter((t) => t >= 0))], members: laneAt.memberTileIds.length,
      kitCellsAreMembers: kitOf("jp-road-lane-h").rows.flatMap((r) => r.tiles).filter((t) => t >= 0).filter((t) => laneAt.memberTileIds.includes(t)).length }; }
  { const { p, map } = mkProject(8 + 8, 9, SW); stampKit(p, "jp-fumikiri-v", 4, 0);
    const rt = TS.autotileGroups!.find((g) => g.id === "jp-rail-track")!;
    // 선로 한 줄(키트 안 y=?)을 찾는다: 키트 1층에 선로 칸이 있는 행
    const rows = kitOf("jp-fumikiri-v").rows; const railRow = rows.findIndex((r) => r.tiles.some((t) => rt.memberTileIds.includes(t) || t === 3559));
    exp.railJoin = { railRow, rowTiles: rows[railRow >= 0 ? railRow : 0]!.tiles, layers: layersOf(map) };
  }
  OUT.joinExp = exp;
}
// 도로 키트 오류: (1) 반복 사이에 한 칸 비움 → 도로 줄 끊김(road-gap) (2) 도로 표시 칸을 1층에 놓음(overlay-in-base-layer)
{
  const laneTiles = new Set<number>(); for (const id of KITS.keys()) if (id.startsWith("jp-road-lane-")) for (const r of kitOf(id).rows) for (const t of r.tiles) if (t >= 0) laneTiles.add(t);
  const gapCheck = (map: GameMap) => { const out: { code: string; x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) { let first = -1, last = -1; for (let x = 0; x < map.width; x++) if (laneTiles.has(map.lowerTiles[y * map.width + x]!)) { if (first < 0) first = x; last = x; }
      if (first >= 0) for (let x = first; x <= last; x++) if (!laneTiles.has(map.lowerTiles[y * map.width + x]!)) out.push({ code: "road-gap", x, y }); }
    return out; };
  const good = compose({ name: "gap-good", W: 18, H: 4, under: SW, placements: [["jp-road-lane-h", 0, 0], ["jp-road-lane-h", 6, 0], ["jp-road-lane-h", 12, 0]] }, (_p, map) => gapCheck(map));
  const bad = compose({ name: "gap-bad", W: 18, H: 4, under: SW, placements: [["jp-road-lane-h", 0, 0], ["jp-road-lane-h", 7, 0], ["jp-road-lane-h", 12, 0]] }, (_p, map) => gapCheck(map));
  const kit = "jp-road-mark-bike-stop";
  const mk2 = (bad: boolean) => compose({ name: `mark-${bad ? "layer1" : "default"}`, W: 8, H: 5, under: ROAD, placements: [] }, (p, map) => {
    const k = kitOf(kit);
    let stamp = "";
    if (!bad) stamp = stampKit(p, kit, 2, 1).summary;
    else {
      // 같은 칸 번호를 stamp_layer_block 으로 1층에 직접 놓는다(아래 땅 칸이 투명 칸으로 바뀐다)
      const rows = k.rows.map((rr) => rr.upperTiles.map((t, i) => (t >= 0 ? t : rr.tiles[i]!)));
      stamp = call(p, "stamp_layer_block", { mapId: "m", x: 2, y: 1, layers: { "1": rows }, reshape: false }).summary;
    }
    const errs: { code: string; x: number; y: number }[] = [];
    for (let i = 0; i < map.lowerTiles.length; i++) { const t = map.lowerTiles[i]!; if (t >= 0 && tileLayerPolicy(TS, t).home === "upper") errs.push({ code: "overlay-in-base-layer", x: i % map.width, y: Math.floor(i / map.width) }); }
    return { stamp, errors: errs, kitLayer: k.rows.some((rr) => rr.upperTiles.some((t) => t >= 0)) ? "3층(upperTiles)" : "1층(tiles)" };
  });
  const bk = kitOf(kit);
  OUT.roadErrors = { goodGap: good, badGap: bad, markLower: mk2(true), markDefault: mk2(false), markKit: { id: kit, w: bk.width, h: bk.height, rows: bk.rows } };
}

// =============================================================================================== 6. 상가 키트·문·소품
const reach = (p: Project, map: GameMap, a: { x: number; y: number }, limit = 6) => {
  if (!isPassable(p, map, a.x, a.y)) return 0;
  const seen = new Set<number>([a.y * map.width + a.x]); const q = [a];
  while (q.length && seen.size < limit) { const c = q.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const x = c.x + dx, y = c.y + dy; if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(y * map.width + x) || !isPassable(p, map, x, y)) continue; seen.add(y * map.width + x); q.push({ x, y }); } }
  return seen.size;
};
const recipes: unknown[] = [];
for (const k of KITS.values()) {
  if (!k.id.startsWith("jp-recipe-")) continue;
  const kk = k as unknown as { id: string; width: number; height: number; ai: { access?: { dx: number; dy: number }[] }; rows: { tiles: number[]; upperTiles: number[] }[] };
  const W = kk.width + 4, H = kk.height + 5;
  const { p, map } = mkProject(W, H, SW);
  for (let y = kk.height + 2; y < H; y++) for (let x = 0; x < W; x++) map.lowerTiles[y * W + x] = ROAD;
  const r = stampKit(p, k.id, 2, 1);
  const acc = (kk.ai.access ?? []).map((a) => ({ x: 2 + a.dx, y: 1 + a.dy }));
  const walk: string[] = [];
  for (let y = 0; y <= kk.height + 1; y++) { let s = ""; for (let x = 0; x < W; x++) s += isPassable(p, map, x, y) ? "." : "#"; walk.push(s); }
  recipes.push({ id: k.id, W, H, stamp: r.summary, access: acc.map((a) => ({ ...a, reach: reach(p, map, a) })), walk, layers: layersOf(map) });
}
OUT.recipes = recipes;
const propCodes: Record<string, string[]> = {};
for (const k of KITS.values()) {
  if (!k.id.startsWith("jp-prop-") && !k.id.startsWith("jp-recipe-") && !k.id.startsWith("jp-door-") && !k.id.startsWith("jp-road-") && !k.id.startsWith("jp-fumikiri") && !k.id.startsWith("jp-underpass") && !k.id.startsWith("jp-footbridge")) continue;
  const kk = kitOf(k.id);
  propCodes[k.id] = kk.rows.map((r) => r.upperTiles.map((t3, x) => {
    const t1 = r.tiles[x]!;
    if (t3 < 0 && t1 < 0) return "_";
    const pass = passabilityOf(TS, t1 >= 0 ? t1 : SW, -1, t3, -1).up;
    if (t3 >= 0) { const cls = mapUpperTileDepth(TS, t3, 10, 16); return !pass ? "X" : cls === MAP_UPPER_LAYER_DEPTH ? "*" : "."; }
    return pass ? "." : "X";
  }).join(""));
}
OUT.kitCodes = propCodes;

// 상가 오류: 문 앞 접근칸을 소품이 막음 / 뒤 건물이 앞 건물을 덮음 / 건물 칸을 1층에 놓음
{
  const mkMap = (W: number, H: number) => { const m = mkProject(W, H, SW); for (let y = H - 3; y < H; y++) for (let x = 0; x < W; x++) m.map.lowerTiles[y * W + x] = ROAD; return m; };
  const rk = kitOf("jp-recipe-konbini-block"); // 6×11, 접근칸 (2,11)(3,11)
  const blocked = (withProp: boolean) => {
    const { p, map } = mkMap(12, 17); stampKit(p, rk.id, 3, 1);
    const acc = [{ x: 3 + 2, y: 1 + 11 }, { x: 3 + 3, y: 1 + 11 }];
    let propRes = null as unknown;
    if (withProp) propRes = stampKit(p, "jp-prop-vend-pair", 4, 11); // 4×2 : 접근칸 위로 얹는다
    const reaches = acc.map((a) => ({ ...a, reach: reach(p, map, a) }));
    return { layers: layersOf(map), acc: reaches, propRes, errors: reaches.filter((a) => a.reach < 6).map((a) => ({ code: "door-access-blocked", x: a.x, y: a.y })) };
  };
  const ob = blocked(false), bb = blocked(true);
  // 뒤/앞 겹침: 앞(konbini-block 6×11, 발 y=15)·뒤(sushi-bar 5×8, 발 y=9) — x 겹침 있음
  const order = (backFirst: boolean) => {
    const { p, map } = mkMap(14, 19); const back = "jp-recipe-sushi-bar", front = "jp-recipe-konbini-block";
    const bk = kitOf(back), fk = kitOf(front);
    const bx = 3, by = 9 - bk.height + 1, fx = 4, fy = 16 - fk.height + 1;
    const seq: [string, number, number][] = backFirst ? [[back, bx, by], [front, fx, fy]] : [[front, fx, fy], [back, bx, by]];
    for (const [id, x, y] of seq) stampKit(p, id, x, y);
    const errs: { code: string; x: number; y: number }[] = [];
    for (let r = 0; r < fk.height; r++) for (let c = 0; c < fk.width; c++) { const t = fk.rows[r]!.upperTiles[c]!; if (t < 0) continue; const x = fx + c, y = fy + r; if (map.upperTiles[y * map.width + x] !== t) errs.push({ code: "back-over-front", x, y }); }
    return { layers: layersOf(map), errors: errs, backRect: { x: bx, y: by, w: bk.width, h: bk.height }, frontRect: { x: fx, y: fy, w: fk.width, h: fk.height } };
  };
  const og = order(true), ob2 = order(false);
  // 건물 칸을 1층에: stamp_layer_block layer "1" 로 건물 칸을 그대로 옮김
  const lowerBuilding = () => {
    const { p, map } = mkMap(12, 17); stampKit(p, rk.id, 3, 1);
    const good = layersOf(map);
    const { p: p2, map: map2 } = mkMap(12, 17);
    const rows = grid(good["3"], 12).map((r) => r.map((t) => (t >= 0 ? t : -1)));
    const r = call(p2, "stamp_layer_block", { mapId: "m", x: 0, y: 0, layers: { "1": rows }, reshape: false });
    const errs: { code: string; x: number; y: number }[] = [];
    for (let i = 0; i < map2.lowerTiles.length; i++) { const t = map2.lowerTiles[i]!; if (t >= 0 && tileLayerPolicy(TS, t).home === "upper") errs.push({ code: "building-in-lower-layer", x: i % map2.width, y: Math.floor(i / map2.width) }); }
    return { stamp: r.summary, layers: layersOf(map2), errors: errs, walkableBuildingCells: errs.filter((e) => isPassable(p2, map2, e.x, e.y)).length };
  };
  OUT.shopErrors = { okAccess: ob, blockedAccess: bb, orderGood: og, orderBad: ob2, lowerBuilding: lowerBuilding() };
}


// =============================================================================================== 7. 도로 키트 이음 오류(한 칸 어긋남) + 부품 보기 + 오토타일 도구 행렬
{
  const laneBase: [string, number, number][] = [
    ["jp-road-lane-h", 0, 0], ["jp-road-lane-t-s", 6, 0], ["jp-road-lane-h", 18, 0], ["jp-road-lane-h", 24, 0],
    ["jp-road-lane-v", 10, 8], ["jp-road-lane-x", 6, 14], ["jp-road-lane-h", 0, 18], ["jp-road-lane-h", 18, 18], ["jp-road-lane-h", 24, 18], ["jp-road-lane-end-s", 10, 26]];
  const shifted = laneBase.map((pl) => (pl[0] === "jp-road-lane-v" ? ([pl[0], pl[1] + 1, pl[2]] as [string, number, number]) : pl));
  (OUT.roadErrors as Record<string, unknown>).shiftBad = compose({ name: "lane-shift", W: 30, H: 32, under: SW, placements: shifted });
  (OUT.roadErrors as Record<string, unknown>).shiftNote = { moved: "jp-road-lane-v", from: [10, 8], to: [11, 8] };
}
{
  // 부품 보기: 띠 하나를 폭 6칸 건물에 끼워 조립기가 낸 칸을 그대로 자른다(문·부착물 없음; 1층 띠는 기본 문이 겹친다)
  const views: Record<string, unknown> = {};
  const baseIn = { w: 6, floors: [{ kind: "blank", wall: "kinari" }], roof: "roof.plain.plain", ground: "gr.konbini.0", door: { type: "auto", col: 0 } } as Record<string, unknown>;
  const view = (bid: string, kind: string, input: Record<string, unknown>) => {
    const r = buildJpCityBuilding({ ...input, x: 0, y: 40 } as never);
    const meta = jpCityBandMeta({ ...input, x: 0, y: 40 } as never);
    if (!r.assembled || !meta) return { ok: false, issues: r.issues.map((i) => i.code) };
    const m = meta.find((q) => q.bid === bid);
    if (!m) return { ok: false, issues: ["no-meta"] };
    return { ok: r.ok, kind, rows: m.rows, n: r.assembled.n, cells: r.assembled.cells.slice(m.r0, m.r0 + m.rows) };
  };
  for (const [bid, b] of Object.entries(SPEC.bands)) {
    let input: Record<string, unknown>;
    if (b.kind === "floor") input = { ...baseIn, floors: [{ band: bid, variants: [0] }] };
    else if (b.kind === "roof") input = { ...baseIn, roof: bid };
    else if (b.kind === "roofsign") input = { ...baseIn, head: bid, roof: undefined };
    else if (b.kind === "ground") input = { ...baseIn, ground: bid, door: undefined };
    else if (b.kind === "eave") input = { ...baseIn, eave: bid };
    else if (b.kind === "terrace") input = { ...baseIn, floors: [{ kind: "blank" }, { kind: "blank" }], setback: { upper: 1, ins: 1 } };
    else continue;
    views[bid] = view(bid, b.kind, input);
  }
  OUT.bandViews = views;
  const variants: Record<string, unknown> = {};
  for (const [kind, fk] of Object.entries(SPEC.floorKinds)) for (const v of fk.variants) {
    const bid = `fl.${kind}.kinari`;
    if (!(bid in SPEC.bands)) continue;
    variants[`${kind}/${v}`] = view(bid, "floor", { ...baseIn, floors: [{ kind, wall: "kinari", variants: [v] }] });
  }
  OUT.variantViews = variants;
  // 예제 띠 메타(해부도용)
  const metas: Record<string, unknown> = {};
  for (const [name, ex] of Object.entries(SPEC.examples)) metas[name] = jpCityBandMeta({ ...(ex.input as object), x: 0, y: 40 } as never);
  OUT.exampleMeta = metas;
}
{
  const matrix: unknown[] = [];
  const dmap = new Map(AT_DEMOS.map((d) => [d.id, d]));
  for (const g of TS.autotileGroups!) {
    const d = dmap.get(g.id)!; const nbr = g.neighborhood ?? 4; const body = g.variantMap[String(nbr === 8 ? 255 : 15)]!;
    const row: Record<string, unknown> = { id: g.id, name: g.name, nbr, body };
    const mk = () => { const m = mkProject(12, 8, d.outside); if (d.layer !== 1) for (let i = 0; i < m.map.lowerTiles.length; i++) m.map.lowerTiles[i] = d.under; return m; };
    { const { p, map } = mkProject(12, 8, d.layer === 1 ? d.outside : d.under); const r = call(p, "fill_region", { mapId: "m", material: g.name, rect: { x: 2, y: 2, w: 8, h: 4 } });
      const L = layersOf(map); row.fill = { ok: r.ok, code: r.ok ? "" : (r as { code: string }).code, msg: r.summary.slice(0, 120), l1: new Set(L["1"]).size, l2: L["2"].filter((t) => t >= 0).length, l3: L["3"].filter((t) => t >= 0).length, stale: atIssues(map, g, d.layer).length }; }
    if (d.layer !== 1) { const { p, map } = mk(); const r = call(p, "fill_region", { mapId: "m", material: g.name, layer: String(d.layer), rect: { x: 2, y: 2, w: 8, h: 4 } });
      const L = layersOf(map); row.fillL = { ok: r.ok, msg: r.summary.slice(0, 120), count: [L["1"], L["2"], L["3"]].map((a) => a.filter((t) => g.memberTileIds.includes(t)).length), stale: atIssues(map, g, d.layer).length }; }
    { const { p, map } = mk(); const r = call(p, "lay_path", { mapId: "m", material: g.name, points: [{ x: 1, y: 2 }, { x: 10, y: 2 }] });
      row.path = { ok: r.ok, code: r.ok ? "" : (r as { code: string }).code }; void map; }
    const paint: Record<string, unknown> = {};
    for (const layer of ["1", "2", "3"]) {
      const { p, map } = mk(); const r = call(p, "paint_tiles", { mapId: "m", layer, mode: "line", tile: body, from: { x: 1, y: 3 }, to: { x: 9, y: 3 } });
      const L = layersOf(map); const landed = L["3"].some((t) => t === body) ? 3 : L["2"].some((t) => t === body || g.memberTileIds.includes(t)) ? 2 : L["1"].some((t) => g.memberTileIds.includes(t)) ? 1 : 0;
      paint[layer] = { ok: r.ok, landed, stale: atIssues(map, g, d.layer).length, warn: (r.warnings ?? []).length };
    }
    { const { p, map } = mk(); const rows = d.pattern.map((r) => [...r].map((ch) => (ch === "#" ? body : -1)));
      const r = call(p, "stamp_layer_block", { mapId: "m", x: 0, y: 0, layers: { [String(d.layer)]: rows } });
      row.stampDefault = { ok: r.ok, stale: atIssues(map, g, d.layer).length }; }
    row.paint = paint; row.homeLayer = d.layer;
    matrix.push(row);
  }
  OUT.atMatrix = matrix;
}

fs.writeFileSync(path.join(HERE, "engine-results.json"), JSON.stringify(OUT));
console.log(JSON.stringify({ audit: { checked: (OUT.layerAudit as { checked: number }).checked, mismatches: (OUT.layerAudit as { mismatches: number }).mismatches }, autotiles: autotiles.length, buildings: buildings.length, tampers: tamperOut.length }));
