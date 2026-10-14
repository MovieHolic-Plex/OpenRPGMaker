// 번들 키트 시트(몬스터 수집 monster_* 등)의 야외 빈 터를 「쓰임」으로 채운다 — 편집기 도구 furnish_outdoor_area·find_empty_ground 와
// 캠페인 생성기(monsterExpedition/world.ts)가 같은 코드를 쓴다.
//
// 왜(2026-10-06~07 실편집기 이어 고치기 r8~r13): 「서리꽃 마을 왼쪽 아래 공터 채워」에 조수가 터 하나·스타일 하나로 한 번 부르면
//   나무 셋·소품 한두 개만 놓여 빈칸이 53→27/34 에 머물렀다. 표식이 놓일 자리를 못 찾으면 맵 구석으로 밀려나고, 그 표식까지 깐 길은
//   허공에서 끝났다.
// 무엇을(2026-10-14): jp_city 빈터 쓰임(jpCityLotUse.ts, PR #2505)과 조화 검수(first-wins) 교훈을 그대로 옮긴다.
//   - 남은 터에서 가장 큰 빈 직사각형부터 「구획」으로 떼어 쓰임 하나(숲 덩이·꽃밭·눈놀이·선인장 밭·파라솔 쉼터·어구 더미·연못…)를 고른다.
//     쓰임은 구획의 크기와 곁(맵 가장자리·숲 벽 → 숲 덩이, 건물 곁 → 마당 쓰임)으로 고르고, 같은 쓰임을 연달아 쓰지 않는다.
//   - 구획마다 둘레 1칸 여백(걷는 띠)을 남긴다. 구획 안도 다 채우지 않는다(덩이 + 발치 소품).
//   - 모든 조각은 같은 바닥(구획의 지배 바닥) 위에만 선다 — 물·길·다른 바닥에 걸친 조각은 놓지 않는다(떠 보임).
//   - 문·출구 앞과 이벤트 둘레·주민 산책길은 비우고, 놓기 전에 닿던 이벤트가 하나라도 막히면 그 조각은 되돌린다.
//   - 멈춤: 터 안 「맨땅」(3×3 이웃에 물체가 하나도 없는 바닥 칸) 비율이 목표 이하, 또는 2×2 구획이 더 없을 때.
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import type { AutotileGroup, GameMap, Project, TilesetDef } from "@/project/types";

export class FurnishError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

export interface Palette {
  /** 덩이로 심는 큰 나무(키트 이름). */
  readonly trees: readonly string[];
  /** 터의 눈길을 잡는 표식 하나(키트 이름 또는 칸 라벨). */
  readonly features: readonly string[];
  /** 나무·표식 곁에 두세 개씩 모으는 작은 소품(키트 이름 또는 칸 라벨). */
  readonly smalls: readonly string[];
  /** 걷는 길 오토타일 그룹. 지금 맵에 가장 많이 깔린 그룹을 쓴다(마을 길=clearing, 도로=path). */
  readonly path?: readonly string[];
  /** 물·연못 오토타일 그룹과 그 둘레 띠. */
  readonly pond?: string;
  readonly pondRing?: string;
}

/** 지배 바닥 칸의 라벨 → 그 지역 재료. 시트에 없는 이름은 건너뛴다(같은 라벨 「풀밭」이 야외·해안 시트에 함께 있다). */
export const PALETTES: Readonly<Record<string, Palette>> = {
  눈밭: { trees: ["spine_a"], features: ["snowman"], smalls: ["눈더미(통행 불가)", "얼어붙은 덤불(통행 불가)"], path: ["snowpath"], pond: "pond" },
  "사막 모래": { trees: ["palm_a"], features: ["cactus_tall", "dcone_b"], smalls: ["선인장(통행 불가)", "마른 덤불(통행 불가)", "마른 뼈(장식, 걸을 수 있다)"],
    path: ["ashpath"], pond: "oasis", pondRing: "dgrass" },
  "재 덮인 풀": { trees: ["atree_a"], features: ["steam_vent", "vcone_c"], smalls: ["재 무더기(통행 불가)", "용암석(통행 불가)"], path: ["ashpath"], pond: "spring" },
  풀밭: { trees: ["tree_a", "tree_b", "pine_a"], features: ["statue", "lamp", "bench", "planter"], smalls: ["planter", "장식 덤불(막힘, 자르기 아님 — 자르기는 cuttree)", "꽃밭"],
    path: ["clearing", "path", "pave"], pond: "water" },
  모래: { trees: ["palm"], features: ["parasol_red", "parasol_blue", "deckchair"], smalls: ["sandrock", "bucket", "jar_a", "crate", "barrel"], path: ["pave", "path"] },
};

/**
 * 바닥마다 쓰임 목록. anchors = 덩이를 이루는 큰 조각(서로 맞닿게 한두 개), around = 덩이 발치에 하나씩 떨어뜨려 두는 작은 조각,
 * patch = 구획 안을 한 칸 걸러 메우는 작은 조각(밭·덤불숲), edge = 맵 가장자리·숲 벽 곁에서 먼저 고른다, yard = 건물 곁에서 먼저 고른다.
 */
interface Use { readonly id: string; readonly label: string; readonly anchors: readonly string[]; readonly count: number; readonly around: readonly string[]; readonly patch?: readonly string[]; readonly edge?: boolean; readonly yard?: boolean; readonly min?: readonly [number, number] }
const BUSH = "장식 덤불(막힘, 자르기 아님 — 자르기는 cuttree)";
export const LOT_USES: Readonly<Record<string, readonly Use[]>> = {
  풀밭: [
    { id: "grove", label: "나무 덩이", anchors: ["tree_a", "tree_b", "pine_a"], count: 2, around: [BUSH, "꽃밭"], edge: true },
    { id: "flowerbed", label: "꽃밭", anchors: [], count: 0, around: [BUSH], patch: ["꽃밭"], yard: true, min: [2, 2] },
    { id: "rest", label: "쉼터(벤치·가로등)", anchors: ["bench"], count: 1, around: ["lamp", "planter", "꽃밭"], yard: true },
    { id: "orchard", label: "작은 숲", anchors: ["pine_a", "tree_b"], count: 2, around: [BUSH], min: [3, 3] },
  ],
  눈밭: [
    { id: "grove", label: "침엽수 덩이", anchors: ["spine_a"], count: 2, around: ["눈더미(통행 불가)", "얼어붙은 덤불(통행 불가)"], edge: true },
    { id: "snowplay", label: "눈놀이 터(눈사람·눈더미)", anchors: ["snowman"], count: 1, around: ["눈더미(통행 불가)", "눈더미(통행 불가)"], yard: true },
    { id: "thicket", label: "얼어붙은 덤불숲", anchors: [], count: 0, around: [], patch: ["얼어붙은 덤불(통행 불가)", "눈더미(통행 불가)"], min: [2, 2] },
  ],
  "사막 모래": [
    // 마른 뼈는 유적 자리에만 — 여러 쓰임에 섞었더니 마을 곳곳에 뼈가 흩어져 쓰레기처럼 읽혔다(2026-10-14 검수 D3).
    { id: "palms", label: "야자 덩이", anchors: ["palm_a"], count: 2, around: ["마른 덤불(통행 불가)"], edge: true },
    { id: "cactus", label: "선인장 밭", anchors: ["cactus_tall"], count: 1, around: ["선인장(통행 불가)", "마른 덤불(통행 불가)"], patch: ["선인장(통행 불가)", "마른 덤불(통행 불가)"], yard: true },
    { id: "ruin", label: "무너진 유적 자리", anchors: ["ruin_pillar"], count: 2, around: ["마른 뼈(장식, 걸을 수 있다)", "부러진 유적 기둥(통행 불가)"] },
    { id: "rocks", label: "바위 무리", anchors: ["dcone_b", "dcone", "dcone_c"], count: 1, around: ["마른 덤불(통행 불가)", "선인장(통행 불가)"], edge: true },
  ],
  "재 덮인 풀": [
    { id: "grove", label: "재 숲 덩이", anchors: ["atree_a"], count: 2, around: ["재 무더기(통행 불가)"], edge: true },
    { id: "vents", label: "김 오르는 구멍", anchors: ["steam_vent"], count: 1, around: ["용암석(통행 불가)", "재 무더기(통행 불가)"], yard: true },
    { id: "cone", label: "용암 바위", anchors: ["vcone_c", "vcone"], count: 1, around: ["재 무더기(통행 불가)", "용암석(통행 불가)"] },
  ],
  모래: [
    { id: "beach", label: "파라솔 쉼터", anchors: ["parasol_red", "parasol_blue", "parasol_green"], count: 1, around: ["deckchair", "towel_red", "towel_blue", "bucket", "beachball"] },
    { id: "fishing", label: "어구 더미", anchors: ["net_rack"], count: 1, around: ["crate", "barrel", "basket_fish", "jar_a"], yard: true },
    { id: "palms", label: "야자 덩이", anchors: ["palm"], count: 2, around: ["sandrock"], edge: true },
  ],
};

export type Style = "auto" | "grove" | "garden" | "plaza" | "pond";
export const STYLES: readonly Style[] = ["auto", "grove", "garden", "plaza", "pond"];
export type Rect = { x: number; y: number; w: number; h: number };
type Piece = { name: string; width: number; height: number; lower: number[]; upper: number[] };
export interface PlacedLot { readonly use: string; readonly label: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly pieces: number }

function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + 1, 0x51ed27);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/** 키트 이름이면 그 키트, 아니면 라벨이 같은 칸 하나(위치 해시로 고른다)를 1×1 조각으로. */
function resolvePiece(tileset: TilesetDef, name: string, salt: number): Piece | null {
  const kit = tileset.structureKits?.find(k => k.name === name);
  if (kit) {
    const lower: number[] = [], upper: number[] = [];
    for (const row of kit.rows) for (let x = 0; x < kit.width; x++) { lower.push(row.tiles[x] ?? -1); upper.push(row.upperTiles?.[x] ?? -1); }
    return { name, width: kit.width, height: kit.height, lower, upper };
  }
  const tiles = Object.entries(tileset.tileMeta ?? {}).filter(([, meta]) => meta?.label === name).map(([id]) => Number(id));
  if (!tiles.length) return null;
  const tile = tiles[salt % tiles.length]!;
  const upperHome = tileset.tileMeta?.[tile]?.defaultLayer === "upper";
  return { name, width: 1, height: 1, lower: [upperHome ? -1 : tile], upper: [upperHome ? tile : -1] };
}

function available(tileset: TilesetDef, names: readonly string[]): string[] {
  return names.filter(name => resolvePiece(tileset, name, 0) !== null);
}

function groupOf(tileset: TilesetDef, id: string | undefined): AutotileGroup | undefined {
  return id ? autotileGroupsForTileset(tileset).find(g => g.id === id) : undefined;
}

function mostUsedGroup(map: GameMap, tileset: TilesetDef, ids: readonly string[]): AutotileGroup | undefined {
  const groups = ids.map(id => groupOf(tileset, id)).filter((g): g is AutotileGroup => !!g);
  const score = (g: AutotileGroup) => { const set = new Set(g.memberTileIds); return map.lowerTiles.filter(t => set.has(t)).length; };
  return groups.sort((a, b) => score(b) - score(a))[0];
}

const BUILDING_KIT = /^(house|center|mart|gym|cabin|two|shop|gable|apart|dept|office|hall|lighthouse|ruin_gate)/;
const FOREST_KIT = /^(forest|sforest|aforest)_/;

/** 맵의 바닥·물체 판독(측정기와 꾸미기가 같은 판정을 쓴다). */
export function readGround(project: Project, map: GameMap) {
  const tileset = project.tilesets[map.tilesetId]!;
  const W = map.width, H = map.height;
  const auto = new Set<number>();
  for (const g of autotileGroupsForTileset(tileset)) for (const t of g.memberTileIds) auto.add(t);
  const building = new Set<number>(), forest = new Set<number>();
  for (const k of tileset.structureKits ?? []) {
    const into = BUILDING_KIT.test(k.name ?? "") ? building : FOREST_KIT.test(k.name ?? "") ? forest : null;
    if (into) for (const r of k.rows) for (const t of [...r.tiles, ...(r.upperTiles ?? [])]) if (t >= 0) into.add(t);
  }
  const label = (i: number) => tileset.tileMeta?.[map.lowerTiles[i]!]?.label ?? "";
  const events = new Set(map.events.map(e => e.y * W + e.x));
  const ground = (i: number) => PALETTES[label(i)] !== undefined;
  /** 물체 = 위층 그림, 지역 바닥도 오토타일(길·물·띠)도 아닌 1층 칸, 이벤트. */
  const object = (i: number) => map.upperTiles[i] !== -1 || (!ground(i) && !auto.has(map.lowerTiles[i]!)) || events.has(i);
  const isBuilding = (i: number) => building.has(map.lowerTiles[i]!) || building.has(map.upperTiles[i]!);
  const isForest = (i: number) => forest.has(map.lowerTiles[i]!) || forest.has(map.upperTiles[i]!);
  return { tileset, W, H, label, ground, object, isBuilding, isForest, events };
}

/**
 * 터 안 바닥 칸 · 비어 있는 칸(위층·이벤트 없음) · 맨땅(3×3 이웃에 물체가 하나도 없는 바닥 칸).
 * 맨땅 비율이 「휑하다」의 수치다 — 걷는 길은 바닥이 아니라 세지 않는다.
 */
export function measureBareGround(project: Project, map: GameMap, rect?: Rect, radius = 1): { ground: number; open: number; bare: number; bareShare: number } {
  const g = readGround(project, map);
  const r = rect ?? { x: 0, y: 0, w: g.W, h: g.H };
  let ground = 0, open = 0, bare = 0;
  for (let y = Math.max(0, r.y); y < Math.min(g.H, r.y + r.h); y++) for (let x = Math.max(0, r.x); x < Math.min(g.W, r.x + r.w); x++) {
    const i = y * g.W + x;
    if (!g.ground(i)) continue;
    ground++;
    if (g.object(i)) continue;
    open++;
    let near = false;
    for (let dy = -radius; dy <= radius && !near; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < g.W && yy < g.H && g.object(yy * g.W + xx)) { near = true; break; }
    }
    if (!near) bare++;
  }
  return { ground, open, bare, bareShare: ground ? bare / ground : 0 };
}

/** 사용자가 말한 쪽 → 맵 위 사각형(반 크기). */
export const REGIONS = ["all", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;
export type Region = typeof REGIONS[number];
export function regionRect(map: GameMap, region: Region): Rect {
  const W = map.width, H = map.height, hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
  const left = { x: 0, w: hw }, right = { x: W - hw, w: hw }, full = { x: 0, w: W };
  const top = { y: 0, h: hh }, bottom = { y: H - hh, h: hh }, tall = { y: 0, h: H };
  switch (region) {
    case "top": return { ...full, ...top };
    case "bottom": return { ...full, ...bottom };
    case "left": return { ...left, ...tall };
    case "right": return { ...right, ...tall };
    case "top-left": return { ...left, ...top };
    case "top-right": return { ...right, ...top };
    case "bottom-left": return { ...left, ...bottom };
    case "bottom-right": return { ...right, ...bottom };
    case "center": return { x: Math.floor(W / 4), y: Math.floor(H / 4), w: hw, h: hh };
    default: return { x: 0, y: 0, w: W, h: H };
  }
}

/** 문·출구 앞(아래 두 칸), 이벤트 둘레, 주민 산책길(사용자 정의 이동 경로가 지나는 칸과 그 둘레) — 꾸미지 않을 칸. */
export function reservedCells(map: GameMap): Set<number> {
  const W = map.width, H = map.height, keep = new Set<number>();
  const add = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < W && y < H) keep.add(y * W + x); };
  const delta: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const e of map.events) {
    const transfer = JSON.stringify(e.pages ?? e).includes('"transfer"');
    for (let dy = -1; dy <= (transfer ? 2 : 1); dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dy) <= 1 || transfer) add(e.x + dx, e.y + dy);
    for (const page of e.pages ?? []) {
      const moves = (page.movement as { route?: { moves?: { kind?: string; dir?: string }[] } } | undefined)?.route?.moves ?? [];
      let x = e.x, y = e.y;
      for (const m of moves) {
        const d = m.kind === "move" && m.dir ? delta[m.dir] : undefined;
        if (!d) continue;
        x += d[0]; y += d[1];
        add(x, y);
      }
      if ((page.movement as { type?: string } | undefined)?.type === "random") for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) add(e.x + dx, e.y + dy);
    }
  }
  return keep;
}

interface Ctx {
  project: Project; map: GameMap; area: Rect; seed: number;
  g: ReturnType<typeof readGround>; keep: Set<number>; used: Set<number>; margin: Set<number>;
  stillReachable: () => boolean;
  /** 이번 호출이 놓은 덩이(큰 조각)와 그 쓰임의 발치 소품 — 마지막 덧붙임 단계가 쓴다. */
  clusters: { box: Rect; ground: string; around: readonly string[] }[];
}

function makeCtx(project: Project, map: GameMap, area: Rect, seed: number, extraKeep?: Iterable<number>): Ctx {
  const g = readGround(project, map);
  const keep = reservedCells(map);
  for (const i of extraKeep ?? []) keep.add(i);
  // 도달성 기준: 지금 닿는 이벤트는 꾸민 뒤에도 닿아야 한다. 출발점은 문(이동 이벤트) 곁.
  const W = map.width, H = map.height;
  const starts = map.events.filter(e => JSON.stringify(e.pages ?? e).includes('"transfer"'));
  const seedCell = (() => {
    for (const s of [...starts, ...map.events]) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]] as const) {
      const x = s.x + dx, y = s.y + dy;
      if (x >= 0 && y >= 0 && x < W && y < H && computeReachableCells(project, map, x, y).size > 8) return { x, y };
    }
    return null;
  })();
  const targets = seedCell ? (() => { const seen = computeReachableCells(project, map, seedCell.x, seedCell.y); return map.events.filter(e => isAdjacentOrOn(seen, e.x, e.y)); })() : [];
  const stillReachable = () => {
    if (!seedCell) return true;
    const seen = computeReachableCells(project, map, seedCell.x, seedCell.y);
    return targets.every(e => isAdjacentOrOn(seen, e.x, e.y));
  };
  return { project, map, area, seed, g, keep, used: new Set(), margin: new Set(), stillReachable, clusters: [] };
}

function inArea(c: Ctx, x: number, y: number): boolean {
  return x >= c.area.x && y >= c.area.y && x < c.area.x + c.area.w && y < c.area.y + c.area.h && x >= 0 && y >= 0 && x < c.g.W && y < c.g.H;
}

/** 조각을 놓을 수 있는 칸: 터 안, 지정 바닥, 비어 있음, 비워 둘 칸·이미 쓴 칸이 아님. */
function freeFor(c: Ctx, x: number, y: number, ground: string, allowMargin = false): boolean {
  if (!inArea(c, x, y)) return false;
  const i = y * c.g.W + x;
  return !c.keep.has(i) && !c.used.has(i) && (allowMargin || !c.margin.has(i)) && c.g.label(i) === ground && c.map.upperTiles[i] === -1 && !c.g.events.has(i);
}

function stampPiece(c: Ctx, piece: Piece, x0: number, y0: number, ground: string): boolean {
  for (let dy = 0; dy < piece.height; dy++) for (let dx = 0; dx < piece.width; dx++) if (!freeFor(c, x0 + dx, y0 + dy, ground)) return false;
  const saved: [number, number, number][] = [];
  for (let dy = 0; dy < piece.height; dy++) for (let dx = 0; dx < piece.width; dx++) {
    const i = (y0 + dy) * c.g.W + x0 + dx, k = dy * piece.width + dx;
    saved.push([i, c.map.lowerTiles[i]!, c.map.upperTiles[i]!]);
    if (piece.lower[k]! >= 0) c.map.lowerTiles[i] = piece.lower[k]!;
    if (piece.upper[k]! >= 0) c.map.upperTiles[i] = piece.upper[k]!;
  }
  if (!c.stillReachable()) { for (const [i, lo, up] of saved) { c.map.lowerTiles[i] = lo; c.map.upperTiles[i] = up; } return false; }
  for (const [i] of saved) c.used.add(i);
  return true;
}

/** 남은 터에서 가장 큰 빈 직사각형(w,h ≥ 2). 여백·비워 둘 칸은 빈 칸이 아니다. */
function largestFreeRect(c: Ctx, tried: Set<string>): (Rect & { ground: string }) | null {
  const { W } = c.g;
  const ok = (x: number, y: number) => {
    if (!inArea(c, x, y)) return false;
    const i = y * W + x;
    return !c.keep.has(i) && !c.used.has(i) && !c.margin.has(i) && c.g.ground(i) && c.map.upperTiles[i] === -1 && !c.g.events.has(i);
  };
  const x0 = Math.max(0, c.area.x), x1 = Math.min(c.g.W, c.area.x + c.area.w), y0 = Math.max(0, c.area.y), y1 = Math.min(c.g.H, c.area.y + c.area.h);
  const heights = new Array<number>(c.g.W).fill(0);
  let best: Rect | null = null, bestArea = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) heights[x] = ok(x, y) ? heights[x]! + 1 : 0;
    for (let x = x0; x < x1; x++) {
      let h = Infinity;
      for (let x2 = x; x2 < x1 && heights[x2]! > 0; x2++) {
        h = Math.min(h, heights[x2]!);
        const w = x2 - x + 1, a = w * h;
        if (w >= 2 && h >= 2 && a > bestArea && !tried.has(`${x},${y - h + 1},${w},${h}`)) { bestArea = a; best = { x, y: y - h + 1, w, h }; }
      }
    }
  }
  if (!best) return null;
  const counts = new Map<string, number>();
  for (let y = best.y; y < best.y + best.h; y++) for (let x = best.x; x < best.x + best.w; x++) { const l = c.g.label(y * W + x); counts.set(l, (counts.get(l) ?? 0) + 1); }
  return { ...best, ground: [...counts].sort((a, b) => b[1] - a[1])[0]![0] };
}

/** 구획이 맵 가장자리·숲 벽, 건물에 닿는 쪽. */
function lotContext(c: Ctx, r: Rect): { edge: "left" | "right" | "top" | "bottom" | null; yard: boolean } {
  const { W, H } = c.g;
  const touch = (pred: (i: number) => boolean, side: "left" | "right" | "top" | "bottom") => {
    const cells: [number, number][] = side === "left" ? Array.from({ length: r.h }, (_, k) => [r.x - 1, r.y + k]) : side === "right" ? Array.from({ length: r.h }, (_, k) => [r.x + r.w, r.y + k])
      : side === "top" ? Array.from({ length: r.w }, (_, k) => [r.x + k, r.y - 1]) : Array.from({ length: r.w }, (_, k) => [r.x + k, r.y + r.h]);
    let n = 0;
    for (const [x, y] of cells) if (x < 0 || y < 0 || x >= W || y >= H || pred(y * W + x)) n++;
    return n * 2 >= cells.length;
  };
  const edge = (["left", "right", "top", "bottom"] as const).find(side => touch(i => c.g.isForest(i), side)) ?? null;
  let yard = false;
  for (let y = r.y - 2; y < r.y + r.h + 2 && !yard; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) if (x >= 0 && y >= 0 && x < W && y < H && c.g.isBuilding(y * W + x)) { yard = true; break; }
  return { edge, yard };
}

/** 쓰임 하나를 구획에 놓는다. 놓은 조각 수를 돌려준다. */
function placeUse(c: Ctx, use: Use, lot: Rect & { ground: string }, edge: string | null, salt: number): number {
  const ts = c.g.tileset;
  const anchors = available(ts, use.anchors), around = available(ts, use.around), patch = available(ts, use.patch ?? []);
  const cells: { x: number; y: number }[] = [];
  // 큰 조각(나무 2×3·2×4)은 왼쪽 위 칸만 구획 안이면 된다 — 몸은 터 안의 빈 바닥으로 넘쳐도 된다(3칸 폭 구획에 나무가 한 그루뿐이었다).
  for (let y = lot.y - 2; y < lot.y + lot.h; y++) for (let x = lot.x - 1; x < lot.x + lot.w; x++) cells.push({ x, y });
  const toward = (p: { x: number; y: number }) => edge === "left" ? p.x - lot.x : edge === "right" ? lot.x + lot.w - 1 - p.x : edge === "top" ? p.y - lot.y : edge === "bottom" ? lot.y + lot.h - 1 - p.y
    : Math.abs(p.x - (lot.x + (lot.w >> 1))) + Math.abs(p.y - (lot.y + (lot.h >> 1)));
  let pieces = 0;
  const footprints: Rect[] = [];
  // 1) 덩이: 큰 조각을 가장자리(없으면 가운데)부터 맞닿게.
  if (anchors.length && use.count > 0) {
    const order = cells.slice().sort((a, b) => toward(a) - toward(b) || (hash(a.x, a.y, c.seed + salt) % 5) - (hash(b.x, b.y, c.seed + salt) % 5));
    for (const p of order) {
      if (footprints.length >= (use.edge ? Math.min(4, Math.max(use.count, Math.floor((lot.w * lot.h) / 8))) : use.count)) break;
      const piece = resolvePiece(ts, anchors[hash(p.x, p.y, c.seed + salt) % anchors.length]!, hash(p.x, p.y, c.seed));
      if (!piece) continue;
      // 둘째 조각부터는 앞 덩이에 맞닿아야 한다(흩어진 나무 금지).
      if (footprints.length && !footprints.some(f => p.x <= f.x + f.w && p.x + piece.width >= f.x && p.y <= f.y + f.h && p.y + piece.height >= f.y)) continue;
      if (stampPiece(c, piece, p.x, p.y, lot.ground)) { footprints.push({ x: p.x, y: p.y, w: piece.width, h: piece.height }); pieces++; }
    }
  }
  // 2) 밭: 한 칸 걸러(체크무늬) 메운다 — 밭 안도 걷는 틈이 남는다. 꽃밭처럼 바닥 장식(걸을 수 있다)은 빽빽하게.
  if (patch.length) {
    const walkable = patch.every(name => /걸을 수 있다|꽃밭/.test(name));
    const inner = { x: lot.x + (lot.w > 3 ? 1 : 0), y: lot.y + (lot.h > 3 ? 1 : 0), w: lot.w > 3 ? lot.w - 2 : lot.w, h: lot.h > 3 ? lot.h - 2 : lot.h };
    for (let y = inner.y; y < inner.y + Math.min(inner.h, 3); y++) for (let x = inner.x; x < inner.x + Math.min(inner.w, 4); x++) {
      if (!walkable && (x + y) % 2) continue;
      const piece = resolvePiece(ts, patch[hash(x, y, c.seed + 3) % patch.length]!, hash(x, y, c.seed));
      if (piece && piece.width === 1 && piece.height === 1 && stampPiece(c, piece, x, y, lot.ground)) { footprints.push({ x, y, w: 1, h: 1 }); pieces++; }
    }
  }
  // 3) 발치 소품: 덩이 밑동 둘레에 하나씩, 서로 붙지 않게(붙이면 울타리처럼 한 줄로 읽혔다).
  if (around.length && footprints.length) {
    const smallAt = new Set<number>();
    const touches = (x: number, y: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => smallAt.has((y + dy!) * c.g.W + x + dx!));
    const want = Math.min(5, 1 + footprints.length * 2);
    let placed = 0;
    for (const f of footprints.slice(0, 4)) {
      const foot = f.y + f.h - 1;
      const rim = [{ x: f.x - 1, y: foot }, { x: f.x + f.w, y: foot }, { x: f.x - 1, y: foot + 1 }, { x: f.x + f.w, y: foot + 1 }, { x: f.x, y: foot + 1 }, { x: f.x + f.w - 1, y: foot + 1 }]
        .sort((a, b) => hash(a.x, a.y, c.seed + salt) - hash(b.x, b.y, c.seed + salt));
      for (const p of rim) {
        if (placed >= want) break;
        if (touches(p.x, p.y) || !inArea(c, p.x, p.y)) continue;
        const piece = resolvePiece(ts, around[hash(p.x, p.y, c.seed + 7) % around.length]!, hash(p.x, p.y, c.seed));
        if (!piece) continue;
        // 다른 구획의 여백 칸에는 놓지 않는다(구획끼리 맞붙어 쌓이지 않게) — freeFor 가 여백을 거절한다.
        if (stampPiece(c, piece, p.x, p.y, lot.ground)) { placed++; pieces++; smallAt.add(p.y * c.g.W + p.x); footprints.push({ x: p.x, y: p.y, w: piece.width, h: piece.height }); break; }
      }
    }
  }
  if (footprints.length && around.length) {
    const xs = footprints.map(f => f.x), ys = footprints.map(f => f.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...footprints.map(f => f.x + f.w)) - Math.min(...xs), h: Math.max(...footprints.map(f => f.y + f.h)) - Math.min(...ys) };
    c.clusters.push({ box, ground: lot.ground, around });
  }
  // 4) 여백: 놓은 조각 둘레 1칸은 다른 구획이 쓰지 않는다(걷는 띠·숨 쉴 자리). 빈 구획 자리는 통째로 여백.
  // 좁은 띠(폭·높이 3 이하)에서는 여백을 2칸으로 — 띠를 따라 쓰임이 줄지어 서지 않게(검수 D1).
  const ringR = lot.w <= 3 || lot.h <= 3 ? 2 : 1;
  const ring = footprints.length ? footprints : [lot];
  for (const f of ring) for (let y = f.y - ringR; y < f.y + f.h + ringR; y++) for (let x = f.x - ringR; x < f.x + f.w + ringR; x++) {
    if (x >= 0 && y >= 0 && x < c.g.W && y < c.g.H) { const i = y * c.g.W + x; if (!c.used.has(i)) c.margin.add(i); }
  }
  return pieces;
}

/**
 * 터를 구획으로 나눠 쓰임으로 채운다. target = 멈출 맨땅 비율(기본 0.12). prefer = 첫 구획에 먼저 쓸 쓰임 id.
 * 돌려주는 lots 는 놓은 쓰임 목록(조수에게 보여 줄 요약).
 */
export function fillAreaByUse(project: Project, map: GameMap, area: Rect, options: { seed?: number; target?: number; openTarget?: number; maxLots?: number; keep?: Iterable<number>; prefer?: string } = {}) {
  const seed = options.seed ?? 1, target = options.target ?? 0.05, openTarget = options.openTarget ?? 0.45, maxLots = options.maxLots ?? 12;
  const c = makeCtx(project, map, area, seed, options.keep);
  const before = measureBareGround(project, map, area);
  const lots: PlacedLot[] = [];
  const tried = new Set<string>();
  const usedIds: string[] = [];
  for (let step = 0; step < maxLots * 3 && lots.length < maxLots; step++) {
    // 멈춤: 맨땅(3×3 이웃에 물체 없음)이 거의 없고, 비어 있는 바닥도 터의 openTarget 이하. 맨땅만 보면 1칸 소품 하나가 9칸을 「덮어」
    // 나무 한 그루·눈사람 하나에서 멈췄다(2026-10-14 탐침: 맨땅 43%→6% 인데 그림은 휑했다).
    const now = measureBareGround(project, map, area);
    if (now.bareShare <= target && (!now.ground || now.open / now.ground <= openTarget)) break;
    const found = largestFreeRect(c, tried);
    if (!found) break;
    // 큰 터는 한 구획에 다 쓰지 않는다 — 최대 5×4 를 떼어 쓰고 나머지는 다음 구획으로.
    const lot = { ...found, w: Math.min(found.w, 5), h: Math.min(found.h, 4) };
    tried.add(`${found.x},${found.y},${found.w},${found.h}`);
    // 가는 띠(폭이나 높이 2)에는 큰 조각(2×2 이상) 쓰임을 두지 않는다 — 바닷가 모래 띠에 파라솔·어구·야자가 줄지어 서서 울타리처럼 읽혔다(검수 D1).
    const thin = lot.w < 3 || lot.h < 3;
    const bigAnchor = (u: Use) => available(c.g.tileset, u.anchors).some(name => { const pc = resolvePiece(c.g.tileset, name, 0); return !!pc && pc.width * pc.height > 2; });
    const uses = (LOT_USES[lot.ground] ?? []).filter(u => (u.anchors.length === 0 || available(c.g.tileset, u.anchors).length) && (!u.patch || available(c.g.tileset, u.patch).length)
      && lot.w >= (u.min?.[0] ?? 1) && lot.h >= (u.min?.[1] ?? 1) && !(thin && bigAnchor(u)));
    if (!uses.length) { for (let y = lot.y; y < lot.y + lot.h; y++) for (let x = lot.x; x < lot.x + lot.w; x++) c.margin.add(y * c.g.W + x); continue; }
    const ctx = lotContext(c, lot);
    // 같은 쓰임이 가까이(맨해튼 8칸 안) 이미 있으면 크게 깎는다 — 옆 구획에 파라솔 둘·야자 둘이 나란히 섰다(검수 D1).
    const nearSame = (u: Use) => lots.some(l => l.use === u.id && Math.abs(l.x - lot.x) + Math.abs(l.y - lot.y) <= 8);
    const score = (u: Use) => (options.prefer === u.id && !lots.length ? -100 : 0) + (u.edge && ctx.edge ? -4 : 0) + (u.yard && ctx.yard ? -3 : 0)
      + usedIds.filter(id => id === u.id).length * 3 + (usedIds.at(-1) === u.id ? 5 : 0) + (nearSame(u) ? 8 : 0) + (hash(lot.x, lot.y, seed + usedIds.length) % 3) * 0.5;
    const ranked = uses.slice().sort((a, b) => score(a) - score(b));
    let placed = 0, chosen: Use | undefined;
    for (const u of ranked) {
      placed = placeUse(c, u, lot, u.edge ? ctx.edge : null, lots.length * 17);
      if (placed > 0) { chosen = u; break; }
    }
    if (!chosen) { for (let y = lot.y; y < lot.y + lot.h; y++) for (let x = lot.x; x < lot.x + lot.w; x++) c.margin.add(y * c.g.W + x); continue; }
    usedIds.push(chosen.id);
    lots.push({ use: chosen.id, label: chosen.label, x: lot.x, y: lot.y, w: lot.w, h: lot.h, pieces: placed });
  }
  // 덧붙임: 구획이 더 안 나오는데 아직 휑하면, 놓은 덩이 바로 곁(여백 칸 포함 — 같은 덩이의 발치다)에 그 쓰임의 작은 조각을 하나씩 더 붙인다.
  // 새 덩이를 만들지 않으므로 구획끼리 맞붙지 않고, 작은 조각끼리도 붙이지 않는다.
  const sideSmall = new Set<number>();
  for (const cl of c.clusters) {
    const now = measureBareGround(project, map, area);
    if (now.ground && now.open / now.ground <= openTarget) break;
    const ring: { x: number; y: number }[] = [];
    for (let x = cl.box.x - 1; x <= cl.box.x + cl.box.w; x++) ring.push({ x, y: cl.box.y + cl.box.h }, { x, y: cl.box.y - 1 });
    for (let y = cl.box.y; y < cl.box.y + cl.box.h; y++) ring.push({ x: cl.box.x - 1, y }, { x: cl.box.x + cl.box.w, y });
    let added = 0;
    for (const p of ring.sort((a, b) => hash(a.x, a.y, seed + 11) - hash(b.x, b.y, seed + 11))) {
      if (added >= 2) break;
      const i = p.y * c.g.W + p.x;
      if (!inArea(c, p.x, p.y) || [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sideSmall.has((p.y + dy!) * c.g.W + p.x + dx!) || (c.used.has((p.y + dy!) * c.g.W + p.x + dx!) && !(dx === 0 && dy === 0) && !insideBox(cl.box, p.x + dx!, p.y + dy!)))) continue;
      const piece = resolvePiece(c.g.tileset, cl.around[hash(p.x, p.y, seed + 13) % cl.around.length]!, hash(p.x, p.y, seed));
      if (!piece || piece.width !== 1 || piece.height !== 1) continue;
      const wasMargin = c.margin.delete(i);
      if (stampPiece(c, piece, p.x, p.y, cl.ground)) { added++; sideSmall.add(i); }
      else if (wasMargin) c.margin.add(i);
    }
  }
  const after = measureBareGround(project, map, area);
  return { lots, before, after };
}

/**
 * 예전 한 스타일 꾸미기(grove|garden|plaza|pond) — 명시한 스타일을 첫 구획에 쓰고, 이어서 남은 터를 쓰임으로 채운다.
 * auto 는 쓰임 채우기만.
 */
export function furnishOutdoorArea(project: Project, map: GameMap, area: Rect, style: Style, seed: number, options: { fill?: boolean; target?: number } = {}) {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset?.structureKits?.length) throw new FurnishError(`${map.tilesetId} 에 구조 키트가 없어 이 도구로 꾸밀 수 없습니다 — place_props·stamp_object 를 쓰세요.`, "no-kits");
  const W = map.width, H = map.height;
  const r = { x: Math.max(0, area.x), y: Math.max(0, area.y), w: 0, h: 0 };
  r.w = Math.min(W, area.x + area.w) - r.x; r.h = Math.min(H, area.y + area.h) - r.y;
  if (r.w < 2 || r.h < 2) throw new FurnishError("area 가 너무 작거나 맵 밖입니다.", "invalid-args");
  const g = readGround(project, map);
  const counts = new Map<string, number>();
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = y * W + x;
    if (map.upperTiles[i] !== -1 || g.events.has(i)) continue;
    const name = g.label(i);
    if (PALETTES[name]) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ground = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!ground) throw new FurnishError(`이 터의 바닥이 알려진 지역 바닥(${Object.keys(PALETTES).join("·")})이 아닙니다 — 빈 바닥 칸이 있는 터를 고르세요.`, "unknown-ground");
  const emptyBefore = plainCount(project, map, r);
  const legacy = style === "auto" ? { trees: 0, smalls: 0, pathCells: 0, placed: [] as { name: string; x: number; y: number; w: number; h: number }[] } : furnishStyle(project, map, r, style, seed, ground);
  const filled = options.fill === false ? { lots: [] as PlacedLot[], before: measureBareGround(project, map, r), after: measureBareGround(project, map, r) }
    : fillAreaByUse(project, map, r, { seed, ...(options.target !== undefined ? { target: options.target } : {}) });
  const base = PALETTES[ground]!;
  return { ground, emptyBefore, emptyAfter: plainCount(project, map, r), ...legacy, lots: filled.lots, bareBefore: filled.before, bareAfter: filled.after,
    palette: { trees: available(tileset, base.trees), features: available(tileset, base.features), smalls: available(tileset, base.smalls) } };
}

function plainCount(project: Project, map: GameMap, r: Rect): number {
  const g = readGround(project, map);
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const i = y * g.W + x; if (g.ground(i) && map.upperTiles[i] === -1 && !g.events.has(i)) n++; }
  return n;
}

/** 한 스타일 꾸미기: 연못·광장 덩이 → 표식(제자리에 놓일 때만 길을 잇는다) → 나무 덩이 → 발치 소품. */
function furnishStyle(project: Project, map: GameMap, r: Rect, style: Exclude<Style, "auto">, seed: number, ground: string) {
  const tileset = project.tilesets[map.tilesetId]!;
  const W = map.width, H = map.height;
  const idx = (x: number, y: number) => y * W + x;
  const c = makeCtx(project, map, r, seed);
  const base = PALETTES[ground]!;
  const palette = { trees: available(tileset, base.trees), features: available(tileset, base.features), smalls: available(tileset, base.smalls) };
  const isGround = (i: number) => c.g.label(i) === ground && map.upperTiles[i] === -1 && !c.g.events.has(i);
  const freeCell = (x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h && !c.keep.has(idx(x, y)) && !c.used.has(idx(x, y)) && isGround(idx(x, y));
  const placed: { name: string; x: number; y: number; w: number; h: number }[] = [];
  const stamp = (piece: Piece, x0: number, y0: number): boolean => {
    if (!stampPiece(c, piece, x0, y0, ground)) return false;
    placed.push({ name: piece.name, x: x0, y: y0, w: piece.width, h: piece.height });
    return true;
  };
  const sides = [{ side: "left", d: r.x }, { side: "right", d: W - (r.x + r.w) }, { side: "top", d: r.y }, { side: "bottom", d: H - (r.y + r.h) }].sort((a, b) => a.d - b.d);
  const edge = sides[0]!.side;
  const towardEdge = (x: number, y: number) => edge === "left" ? x - r.x : edge === "right" ? r.x + r.w - 1 - x : edge === "top" ? y - r.y : r.y + r.h - 1 - y;
  const cells: { x: number; y: number }[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.push({ x, y });
  const center = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };

  const paintGroup = (group: AutotileGroup, rect: Rect, rounded: boolean): { x: number; y: number }[] => {
    const changed: { x: number; y: number }[] = [];
    const full = group.variantMap[String(group.neighborhood === 8 ? 255 : 15)]!;
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const corner = (x === rect.x || x === rect.x + rect.w - 1) && (y === rect.y || y === rect.y + rect.h - 1);
      if ((rounded && corner) || !freeCell(x, y)) continue;
      map.lowerTiles[idx(x, y)] = full; c.used.add(idx(x, y)); changed.push({ x, y });
    }
    shapeAllAutotileGroupsAround(map, [group], changed);
    return changed;
  };
  let feature: { x: number; y: number } | null = null;
  let featureOnPlaza = false;
  const shore = new Set<number>();
  const pondGroup = groupOf(tileset, base.pond), ringGroup = groupOf(tileset, base.pondRing), pathGroup = mostUsedGroup(map, tileset, base.path ?? []);
  // 덩이 자리: 둘레 한 칸까지(모서리 제외) 전부 빈 바닥인 가장 큰 사각형을 터 가운데 가깝게 고른다 —
  // 건물·길에 걸치면 연못이 T자로 찢기고 광장이 조각났다(2026-10-07 시험).
  const freeRect = (maxW: number, maxH: number, minW: number, minH: number): Rect | null => {
    for (let w = maxW, h = maxH; w >= minW && h >= minH; w > h ? w-- : h--) {
      let best: Rect | null = null, bestD = Infinity;
      for (let y = r.y + 1; y + h <= r.y + r.h - 1; y++) for (let x = r.x + 1; x + w <= r.x + r.w - 1; x++) {
        let ok = true;
        for (let yy = y - 1; ok && yy <= y + h; yy++) for (let xx = x - 1; ok && xx <= x + w; xx++) {
          const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
          if (!corner && !freeCell(xx, yy)) ok = false;
        }
        const d = Math.abs(x + w / 2 - (r.x + r.w / 2)) + Math.abs(y + h / 2 - (r.y + r.h / 2));
        if (ok && d < bestD) { best = { x, y, w, h }; bestD = d; }
      }
      if (best) return best;
    }
    return null;
  };
  if (style === "pond" && pondGroup) {
    const pr = freeRect(Math.min(5, r.w - 2), Math.min(4, r.h - 2), 2, 2);
    if (!pr) throw new FurnishError("이 터에는 둘레까지 빈 연못 자리(최소 4×4)가 없습니다 — 더 넓은 빈 터를 고르거나 style:auto 를 쓰세요.", "no-room");
    const ring = new Set((ringGroup ? paintGroup(ringGroup, { x: pr.x - 1, y: pr.y - 1, w: pr.w + 2, h: pr.h + 2 }, true) : []).map(p => idx(p.x, p.y)));
    const full = pondGroup.variantMap[String(pondGroup.neighborhood === 8 ? 255 : 15)]!;
    const water: { x: number; y: number }[] = [];
    for (let y = pr.y; y < pr.y + pr.h; y++) for (let x = pr.x; x < pr.x + pr.w; x++) { const i = idx(x, y); if (isGround(i) || ring.has(i)) { map.lowerTiles[i] = full; water.push({ x, y }); c.used.add(i); } }
    shapeAllAutotileGroupsAround(map, ringGroup ? [pondGroup, ringGroup] : [pondGroup], water);
    if (!ringGroup) for (let y = pr.y - 1; y <= pr.y + pr.h; y++) for (let x = pr.x - 1; x <= pr.x + pr.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) shore.add(idx(x, y));
    if (!c.stillReachable()) throw new FurnishError("연못이 길을 막습니다 — 더 넓은 터를 고르거나 style:auto 를 쓰세요.", "blocks-path");
    placed.push({ name: base.pond!, x: pr.x - (ringGroup ? 1 : 0), y: pr.y - (ringGroup ? 1 : 0), w: pr.w + (ringGroup ? 2 : 0), h: pr.h + (ringGroup ? 2 : 0) });
  }
  if (style === "plaza" && pathGroup) {
    const pr = freeRect(Math.min(5, r.w - 2), Math.min(4, r.h - 2), 3, 3);
    if (!pr) throw new FurnishError("이 터에는 둘레까지 빈 광장 자리(최소 5×5)가 없습니다 — 더 넓은 빈 터를 고르거나 style:auto 를 쓰세요.", "no-room");
    paintGroup(pathGroup, pr, false);
    feature = { x: pr.x + Math.floor(pr.w / 2), y: pr.y + Math.floor(pr.h / 2) };
    featureOnPlaza = true;
  }
  // 표식: 광장은 광장 가운데, garden 은 터 가운데 근처(나무 쪽 반대편). 제자리에 못 놓으면 표식도 길도 없다 —
  // 예전엔 구석 아무 칸에 놓고 원래 자리에서 길을 깔아 허공에서 끝나는 길이 남았다(2026-10-14 탐침).
  let featureAt: { x: number; y: number } | null = null;
  if (palette.features.length && (style === "garden" || style === "plaza")) {
    const piece = resolvePiece(tileset, palette.features[seed % palette.features.length]!, seed);
    if (piece && featureOnPlaza && feature) {
      const fy = feature.y - (piece.height - 1);
      for (let dy = 0; dy < piece.height; dy++) for (let dx = 0; dx < piece.width; dx++) { const k = dy * piece.width + dx, i = idx(feature.x + dx, fy + dy); if (piece.upper[k]! >= 0) map.upperTiles[i] = piece.upper[k]!; }
      placed.push({ name: piece.name, x: feature.x, y: fy, w: piece.width, h: piece.height });
      featureAt = feature;
    } else if (piece) {
      const spots = cells.filter(p => freeCell(p.x, p.y)).sort((a, b) =>
        (Math.abs(a.x - center.x) + Math.abs(a.y - center.y) - towardEdge(a.x, a.y) * 0.3) - (Math.abs(b.x - center.x) + Math.abs(b.y - center.y) - towardEdge(b.x, b.y) * 0.3));
      for (const s of spots.slice(0, 6)) if (stamp(piece, s.x, Math.max(r.y, s.y - (piece.height - 1)))) { featureAt = { x: s.x, y: s.y }; break; }
    }
  }
  // 길: 표식 밑동에서 가장 가까운 기존 길까지(터 밖 바닥도 지나간다), 기존 길에 닿아야 한다.
  let pathCells = 0;
  if (featureAt && pathGroup && !featureOnPlaza) {
    const members = new Set(pathGroup.connectTileIds ?? pathGroup.memberTileIds);
    const near = ([[0, 1], [1, 0], [-1, 0], [0, -1]] as const).map(([dx, dy]) => ({ x: featureAt!.x + dx, y: featureAt!.y + dy })).find(p => freeCell(p.x, p.y));
    const startI = near ? idx(near.x, near.y) : -1;
    const prev = new Map<number, number>([[startI, -1]]);
    const queue = startI >= 0 ? [startI] : [];
    let hit = -1;
    for (let head = 0; head < queue.length && hit < 0; head++) {
      const i = queue[head]!, x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx, ny = y + dy, ni = idx(nx, ny);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(ni)) continue;
        if (members.has(map.lowerTiles[ni]!) && !c.used.has(ni)) { prev.set(ni, i); hit = ni; break; }
        if (!isGround(ni) || c.keep.has(ni) || c.used.has(ni)) continue;
        if (Math.abs(nx - featureAt.x) + Math.abs(ny - featureAt.y) > r.w + r.h + 6) continue;
        prev.set(ni, i); queue.push(ni);
      }
    }
    if (hit >= 0) {
      const route: { x: number; y: number }[] = [];
      for (let i = prev.get(hit)!; i >= 0; i = prev.get(i)!) route.push({ x: i % W, y: Math.floor(i / W) });
      const full = pathGroup.variantMap[String(pathGroup.neighborhood === 8 ? 255 : 15)]!;
      for (const p of route) { map.lowerTiles[idx(p.x, p.y)] = full; c.used.add(idx(p.x, p.y)); }
      shapeAllAutotileGroupsAround(map, [pathGroup], route);
      pathCells = route.length;
    }
  }
  // 나무 덩이: 가장자리 쪽부터 맞닿게. grove 는 터의 반 가까이, 나머지는 두세 그루.
  const treeTarget = style === "grove" ? Math.max(3, Math.floor((r.w * r.h) / 9)) : style === "pond" ? 2 : 3;
  let trees = 0;
  if (palette.trees.length) {
    const order = cells.slice().sort((a, b) => towardEdge(a.x, a.y) - towardEdge(b.x, b.y) || (hash(a.x, a.y, seed) % 7) - (hash(b.x, b.y, seed) % 7));
    for (const p of order) {
      if (trees >= treeTarget) break;
      const piece = resolvePiece(tileset, palette.trees[hash(p.x, p.y, seed) % palette.trees.length]!, hash(p.x, p.y, seed));
      if (!piece) continue;
      if (featureAt && Math.abs(p.x - featureAt.x) + Math.abs(p.y - featureAt.y) < 3) continue;
      let onShore = false;
      for (let dy = 0; dy < piece.height && !onShore; dy++) for (let dx = 0; dx < piece.width; dx++) if (shore.has(idx(p.x + dx, p.y + dy))) onShore = true;
      if (onShore) continue;
      if (stamp(piece, p.x, p.y)) trees++;
    }
  }
  // 발치 소품: 나무·표식·물가 둘레에 한두 개씩 — 서로 붙지 않게.
  let smalls = 0;
  if (palette.smalls.length) {
    const smallAt = new Set<number>();
    const touchesSmall = (x: number, y: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => smallAt.has(idx(x + dx!, y + dy!)));
    for (const a of placed.slice()) {
      const isPond = a.name === base.pond;
      const rim: { x: number; y: number }[] = [];
      if (isPond) {
        for (let x = a.x - 1; x <= a.x + a.w; x++) rim.push({ x, y: a.y - 1 }, { x, y: a.y + a.h });
        for (let y = a.y; y < a.y + a.h; y++) rim.push({ x: a.x - 1, y }, { x: a.x + a.w, y });
      } else {
        const by = a.y + a.h - 1;
        rim.push({ x: a.x - 1, y: by }, { x: a.x + a.w, y: by }, { x: a.x - 1, y: by + 1 }, { x: a.x + a.w, y: by + 1 });
      }
      rim.sort((p, q) => hash(p.x, p.y, seed) - hash(q.x, q.y, seed));
      let here = 0;
      for (const p of rim) {
        if (here >= (isPond ? 3 : 2)) break;
        if (touchesSmall(p.x, p.y)) continue;
        const piece = resolvePiece(tileset, palette.smalls[hash(p.x, p.y, seed + 7) % palette.smalls.length]!, hash(p.x, p.y, seed));
        if (piece && piece.width === 1 && piece.height === 1 && stamp(piece, p.x, p.y)) { here++; smalls++; smallAt.add(idx(p.x, p.y)); }
      }
    }
  }
  return { trees, smalls, pathCells, placed };
}

/** 지역 바닥(PALETTES 라벨)이 위층·이벤트 없이 비어 있는 가장 큰 사각형들 — 겹치지 않게 큰 순서로. within 이 있으면 그 안에서만. */
export function findEmptyGround(project: Project, map: GameMap, limit = 4, minArea = 6, within?: Rect): (Rect & { ground: string; cells: number; suggest: string })[] {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return [];
  const g = readGround(project, map);
  const W = map.width, H = map.height;
  const near = new Set<number>();
  for (const e of map.events) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.add((e.y + dy) * W + e.x + dx);
  const zone = within ?? { x: 0, y: 0, w: W, h: H };
  const open = (x: number, y: number) => { const i = y * W + x; return x >= zone.x && y >= zone.y && x < zone.x + zone.w && y < zone.y + zone.h && map.upperTiles[i] === -1 && !g.events.has(i) && !near.has(i) && g.ground(i); };
  const taken = new Set<number>();
  const out: (Rect & { ground: string; cells: number; suggest: string })[] = [];
  while (out.length < limit) {
    const heights = new Array<number>(W).fill(0);
    let best: Rect | null = null, bestArea = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) { const i = y * W + x; heights[x] = open(x, y) && !taken.has(i) ? heights[x]! + 1 : 0; }
      for (let x = 0; x < W; x++) {
        let h = Infinity;
        for (let x2 = x; x2 < W && heights[x2]! > 0; x2++) {
          h = Math.min(h, heights[x2]!);
          const w = x2 - x + 1, area = w * h;
          // 너무 가는 띠(폭·높이 2 미만)는 꾸밀 터가 아니다.
          if (w >= 2 && h >= 2 && area > bestArea) { bestArea = area; best = { x, y: y - h + 1, w, h }; }
        }
      }
    }
    if (!best || bestArea < minArea) break;
    for (let y = best.y; y < best.y + best.h; y++) for (let x = best.x; x < best.x + best.w; x++) taken.add(y * W + x);
    const ground = g.label(best.y * W + best.x);
    const c = makeLightCtx(project, map, g);
    const ctx = lotContext(c, best);
    const uses = LOT_USES[ground] ?? [];
    const suggest = (ctx.edge ? uses.find(u => u.edge) : ctx.yard ? uses.find(u => u.yard) : uses[0])?.label ?? "";
    out.push({ ...best, ground, cells: bestArea, suggest });
  }
  return out;
}

function insideBox(b: Rect, x: number, y: number): boolean { return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h; }

function makeLightCtx(project: Project, map: GameMap, g: ReturnType<typeof readGround>): Ctx {
  return { project, map, area: { x: 0, y: 0, w: map.width, h: map.height }, seed: 1, g, keep: new Set(), used: new Set(), margin: new Set(), stillReachable: () => true, clusters: [] };
}

/** 키트 시트 야외 맵인가(바닥 칸 1/4 이상이 PALETTES 지역 바닥) — 조수 노트·캠페인 꾸미기 둘 다 이 판정을 쓴다. */
export function isKitOutdoorMap(project: Project, map: GameMap | undefined): boolean {
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset?.structureKits?.length || map.mapRole === "interior") return false;
  let known = 0;
  for (const tile of map.lowerTiles) if (PALETTES[tileset.tileMeta?.[tile]?.label ?? ""]) known++;
  return known * 4 >= map.lowerTiles.length;
}
