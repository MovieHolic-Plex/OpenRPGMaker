// jp_city 거리 측정(모델 없음) — 지도와 타일셋만 본다: 건물 수·건물 그림 종류·가장 많이 되풀이된 그림, 소품 수·종류, 도로 몫, 죽은 띠 몫, 빈 20×15 창, 차, 닿지 않는 문.
//   import { measureJpStreet } from "./jpStreetMeasure.mts"
// 키트는 층 2~4 의 칸 무늬로 찾는다(큰 키트부터, 한 번 센 칸은 다시 세지 않는다). 조립 건물(build_jp_city_building)은 건물 이름표(jp-building)로 센다.
// 「같은 건물」= 같은 그림: 키트 건물은 키트 id(셔터 변형 -shut 은 같은 가게), 조립 건물은 1층 정면 종류(이름표의 종류 — 喫茶 가 셋이면 3).
import { inMainWalkComponent, mainWalkComponent } from "../../src/project/walkComponent.ts";
import type { GameMap, Project } from "../../src/project/types.ts";

const BUILT_KIT = /^jp-(bldg-(?!f-kaki-)|bx|recipe|house|shop-(?!cover)|apt|mansion|office|tower|school$|station|temple|shrine-hall|gas-office|izakaya-brick|fg-|inaka-(kominka|kawara-farm|kura|dagashiya|wooden-station)|prop-(nakamise|honden|pagoda|kaminarimon|hozomon|led-tower|theatre))/;
const PART_KIT = /^jp-(sf|roof|door|wire|in|arcade-roof|recipe-part)-/;
const INFRA_KIT = /^jp-(bldg-f-kaki-|river|water-(?!tank)|bank|bridge|mark|crosswalk|road-(lane|trunk|mark)|foot-shadow|wall-drain|rail|via|tram|subway|platform|gnd-|pave|school-(ground|gomu|track)|lot-bay|tone-|ground-)/;
const CAR_KIT = /^jp-(st-car-|prop-(car|van|bus|ad-truck)|inaka-(keitora|red-tractor)|car-|kei-|taxi|truck)/;
const EDGE_AUTOTILES = ["jp-wall-block", "jp-hedge", "jp-fence-mesh", "jp-guardrail"];
const ROAD_AUTOTILES = ["jp-lane-road", "jp-rail-track"];
const ROAD_GROUPS = ["jp:street:road", "jp:street:lane", "jp:street:crosswalk", "jp:street:rail", "jp:shita-asphalt", "jp:street:lot", "jp:fable-street:gnd-tarmac"];
const WATER_AUTOTILES = ["jp-water-canal", "jp-water-pond"];

export interface JpStreetMeasure {
  readonly buildings: number; readonly distinctLooks: number; readonly maxRepeat: number; readonly maxRepeatLook: string; readonly repeats: Record<string, number>;
  /** 같은 그림 두 채 사이 가장 가까운 거리(칸, 체비셰프) — 되풀이가 없으면 -1 */
  readonly nearestRepeat: number;
  readonly props: number; readonly distinctProps: number; readonly propKits: Record<string, number>;
  readonly roadShare: number; readonly deadBandShare: number; readonly emptyWindows: number; /** 건물도 기물도 없는 8×6 창의 몫(0~1) — 빈 포장이 넓게 드러난 곳 */ readonly emptySmallWindows: number; readonly cars: number;
  readonly doors: number; readonly unreachableDoors: number;
  /** 이웃한 두 건물(같은 발 줄)의 키가 같은 비율 — 줄의 윗선이 들쭉날쭉한가 */
  readonly sameHeightNeighbours: number;
}

type Kit = { id: string; width: number; height: number; rows: { tiles?: number[]; upperTiles?: number[] }[] };
type Ts = { autotileGroups?: { id: string; memberTileIds?: number[] }[]; tileGroups?: { id: string; tileIds?: number[] }[]; structureKits?: Kit[] };

interface Index { lane: Set<number>; byAnchor: Map<number, { kit: Kit; ax: number; ay: number; cells: number }[]>; edge: Set<number>; road: Set<number>; water: Set<number>; band: Set<number>; infra: Set<number> }
const cache = new WeakMap<object, Index>();
function indexOf(ts: Ts): Index {
  const hit = cache.get(ts);
  if (hit) return hit;
  const byAnchor: Index["byAnchor"] = new Map();
  const infra = new Set<number>();
  // 새 거리 조각(fable_street): 바닥 덧그림·테·노면 표시·그늘·둑은 기반 시설, 경계 줄은 담(소품으로 세지 않는다) — 블록의 칸 그룹으로 가른다.
  const groupTiles = (ids: readonly string[]) => new Set((ts.tileGroups ?? []).filter((g) => ids.includes(g.id)).flatMap((g) => g.tileIds ?? []));
  const stInfra = groupTiles(["jp:fable-street:border", "jp:fable-street:mark", "jp:fable-street:floor", "jp:fable-street:shade", "jp:fable-street:bank"]), stRun = groupTiles(["jp:fable-street:run"]);
  for (const t of stInfra) infra.add(t);
  for (const kit of [...(ts.structureKits ?? [])].sort((a, b) => b.width * b.height - a.width * a.height)) {
    if (PART_KIT.test(kit.id)) continue;
    if (kit.id.startsWith("jp-st-") && kit.rows.every((r) => (r.upperTiles ?? []).every((t) => t < 0 || stInfra.has(t) || stRun.has(t)))) continue;
    if (INFRA_KIT.test(kit.id)) { for (const r of kit.rows) for (const t of [...(r.tiles ?? []), ...(r.upperTiles ?? [])]) if (t >= 0) infra.add(t); continue; }
    let cells = 0, anchor: [number, number, number] | undefined;
    kit.rows.forEach((r, y) => (r.upperTiles ?? []).forEach((t, x) => { if (t >= 0) { cells++; anchor ??= [t, x, y]; } }));
    if (!anchor) continue;
    byAnchor.set(anchor[0], [...(byAnchor.get(anchor[0]) ?? []), { kit, ax: anchor[1], ay: anchor[2], cells }]);
  }
  const set = (ids: readonly string[], groups: readonly string[]) => {
    const s = new Set<number>();
    for (const a of ts.autotileGroups ?? []) if (ids.includes(a.id)) for (const t of a.memberTileIds ?? []) s.add(t);
    for (const g of ts.tileGroups ?? []) if (groups.includes(g.id)) for (const t of g.tileIds ?? []) s.add(t);
    return s;
  };
  const band = new Set<number>();
  for (const g of ts.tileGroups ?? []) if (g.id.startsWith("jp:band:") || g.id.startsWith("jp:deco:")) for (const t of g.tileIds ?? []) band.add(t);
  const out: Index = { lane: groupTiles(["jp:fable-street:gnd-lane", "jp:fable-street:gnd-laneside"]), byAnchor, edge: new Set([...set(EDGE_AUTOTILES, []), ...stRun]), road: set(ROAD_AUTOTILES, ROAD_GROUPS), water: set(WATER_AUTOTILES, ["jp:street:water", "jp:fable-street:gnd-water"]), band, infra };
  cache.set(ts, out);
  return out;
}

export function measureJpStreet(project: Project, map: GameMap): JpStreetMeasure {
  const ts = (project.tilesets as unknown as Record<string, Ts>)[map.tilesetId]!;
  const ix = indexOf(ts);
  const W = map.width, H = map.height, N = W * H;
  const layers: (readonly number[] | undefined)[] = [map.upperTiles, map.upperOverlayTiles, map.lowerOverlayTiles];
  const used = layers.map(() => new Uint8Array(N));
  const found: { id: string; x: number; y: number; w: number; h: number }[] = [];
  // 큰 키트부터: 닻 칸이 맞으면 나머지 칸을 대조한다(이웃 건물·소품에 가려진 칸을 감안해 8할 이상 맞으면 그 키트다).
  const anchors = [...ix.byAnchor.values()].flat().sort((a, b) => b.cells - a.cells);
  const byTile = new Map<number, typeof anchors>();
  for (const a of anchors) byTile.set(a.kit.rows[a.ay]!.upperTiles![a.ax]!, [...(byTile.get(a.kit.rows[a.ay]!.upperTiles![a.ax]!) ?? []), a]);
  const tryAt = (li: number, i: number, a: (typeof anchors)[number]): boolean => {
    const layer = layers[li]!, x0 = (i % W) - a.ax, y0 = Math.floor(i / W) - a.ay;
    let ok = 0;
    const hits: number[] = [];
    for (let y = 0; y < a.kit.height; y++) for (let x = 0; x < a.kit.width; x++) {
      const t = a.kit.rows[y]?.upperTiles?.[x] ?? -1;
      if (t < 0) continue;
      const xx = x0 + x, yy = y0 + y;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const k = yy * W + xx;
      if (layer[k] === t && !used[li]![k]) { ok++; hits.push(k); }
    }
    if (ok < Math.max(1, Math.ceil(a.cells * 0.8))) return false;
    for (const k of hits) used[li]![k] = 1;
    found.push({ id: a.kit.id, x: x0, y: y0, w: a.kit.width, h: a.kit.height });
    return true;
  };
  {
    // 큰 것 먼저가 되게 키트 순서로 돈다(칸 순서로 돌면 작은 키트가 큰 키트의 칸을 먼저 먹는다)
    const want = new Map<number, number[][]>();
    layers.forEach((layer, li) => { if (layer) for (let i = 0; i < N; i++) { const t = layer[i] ?? -1; if (t >= 0 && byTile.has(t)) { const l = want.get(t) ?? []; (l[li] ??= []).push(i); want.set(t, l); } } });
    for (const a of anchors) {
      const t = a.kit.rows[a.ay]!.upperTiles![a.ax]!;
      const where = want.get(t);
      if (!where) continue;
      where.forEach((cells, li) => { for (const i of cells ?? []) if (!used[li]![i]) tryAt(li, i, a); });
    }
  }
  // 건물: 이름표(조립 건물·키트 건물) + 이름표 없는 건물 키트(랜드마크·변형 키트 줄)
  const looks: { look: string; x: number; y: number; w: number; h: number; foot: number }[] = [];
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const kitBuildings = found.filter((f) => BUILT_KIT.test(f.id));
  const lookOf = (id: string) => id.replace(/-shut$/, "").replace(/^jp-prop-nakamise-back-\d$/, "jp-prop-nakamise-back");
  for (const f of kitBuildings) looks.push({ look: lookOf(f.id), x: f.x, y: f.y, w: f.w, h: f.h, foot: f.y + f.h - 1 });
  let doors = 0, unreachable = 0;
  const walk = mainWalkComponent(project, map);
  for (const loc of map.locations ?? []) {
    if (!(loc.tags ?? []).includes("jp-building")) continue;
    const rect = { x: loc.x, y: loc.y, w: loc.w ?? 1, h: loc.h ?? 1 };
    const m = /문 앞 접근칸 \((\d+),(\d+)\)/u.exec(loc.note ?? "");
    if (m) { doors++; if (!inMainWalkComponent(walk, map, { x: Number(m[1]), y: Number(m[2]) })) unreachable++; }
    if (kitBuildings.some((k) => overlap(k, rect) * 2 >= rect.w * rect.h)) continue;
    const role = (loc.tags ?? []).find((t) => t !== "jp-building" && t !== "composed-layout") ?? "?";
    looks.push({ look: `조립:${role}`, ...rect, foot: rect.y + rect.h - 1 });
  }
  const repeats: Record<string, number> = {};
  for (const l of looks) repeats[l.look] = (repeats[l.look] ?? 0) + 1;
  const top = Object.entries(repeats).sort((a, b) => b[1] - a[1])[0];
  let nearest = -1;
  for (let i = 0; i < looks.length; i++) for (let j = i + 1; j < looks.length; j++) if (looks[i]!.look === looks[j]!.look) {
    const a = looks[i]!, b = looks[j]!;
    const d = Math.max(Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)), Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)));
    nearest = nearest < 0 ? d : Math.min(nearest, d);
  }
  let pairs = 0, same = 0;
  const rowsByFoot = new Map<number, typeof looks>();
  for (const l of looks) rowsByFoot.set(l.foot, [...(rowsByFoot.get(l.foot) ?? []), l]);
  for (const row of rowsByFoot.values()) { row.sort((a, b) => a.x - b.x); for (let i = 1; i < row.length; i++) if (row[i]!.x - (row[i - 1]!.x + row[i - 1]!.w) <= 3) { pairs++; if (row[i]!.h === row[i - 1]!.h) same++; } }
  // 소품
  const propKits: Record<string, number> = {};
  let props = 0, cars = 0;
  for (const f of found) {
    if (BUILT_KIT.test(f.id)) continue;
    props++; propKits[f.id] = (propKits[f.id] ?? 0) + 1;
    if (CAR_KIT.test(f.id)) cars++;
  }
  // 칸 분류: 3 무언가(건물·소품·담) · 2 차도 · 1 물 · 0 맨 바닥(보도·광장·자갈·잔디·석축)
  const kind = new Uint8Array(N);
  const thing = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const ups = layers.map((l) => l?.[i] ?? -1).filter((t) => t >= 0);
    const low = map.lowerTiles[i] ?? -1;
    if (ups.some((t) => !ix.infra.has(t))) { kind[i] = 3; if (ups.some((t) => !ix.infra.has(t) && !ix.edge.has(t))) thing[i] = 1; }
    else if (ix.road.has(low)) kind[i] = 2;
    else if (ix.water.has(low)) kind[i] = 1;
  }
  // 도로 몫: 폭 두 칸이 넘는 아스팔트 차도만 센다(차가 다니는 길 — 한 칸 폭 자투리와 보도 없는 생활도로 포장은 차도 몫이 아니다. 조율자 2026-11-15).
  const wide = (x: number, y: number): boolean => {
    let h = 1, v = 1;
    for (let k = x - 1; k >= 0 && ix.road.has(map.lowerTiles[y * W + k] ?? -1); k--) h++;
    for (let k = x + 1; k < W && ix.road.has(map.lowerTiles[y * W + k] ?? -1); k++) h++;
    for (let k = y - 1; k >= 0 && ix.road.has(map.lowerTiles[k * W + x] ?? -1); k--) v++;
    for (let k = y + 1; k < H && ix.road.has(map.lowerTiles[k * W + x] ?? -1); k++) v++;
    return Math.min(h, v) >= 2;
  };
  let road = 0, dead = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (kind[i] === 2) { if (wide(x, y)) road++; continue; }
    if (ix.lane.has(map.lowerTiles[i] ?? -1)) continue;                 // 생활도로 포장·길가 띠는 길이다 — 차도 몫에도 죽은 띠에도 세지 않는다
    if (kind[i] === 3 || kind[i] === 1) continue;                    // 물은 죽은 띠가 아니다(석축·둑·빈 포장·빈 대지만 센다)
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && kind[yy * W + xx] === 3) { near = true; break; }
    }
    if (!near) dead++;
  }
  // 건물도 소품도 없는 20×15 창(한 칸씩 밀며 센다)
  const sum = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sum[(y + 1) * (W + 1) + x + 1] = thing[y * W + x]! + sum[y * (W + 1) + x + 1]! + sum[(y + 1) * (W + 1) + x]! - sum[y * (W + 1) + x]!;
  let emptyWindows = 0;
  const WW = Math.min(20, W), WH = Math.min(15, H);
  for (let y = 0; y + WH <= H; y++) for (let x = 0; x + WW <= W; x++) {
    const n = sum[(y + WH) * (W + 1) + x + WW]! - sum[y * (W + 1) + x + WW]! - sum[(y + WH) * (W + 1) + x]! + sum[y * (W + 1) + x]!;
    if (n === 0) emptyWindows++;
  }
  let small = 0, smallAll = 0;
  for (let y = 0; y + 6 <= H; y++) for (let x = 0; x + 8 <= W; x++) {
    smallAll++;
    if (sum[(y + 6) * (W + 1) + x + 8]! - sum[y * (W + 1) + x + 8]! - sum[(y + 6) * (W + 1) + x]! + sum[y * (W + 1) + x]! === 0) small++;
  }
  return {
    emptySmallWindows: smallAll ? small / smallAll : 0,
    buildings: looks.length, distinctLooks: Object.keys(repeats).length, maxRepeat: top?.[1] ?? 0, maxRepeatLook: top?.[0] ?? "", repeats, nearestRepeat: nearest,
    props, distinctProps: Object.keys(propKits).length, propKits, roadShare: road / N, deadBandShare: dead / N, emptyWindows, cars, doors, unreachableDoors: unreachable,
    sameHeightNeighbours: pairs ? same / pairs : 0,
  };
}
