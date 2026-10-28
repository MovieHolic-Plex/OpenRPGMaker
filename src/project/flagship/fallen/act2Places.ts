/**
 * 『폴른 스타』 2막 B5 재의 들판·새벽샘 터 — 칸 평면도(plan 문자열)로 버들항 칩셋에 직접 그린다.
 *
 * 왜 평면도인가(2026-10-29): 계획 그림(fs-act2-plan.html)의 참고 지도 「화산 지대 필드」·「폐허 마을」은 버들항 웨이브 2 장소
 * (volcano-field·ruined-village)였는데, 그 그림은 생성 스크립트로만 남아 있고(고아 커밋 0bfba316bc) 공용 칩셋에 구워진 적이 없다.
 * 새 도트를 굽지 않고 그 결(잿빛 땅·마른 고목·뼈 무더기·검푸른 바위 능선, 무너진 예배당·빈 집)을 이미 있는 조각으로 다시 짠다.
 *
 * 평면도 글자: `#` 바위 능선(윗면 오토타일 + 남쪽 앞면 2단 — 던전 gap 바위와 같은 규칙), `.` 잿빛 땅, `:` 밝은 잿길,
 * `f`·`W` 무너진 예배당 바닥(돌). 물건은 PlaceProp(키트 왼쪽 위 칸), 불탄 집은 BurntHouse(지붕 반쪽이 내려앉은 집).
 */
import { autotileVariantForMask, cellHash } from "@/project/defaults/autotileEngine";
import type { AutotileGroup, GameMap, Project, StructureKitDef } from "@/project/types";

export type PlaceProp = readonly [kitId: string, x: number, y: number];
/** 지붕이 한쪽(l·r)으로 내려앉은 집 — 집 키트를 찍고 그쪽 지붕 칸을 걷어 숯·서까래를 남긴다. c = 통째로 타 무너진 집(밑동 통나무 몇 칸 + 잔해). */
export type BurntHouse = readonly [kitId: string, x: number, y: number, side: "l" | "r" | "c"];

const h32 = (x: number, y: number, s: number): number => {
  let k = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0;
  k ^= k >>> 16; k = Math.imul(k, 0x85ebca6b) >>> 0; k ^= k >>> 13; k = Math.imul(k, 0xc2b2ae35) >>> 0; k ^= k >>> 16;
  return k >>> 0;
};

export type RockLine = "A" | "B" | "C" | "ice";
type Kit = StructureKitDef & { rows: { tiles: number[]; upperTiles?: number[] }[] };

export interface PlaceSpec {
  readonly plan: readonly string[];
  readonly props: readonly PlaceProp[];
  readonly burnt?: readonly BurntHouse[];
  /** 바위 줄 A(흙굴)·B(산 바위)·C(검푸른)·ice(서리 윗면) */
  readonly rockLine: RockLine;
  readonly seed: number;
}

/** 평면도대로 맵 전체를 다시 칠한다(크기는 평면도와 같아야 한다). 이벤트는 건드리지 않는다. */
export function paintPlace(project: Project, map: GameMap, spec: PlaceSpec): void {
  const H = spec.plan.length, W = spec.plan[0]!.length;
  if (map.width !== W || map.height !== H) throw new Error(`[fallen-star places] ${map.id} 크기 ${map.width}×${map.height} ≠ 평면도 ${W}×${H}`);
  const ts = project.tilesets[map.tilesetId];
  if (!ts) throw new Error(`[fallen-star places] ${map.id} 타일셋 없음`);
  const kits = new Map((ts.structureKits ?? []).map((k) => [k.id, k as Kit]));
  const kit = (id: string): Kit => {
    const k = kits.get(id);
    if (!k) throw new Error(`[fallen-star places] 키트 ${id} 가 없다`);
    return k;
  };
  const flat = (id: string): number[] => kit(id).rows.flatMap((r) => r.tiles).filter((t) => t >= 0);
  // 광재 땅 3×3 의 (2,0) 칸은 주황 줄이 그려져 있어 흩뿌리면 줄무늬 격자로 읽힌다 — 뺀다.
  const ash = flat("bd-pick-mining-valley-ground-slagg").filter((_, i) => i !== 2);
  const path = kit("bd-pick-mining-valley-ground-yard");
  const stone = kit("bd-pick-temple-ruins-floor-ruin");
  const N = W * H;
  const lower = new Array<number>(N).fill(-1), upper = new Array<number>(N).fill(-1);
  const at = (x: number, y: number) => spec.plan[y]?.[x] ?? "#";
  const pathTile = (x: number, y: number) => path.rows[y % path.rows.length]!.tiles[x % path.rows[0]!.tiles.length]!;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = at(x, y), i = y * W + x;
    if (c === ":") lower[i] = pathTile(x, y);
    else if (c === "f" || c === "W") lower[i] = stone.rows[y % stone.rows.length]!.tiles[x % stone.rows[0]!.tiles.length]!;
    else {
      // 잿길 가장자리는 땅과 섞여 해진다(곧은 띠로 보이지 않게).
      const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx!, y + dy!) === ":");
      lower[i] = c === "." && nearPath && h32(x, y, spec.seed + 9) % 100 < 35 ? pathTile(x, y) : ash[h32(x, y, spec.seed + 3) % ash.length]!;
    }
  }
  const planRock = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || spec.plan[y]![x] === "#";
  paintRock(ts.autotileGroups ?? [], kits, spec.rockLine, planRock, W, H, lower);
  const stamp = (id: string, x: number, y: number, skip?: (dx: number, dy: number) => boolean): void => {
    const k = kit(id);
    k.rows.forEach((row, dy) => {
      row.tiles.forEach((t, dx) => { if (t >= 0 && x + dx < W && y + dy < H && !skip?.(dx, dy)) lower[(y + dy) * W + x + dx] = t; });
      (row.upperTiles ?? []).forEach((t, dx) => { if (t >= 0 && x + dx < W && y + dy < H && !skip?.(dx, dy)) upper[(y + dy) * W + x + dx] = t; });
    });
  };
  for (const [kitId, x, y, side] of spec.burnt ?? []) {
    const k = kit(kitId);
    if (side === "c") {
      // 통째로 무너진 집 — 맨 아랫줄 벽(밑동 통나무)만 띄엄띄엄 남기고, 그 위에 숯더미·쓰러진 기둥·돌무더기.
      stamp(kitId, x, y, (dx, dy) => dy < k.height - 1 || h32(x + dx, y + dy, spec.seed + 13) % 100 < 45);
      const debris: [string, number, number][] = [["bd-pick-dungeon-theme-rubble-heap", 0, k.height - 3], ["bd-pick-volcano-cave-coal-pile", 2, k.height - 2],
        ["bd-pick-volcano-cave-pillar-fallen", Math.max(0, k.width - 3), k.height - 3], ["bd-pick-volcano-cave-ember-a", Math.max(1, k.width - 2), k.height - 2]];
      for (const [id, dx, dy] of debris) if (x + dx < W && y + dy < H) stamp(id, x + dx, y + dy);
      continue;
    }
    const roofRows = k.height - 2;
    // 지붕 한쪽이 무너져 내렸다 — 계단꼴 경계로 그쪽 지붕 칸을 걷는다(맨 윗줄 용마루는 남긴다).
    const hole = (dx: number, dy: number): boolean => dy >= 1 && dy < roofRows
      && (side === "r" ? dx >= Math.floor(k.width / 2) - 1 + (dy % 2) : dx <= Math.floor(k.width / 2) - (dy % 2))
      && h32(x + dx, y + dy, spec.seed + 5) % 100 < 80;
    stamp(kitId, x, y, hole);
    // 걷힌 자리 바로 위 칸에 숯·서까래 — 빈 땅이 아니라 타 버린 속으로 읽히게.
    const holes: { x: number; y: number }[] = [];
    for (let dy = 1; dy < roofRows; dy += 1) for (let dx = 0; dx < k.width; dx += 1) {
      const lowT = k.rows[dy]!.upperTiles?.[dx] ?? -1;
      if (lowT >= 0 && hole(dx, dy)) holes.push({ x: x + dx, y: y + dy });
    }
    const debris = ["bd-pick-volcano-cave-coal-pile", "bd-pick-volcano-cave-pillar-fallen", "bd-pick-volcano-cave-ember-a"];
    let n = 0;
    for (const c of holes.sort((a, b) => b.y - a.y || a.x - b.x)) {
      if (n >= debris.length) break;
      const d = kit(debris[n]!);
      const fits = d.rows.every((r, dy) => (r.upperTiles ?? []).every((t, dx) => t < 0 || holes.some((hc) => hc.x === c.x + dx && hc.y === c.y + dy)));
      if (!fits) continue;
      stamp(debris[n]!, c.x, c.y);
      n += 1;
    }
  }
  for (const [kitId, x, y] of spec.props) stamp(kitId, x, y);
  map.lowerTiles = lower;
  map.upperTiles = upper;
  map.lowerOverlayTiles = new Array<number>(N).fill(-1);
  map.upperOverlayTiles = new Array<number>(N).fill(-1);
  map.shadowBits = new Array<number>(N).fill(0);
  delete map.relief;
  delete map.doodadGroups;
  delete map.terrainDesign;
  delete map.lowerTileStacks;
  delete map.upperTileStacks;
}

/** 바위 능선 — 던전 gap 바위(compose.ts)와 같은 규칙: 열린 칸 바로 북쪽 두 줄이 앞면, 나머지는 윗면 오토타일. */
function paintRock(groups: readonly AutotileGroup[], kits: Map<string, Kit>, line: RockLine, isRock: (x: number, y: number) => boolean, W: number, H: number, lower: number[]): void {
  // 얼음 바위(서리 윗면)는 이름 꼴이 다르다 — beodeul_dungeon_ice_rock · bd-dg-ice-rock-face.
  const g = groups.find((a) => a.id === (line === "ice" ? "beodeul_dungeon_ice_rock" : `beodeul_dungeon_rock_${line}`));
  const stem = line === "ice" ? "bd-dg-ice-rock" : `bd-dg-rock-${line}`;
  const face = kits.get(`${stem}-face`), single = kits.get(`${stem}-face-single`);
  if (!g || !face || !single) throw new Error(`[fallen-star places] 바위 줄 ${line} 조각이 없다`);
  const wallB = new Int8Array(W * H).fill(-1);
  for (let y = 1; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (isRock(x, y) || !isRock(x, y - 1)) continue;
    let run = 0;
    while (y - 1 - run >= 0 && isRock(x, y - 1 - run) && run < 3) run += 1;
    if (run < 3) continue;   // 위에 윗면 한 줄이 남지 않는 얇은 능선은 앞면 없이 윗면 테두리만
    for (let b = 0; b < 2; b += 1) wallB[(y - 1 - b) * W + x] = b;
  }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const b = wallB[y * W + x]!;
    if (b < 0) continue;
    const left = x > 0 && wallB[y * W + x - 1] === b, right = x + 1 < W && wallB[y * W + x + 1] === b;
    const rr = face.rows[1 - b]!.tiles;
    lower[y * W + x] = !left && !right ? single.rows[1 - b]!.tiles[0]! : left && right ? rr[1]! : right ? rr[0]! : rr[2]!;
  }
  const open = (x: number, y: number) => !isRock(x, y) || (x >= 0 && y >= 0 && x < W && y < H && wallB[y * W + x]! >= 0);
  const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (open(x, y)) continue;
    let m = 0;
    for (const [dx, dy, bit] of bits) if (!open(x + dx, y + dy)) m |= bit;
    if (!(m & 1) && !(m & 4) && y + 1 < H && wallB[(y + 1) * W + x]! >= 0) m |= 4 | 32 | 64;
    const iv = g.interiorVariants?.[0];
    let t: number | undefined;
    if (g.phaseVariants) t = autotileVariantForMask(g, m, x, y);
    if (t === undefined) t = m === 255 && iv?.length ? iv[cellHash(x, y) % iv.length] : (g.variantMap[String(m)] ?? g.variantMap["255"]);
    lower[y * W + x] = t!;
  }
}

export const ASH_FIELD_PLAN: readonly string[] = [
  "##############:::###############",
  "##############:::###############",
  "##############:::###############",
  "#########.....:::....###########",
  "#######.......:::......#########",
  "######........:::........#######",
  "#####.........:::..........#####",
  "#####........:::.............###",
  "####.........:::.....###.....###",
  "####........:::.....#####.....##",
  "###.........:::.....####......##",
  "###....##...:::......##.......##",
  "###...####..:::..............###",
  "####..###...:::.............####",
  "#####......::::...........######",
  "######....:::::.........########",
  "#######...:::.....##############",
  "########..:::....###############",
  "#########.:::...################",
  "#########.:::....###############",
  "########..:::.....##############",
  "######....:::.......############",
  "####......:::..........#########",
  "###.......::::..........########",
  "###........::::...........######",
  "###.........::::...........#####",
  "##...........::::...........####",
  "##............::::..........####",
  "##.....##......::::.........####",
  "###...####......:::.........####",
  "###....##.......:::........#####",
  "####............:::.......######",
  "#####...........:::......#######",
  "########.........:::...#########",
  "###########......:::..##########",
  "#############....:::.###########",
  "##############...:::############",
  "#################::::###########",
  "##################:::###########",
  "##################:::###########",
];
export const ASH_FIELD_PROPS: readonly PlaceProp[] = [
  ["bd-pick-swamp-stilt-snag", 1, 20],
  ["bd-pick-swamp-stilt-snag", 4, 21],
  ["bd-pick-swamp-stilt-snag", 2, 24],
  ["bd-pick-swamp-stilt-snag", 6, 24],
  ["bd-pick-swamp-stilt-snag", 4, 27],
  ["bd-pick-swamp-stilt-snag", 8, 27],
  ["bd-pick-swamp-stilt-snag", 1, 28],
  ["bd-pick-deep-forest-path-stump", 7, 30],
  ["bd-pick-deep-forest-path-stump", 10, 21],
  ["bd-pick-volcano-cave-coal-pile", 5, 31],
  ["bd-pick-volcano-cave-pillar-fallen", 8, 23],
  ["bd-pick-volcano-cave-ember-a", 9, 31],
  ["bd-pick-volcano-cave-ember-a", 3, 30],
  ["bd-pick-aqueduct-sewer-bone-heap", 22, 24],
  ["bd-pick-aqueduct-sewer-skulls", 25, 27],
  ["bd-pick-aqueduct-sewer-bones", 20, 27],
  ["bd-pick-volcano-cave-bones", 24, 22],
  ["bd-pick-dungeon-theme-bone-pillar", 27, 24],
  ["bd-pick-aqueduct-sewer-bones", 26, 29],
  ["bd-pick-dungeon-theme-bone-pillar", 21, 21],
  ["bd-pick-desert-oasis-bones", 23, 28],
  ["bd-pick-aqueduct-sewer-skulls", 19, 24],
  ["bd-pick-mining-valley-slagrock", 18, 12],
  ["bd-pick-mining-valley-slagrock", 5, 13],
  ["bd-pick-volcano-cave-spike-tall", 9, 7],
  ["bd-pick-volcano-cave-spike-small", 10, 8],
  ["bd-pick-volcano-cave-spike-wide", 6, 9],
  ["bd-pick-volcano-cave-spike-tall", 7, 6],
  ["bd-pick-mining-valley-slagheap", 25, 10],
  ["bd-pick-volcano-cave-ember-a", 23, 13],
  ["bd-pick-swamp-stilt-snag", 6, 3],
  ["bd-pick-swamp-stilt-snag", 19, 3],
  ["bd-pick-swamp-stilt-snag", 22, 5],
  ["bd-pick-swamp-stilt-snag", 9, 3],
  ["bd-pick-volcano-cave-spike-wide", 13, 31],
  ["bd-pick-volcano-cave-pillar-fallen", 21, 33],
  ["bd-pick-volcano-cave-spike-tall", 15, 26],
  ["bd-pick-volcano-cave-spike-small", 16, 27],
  ["bd-pick-swamp-stilt-snag", 0, 14],
  ["bd-pick-swamp-stilt-snag", 28, 18],
  ["bd-pick-volcano-cave-spike-tall", 1, 8],
  ["bd-pick-volcano-cave-spike-wide", 28, 3],
  ["bd-pick-swamp-stilt-snag", 11, 0],
  ["bd-pick-volcano-cave-spike-tall", 24, 33],
  ["bd-pick-swamp-stilt-snag", 3, 34],
  ["bd-pick-volcano-cave-spike-small", 28, 30],
  ["bd-pick-swamp-stilt-snag", 19, 15],
  ["bd-pick-volcano-cave-stalagmite", 22, 15],
  ["bd-pick-swamp-stilt-snag", 25, 14],
  ["bd-pick-swamp-stilt-snag", 27, 35],
  ["bd-pick-swamp-stilt-snag", 22, 0],
  ["bd-pick-volcano-cave-spike-wide", 12, 16],
  ["bd-pick-swamp-stilt-snag", 12, 34],
];
export const DAWN_PLAN: readonly string[] = [
  "#################::#################",
  "#####............::...........######",
  "###..............::.............####",
  "##...WWWWWWWWW...::.............####",
  "##...WWWWWWWWW...::...............##",
  "##...WWWWWWWWW...::...............##",
  "#....fffffffff...::...............##",
  "#....fffffffff...::................#",
  "#....fffffffff...:::...............#",
  "#....fffffffff....:::..............#",
  "#....fffffffff.....::..............#",
  "#....fffffffff.....::..............#",
  "##......::::::::::::::::::.........#",
  "##......::.....::::::..::::........#",
  "##......::....::::::::...::.......##",
  "#.......::....::::::::....::......##",
  "#.......::....::::::::.....::.....##",
  "#.......::.....::::::......::.....##",
  "#......::........::.........::....##",
  "#......::........::..........::...##",
  "##.....::........::...........::..##",
  "##....::.........::............:..##",
  "##....::.........::...............##",
  "###...::.........::..............###",
  "###..............::.............####",
  "####.............::............#####",
  "######...........::.........########",
  "#########........::......###########",
  "###########......::....#############",
  "################::::################",
];
export const DAWN_PROPS: readonly PlaceProp[] = [
  ["bd-out-cabin", 27, 2],
  ["bd-pick-temple-ruins-face-temple-3h", 5, 3],
  ["bd-pick-temple-ruins-face-temple-3h", 8, 3],
  ["bd-pick-temple-ruins-face-temple-3h", 11, 3],
  ["bd-pick-temple-ruins-ruined-wall-2", 5, 9],
  ["bd-pick-temple-ruins-ruined-wall-2", 12, 9],
  ["bd-pick-temple-ruins-column-temple-broken", 6, 6],
  ["bd-pick-temple-ruins-column-temple-tall", 13, 6],
  ["bd-pick-temple-ruins-mosaic-medallion-5x5", 7, 6],
  ["bd-pick-temple-ruins-fallen-column-temple", 10, 11],
  ["bd-pick-dungeon-theme-rubble-heap", 5, 11],
  ["bd-pick-castle-catacombs-rubble", 9, 11],
  ["bd-prop-well_roofed", 16, 13],
  ["bd-pick-swamp-stilt-snag", 20, 2],
  ["bd-pick-swamp-stilt-snag", 23, 4],
  ["bd-pick-swamp-stilt-snag", 2, 1],
  ["bd-pick-swamp-stilt-snag", 31, 9],
  ["bd-pick-swamp-stilt-snag", 9, 23],
  ["bd-pick-swamp-stilt-snag", 13, 25],
  ["bd-pick-swamp-stilt-snag", 21, 25],
  ["bd-pick-deep-forest-path-stump", 24, 10],
  ["bd-pick-aqueduct-sewer-bone-heap", 20, 17],
  ["bd-pick-volcano-cave-coal-pile", 11, 17],
  ["bd-pick-dungeon-theme-tomb-slab", 22, 9],
  ["bd-pick-dungeon-theme-waystone", 25, 9],
  ["bd-pick-dungeon-theme-waystone", 21, 8],
  ["bd-pick-volcano-cave-ember-a", 13, 19],
  ["bd-pick-volcano-cave-bones", 24, 13],
  ["bd-pick-mining-valley-slagrock", 31, 25],
  ["bd-pick-volcano-cave-spike-small", 4, 26],
];
export const DAWN_BURNT: readonly BurntHouse[] = [
  ["bd-out-longhouse", 1, 13, "r"],
  ["bd-out-cabin", 29, 13, "c"],
  ["bd-out-house-plank", 23, 20, "r"],
  ["bd-out-cabin-small", 2, 22, "c"],
]

/**
 * 북방 관문 요새 바깥 북쪽 — author_beodeul_town 성벽 마을을 pad 줄만큼 아래로 민 뒤, 비운 북쪽 줄을 칠한다.
 * 북문 길(gateXs 열)이 맵 끝까지 이어지고, 양옆은 잿빛 산 바위 벼랑(B 줄)이 깔때기처럼 길을 조인다.
 * 벼랑 발치와 성벽 사이 두 줄은 눈 덮인 턱 — 성벽 위에서 내려다보면 바깥(하늘·눈·벼랑)이 보인다.
 */
export function paintFortApproach(project: Project, map: GameMap, pad: number, gateXs: readonly number[], seed: number): void {
  const ts = project.tilesets[map.tilesetId];
  if (!ts) throw new Error(`[fallen-star places] ${map.id} 타일셋 없음`);
  const kits = new Map((ts.structureKits ?? []).map((k) => [k.id, k as Kit]));
  const flat = (id: string): number[] => {
    const k = kits.get(id);
    if (!k) throw new Error(`[fallen-star places] 키트 ${id} 가 없다`);
    return k.rows.flatMap((r) => r.tiles).filter((t) => t >= 0);
  };
  const snow = flat("bd-pick-snowfield-ground-snow"), road = flat("bd-pick-snowfield-ground-road");
  const W = map.width;
  const g0 = Math.min(...gateXs), g1 = Math.max(...gateXs);
  // 벼랑 — 길에서 위로 갈수록 좁아지는 골. 맨 아래 두 줄(성벽 바로 앞)은 비운다.
  const rock = (x: number, y: number): boolean => {
    const yy = Math.max(0, y), xx = Math.min(W - 1, Math.max(0, x));
    if (yy >= pad - 2) return false;
    const wob = h32(xx, yy, seed) % 3 === 0 ? 1 : 0;
    const spread = 3 + Math.floor(yy * 1.4) + wob;
    return xx < g0 - spread || xx > g1 + spread;
  };
  const lower = map.lowerTiles.slice();
  const upper = map.upperTiles.slice();
  for (let y = 0; y < pad; y += 1) for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    // 다져진 눈길은 성문 폭 그대로 곧게(가장자리를 흩으면 네모 얼룩으로 보였다).
    lower[i] = x >= g0 && x <= g1 ? road[h32(x, y, seed + 2) % road.length]! : snow[h32(x, y, seed + 3) % snow.length]!;
    upper[i] = -1;
  }
  // 벼랑은 이 줄들 안에서만 칠한다(아래 성벽 줄은 건드리지 않는다).
  const strip = lower.slice(0, pad * W);
  paintRock(ts.autotileGroups ?? [], kits, "B", rock, W, pad, strip);
  for (let i = 0; i < pad * W; i += 1) lower[i] = strip[i]!;
  // 눈 덮인 소나무 — 벼랑과 길 사이 눈비탈에 몇 그루(길 양옆 한 칸은 비운다).
  const pine = kits.get("bd-pick-snowfield-pine");
  if (pine) {
    const spots: [number, number][] = [[g0 - 4, 0], [g0 - 6, 2], [g0 - 9, 3], [g0 - 3, 3], [g1 + 3, 0], [g1 + 5, 2], [g1 + 8, 3], [g1 + 2, 4]];
    for (const [px, py] of spots) {
      const fits = pine.rows.every((row, dy) => (row.upperTiles ?? []).every((t, dx) => {
        const x = px + dx, y = py + dy;
        return t < 0 || (x >= 0 && x < W && y < pad && !rock(x, y) && !(x >= g0 - 1 && x <= g1 + 1) && upper[y * W + x] === -1);
      }));
      if (!fits) continue;
      pine.rows.forEach((row, dy) => (row.upperTiles ?? []).forEach((t, dx) => { if (t >= 0) upper[(py + dy) * W + px + dx] = t; }));
    }
  }
  map.lowerTiles = lower;
  map.upperTiles = upper;
  for (const layer of [map.lowerOverlayTiles, map.upperOverlayTiles]) if (layer) for (let i = 0; i < pad * W; i += 1) layer[i] = -1;
  if (map.shadowBits) for (let i = 0; i < pad * W; i += 1) map.shadowBits[i] = 0;
}
