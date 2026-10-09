// editor/regionTask/forestWrites.ts
// forest 오퍼레이터 프로토타입 — 시드 기반 결정적 숲 생성기.
//
// 왜(2026-09-01): "숲을 울창하게" 는 지금 LLM 이 scatter/fill 을 즉흥 조합해 균일 산포로
// 수렴한다(전용 생성기 부재). 이 모듈은 그 반대 증명이다 — LLM 없이 파라미터·시드만으로
// 군집 캐노피 + 수종 혼합 + 하층식생 + 공터 + 오솔길을 ms 단위로 만든다.
// 산출물은 RegionWrite[] 뿐이라 기존 영역작업 하네스(runMock → pending 승인)를 그대로 탄다.
//
// 타일 규약(combined_town, tilesetHarness/combinedTown.ts):
//  · 나무 = 밑동 lower(x,y) + 수관 upper(x,y-1). 수관이 아랫나무 밑동 칸의 upper 에
//    겹치면 "숲"(공식 지원 — placementTools.ts:145 레이어 겹침 허용과 같은 규칙).
//  · 수관/밑동 페어: 활엽 260/290·262/292, 고사목 261/291.
//  · 통행 가능 지면만 밟는다: 잔디 가족 + 흙길 391. (rpg-zzu-tile-passability)

import type { ResolvedMaterialSlots } from "@/editor/operators/materialSlots";
import type { RegionRect } from "./clipToRegion";

export type ForestRegionWrite = {
  readonly layer: "lower" | "upper";
  readonly x: number;
  readonly y: number;
  readonly tile: number;
};

/** 생성기가 읽는 최소 맵 형태 — GameMap 부분집합(테스트에서 가짜 주입 가능). */
export interface ForestMapView {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
}

export interface ForestParams {
  /** 0..1 — "울창함". 나무 확률·군집 크기·하층식생을 함께 민다. */
  readonly density?: number;
  /** 0..1 — 고사목 비율. */
  readonly deadRatio?: number;
  /** 0..1 — 덤불·꽃 하층식생 강도. */
  readonly underbrush?: number;
  /** 공터 개수(0이면 없음). */
  readonly clearings?: number;
  /** 좌우를 잇는 흙 오솔길을 낼지. */
  readonly path?: boolean;
  /** 지면 잔디 변형 노이즈를 깔지(끄면 기존 지면 유지). */
  readonly groundNoise?: boolean;
}

const DEFAULTS: Required<ForestParams> = {
  density: 0.6,
  deadRatio: 0.08,
  underbrush: 0.5,
  clearings: 1,
  path: true,
  groundNoise: true,
};

// ── 팔레트 ──
// forest 가 아는 재료의 전부. 슬롯에서 유도하며(materialSlots.ts), 슬롯이 비면 아래
// combined_town 기본값으로 떨어진다 — 재료가 없다고 기능이 죽지는 않게.
export interface ForestPalette {
  readonly groundBase: number;
  readonly groundVariants: readonly number[];
  readonly groundDark: number;
  readonly path: number | null;
  /** [수관(upper), 밑동(lower)] 쌍. 비어 있으면 나무를 심지 않는다. */
  readonly species: readonly (readonly [number, number])[];
  readonly dead: readonly [number, number] | null;
  readonly bush: number | null;
  readonly flower: number | null;
  /** 이 위에만 그린다. 집·벽·물 등 기성 구조물 보호선. */
  readonly paintable: ReadonlySet<number>;
}

// ── 타일 상수(combined_town 30×16 인덱스) ──
const GRASS_BASE = 240;
/** 지면 노이즈에 섞는 잔디 변형 — 전부 통행 가능 확인 목록에 있는 것만. */
const GRASS_VARIANTS = [270, 271, 272, 300, 301, 302, 330] as const;
const DARK_GRASS = 303;
const DIRT_PATH = 391;
/** 이 가족 위에만 숲을 그린다 — 집/벽/물 등 기성 구조물은 건드리지 않는다. */
const PAINTABLE_LOWER = new Set<number>([
  GRASS_BASE, 241, 242, 243, 244, 245,
  270, 271, 272, 273, 274, 275,
  300, 301, 302, DARK_GRASS, 304, 305,
  330, 331, 332, 333, 334, 335,
  DIRT_PATH, 390, 392,
]);
/** 수종: [수관, 밑동]. */
const SPECIES: readonly (readonly [number, number])[] = [
  [260, 290],
  [262, 292],
];
const DEAD_SPECIES: readonly [number, number] = [261, 291];
const BUSH = 289;
const FLOWER = 348;
const EMPTY_UPPER = -1;

/** combined_town 기본 팔레트 — 슬롯이 비었을 때의 폴백이자, 슬롯 유도의 회귀 기준선. */
export const COMBINED_TOWN_FOREST_PALETTE: ForestPalette = {
  groundBase: GRASS_BASE,
  groundVariants: GRASS_VARIANTS,
  groundDark: DARK_GRASS,
  path: DIRT_PATH,
  species: SPECIES,
  dead: DEAD_SPECIES,
  bush: BUSH,
  flower: FLOWER,
  paintable: PAINTABLE_LOWER,
};

/**
 * 재료 슬롯 → forest 팔레트. 슬롯이 없는 항목은 기본 팔레트 값을 그대로 쓴다
 * (예: 나무 슬롯만 있는 칩셋이면 지면은 기본값으로 칠하고 나무만 그 칩셋 것으로 심는다).
 */
export function forestPaletteFromSlots(slots: ResolvedMaterialSlots | undefined): ForestPalette {
  const base = COMBINED_TOWN_FOREST_PALETTE;
  if (!slots) return base;
  const ground = slots.ground;
  const groundAlt = slots.groundAlt;
  const path = slots.path;
  // 수종은 슬롯에 잡힌 것을 전부 쓴다 — 한 종만 심으면 "뻔한 숲" 이 그대로 재발한다.
  const species: (readonly [number, number])[] = (slots.tree?.pairs ?? (slots.tree?.pair ? [slots.tree.pair] : []))
    .map((pair) => [pair.top, pair.bottom] as const);
  const deadPair = slots.treeDead?.pair;
  // 고사목 폴백은 **나무 재료가 통째로 없을 때만**. 낯선 칩셋에 combined_town 마른나무(261/291)가
  // 섞여 들어가면 그 칩셋에 없는 타일이 맵에 박힌다.
  const dead = deadPair
    ? ([deadPair.top, deadPair.bottom] as const)
    : (species.length > 0 ? null : base.dead);
  // 지면으로 인정할 칸: 기본 보호선 + 이번 팔레트가 실제로 까는 지면·길 타일.
  const paintable = new Set<number>(base.paintable);
  for (const tile of ground?.tiles ?? []) paintable.add(tile);
  for (const tile of groundAlt?.tiles ?? []) paintable.add(tile);
  for (const tile of path?.tiles ?? []) paintable.add(tile);
  return {
    // body 를 쓴다 — 오토타일 그룹의 tileIds[0] 은 모서리라 한 칸 칠하기에 맞지 않는다.
    groundBase: ground?.body ?? ground?.tiles[0] ?? base.groundBase,
    groundVariants: ground && ground.tiles.length > 1 ? ground.tiles.slice(1) : base.groundVariants,
    groundDark: groundAlt?.body ?? groundAlt?.tiles[0] ?? base.groundDark,
    path: path?.body ?? path?.tiles[0] ?? base.path,
    species: species.length > 0 ? species : base.species,
    dead,
    bush: slots.bush?.tiles[0] ?? base.bush,
    flower: slots.flower?.tiles[0] ?? base.flower,
    paintable,
  };
}

/** mulberry32 — 시드 결정적 PRNG. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Vec = { readonly x: number; readonly y: number };

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface ForestBuildResult {
  readonly writes: readonly ForestRegionWrite[];
  /** 진단용 — 심은 나무 수(고사목 포함). */
  readonly trees: number;
}

/**
 * 숲 writes 를 계산한다. 순수 함수 — 같은 (map, region, params, seed) 는 항상 같은 결과.
 * 영역 밖·비지면(구조물) 칸은 절대 쓰지 않는다. 수관(y-1)이 영역을 벗어나는 자리는 심지 않는다.
 */
export function buildForestWrites(
  map: ForestMapView,
  region: RegionRect,
  params: ForestParams = {},
  seed = 1,
  palette: ForestPalette = COMBINED_TOWN_FOREST_PALETTE,
): ForestBuildResult {
  const p = { ...DEFAULTS, ...params };
  const density = clamp(p.density, 0, 1);
  const rng = makeRng(seed);
  const x0 = Math.max(0, region.x);
  const y0 = Math.max(0, region.y);
  const x1 = Math.min(map.width - 1, region.x + region.width - 1);
  const y1 = Math.min(map.height - 1, region.y + region.height - 1);
  if (x1 < x0 || y1 < y0) return { writes: [], trees: 0 };
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const idx = (x: number, y: number): number => y * map.width + x;
  const paintable = (x: number, y: number): boolean => palette.paintable.has(map.lowerTiles[idx(x, y)] ?? -1);

  // ── 군집 중심(밀도가 높을수록 많고 넓게) ──
  const clusterCount = Math.max(1, Math.round((w * h) / 130) + Math.round(density * 2));
  const clusters: Vec[] = [];
  for (let i = 0; i < clusterCount; i += 1) {
    clusters.push({ x: x0 + rng() * (w - 1), y: y0 + rng() * (h - 1) });
  }
  const clusterRadius = Math.max(3, Math.min(w, h) * (0.28 + density * 0.34));
  const clusterScore = (x: number, y: number): number => {
    let best = Infinity;
    for (const c of clusters) {
      const dx = x - c.x;
      const dy = y - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) best = d;
    }
    return clamp(1 - best / clusterRadius, 0, 1);
  };

  // ── 공터(타원 마스크) ──
  const clearings: { c: Vec; rx: number; ry: number }[] = [];
  for (let i = 0; i < Math.max(0, Math.round(p.clearings)); i += 1) {
    clearings.push({
      c: { x: x0 + (0.25 + rng() * 0.5) * w, y: y0 + (0.25 + rng() * 0.5) * h },
      rx: Math.max(2, w * (0.12 + rng() * 0.1) * (1.25 - density * 0.5)),
      ry: Math.max(2, h * (0.14 + rng() * 0.1) * (1.25 - density * 0.5)),
    });
  }
  const inClearing = (x: number, y: number): number => {
    let m = 0;
    for (const cl of clearings) {
      const dx = (x - cl.c.x) / cl.rx;
      const dy = (y - cl.c.y) / cl.ry;
      const d = dx * dx + dy * dy;
      if (d < 1) m = Math.max(m, 1 - d);
    }
    return m; // 0=밖, →1 중심
  };

  // ── 오솔길: 서→동 랜덤워크(폭 1). 통행 회랑을 구성 단계에서 보장한다 ──
  const pathCells = new Set<number>();
  if (p.path && w >= 6) {
    let py = Math.round(y0 + h * (0.35 + rng() * 0.3));
    let sinceTurn = 2; // 연속 세로 이동 금지 — 폭 1 을 유지해 길이 진창으로 뭉치지 않게.
    for (let x = x0; x <= x1; x += 1) {
      pathCells.add(idx(x, py));
      if (sinceTurn < 2 || x >= x1) {
        sinceTurn += 1;
        continue;
      }
      // 공터를 지나도록 살짝 끌어당기고, 아니면 랜덤 드리프트.
      const pull = clearings.length > 0 ? Math.sign(clearings[0].c.y - py) : 0;
      const r = rng();
      let dy = 0;
      if (r < 0.16) dy = -1;
      else if (r > 0.84) dy = 1;
      if (pull !== 0 && dy === 0 && rng() < 0.15) dy = pull;
      const ny = clamp(py + dy, y0 + 1, y1 - 1);
      if (ny !== py) {
        py = ny;
        pathCells.add(idx(x, py)); // 세로 이동 칸도 길로 — 대각 단절 방지.
        sinceTurn = 0;
      } else {
        sinceTurn += 1;
      }
    }
  }

  const writes: ForestRegionWrite[] = [];
  const lowerOut = new Map<number, number>();
  const upperOut = new Map<number, number>();
  const putLower = (x: number, y: number, tile: number): void => {
    lowerOut.set(idx(x, y), tile);
  };
  const putUpper = (x: number, y: number, tile: number): void => {
    upperOut.set(idx(x, y), tile);
  };

  // 1×1 풀(키큰 풀·잔디 변형)은 깔지 않는다 — 오토타일 조각이 네모로 뜬다.
  // groundNoise 토글은 호환을 위해 받지만 풀 변형을 쓰지 않는다.

  // ── L5(경로 먼저 깔기 — 나무가 길을 밟지 않게) ──
  for (const cell of pathCells) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    if (!paintable(x, y)) continue;
    if (palette.path !== null) putLower(x, y, palette.path);
  }

  // ── L2·L3 나무: 군집 점수 × 밀도, 위(수관 칸)가 영역 안일 때만 ──
  const trunkCells = new Set<number>();
  let trees = 0;
  for (let y = y0 + 1; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const cell = idx(x, y);
      const above = idx(x, y - 1);
      if (!paintable(x, y) || !paintable(x, y - 1)) continue;
      if (pathCells.has(cell) || pathCells.has(above)) continue;
      // 길에 붙은 칸은 확률을 깎아 회랑을 넓힌다(캐노피가 시각적으로 덮는 건 허용).
      const nearPath = pathCells.has(idx(clamp(x - 1, x0, x1), y)) || pathCells.has(idx(clamp(x + 1, x0, x1), y)) || pathCells.has(idx(x, clamp(y + 1, y0, y1)));
      const clear = inClearing(x, y);
      const stagger = (x + y) % 2 === 0 ? 1 : 0.55; // 지그재그 — 균일 격자 방지.
      const prob = density * (0.22 + clusterScore(x, y) * 0.78) * stagger
        * (1 - clear * 0.96)
        * (nearPath ? 0.35 : 1);
      if (rng() >= prob) continue;
      // 수직 겹침은 허용(그게 "숲")하되, 같은 칸 중복 밑동만 금지.
      if (trunkCells.has(cell)) continue;
      const wantsDead = rng() < clamp(p.deadRatio, 0, 1);
      const living = palette.species;
      const dead = wantsDead && palette.dead ? palette.dead : undefined;
      if (!dead && living.length === 0) continue; // 나무 재료가 없는 칩셋 — 지면만 칠하고 끝낸다.
      const species = dead ?? living[Math.floor(rng() * living.length) % living.length]!;
      putUpper(x, y - 1, species[0]);
      putLower(x, y, species[1]);
      trunkCells.add(cell);
      trees += 1;
    }
  }

  // ── L4 하층식생: 트인 잔디 위 upper 소품. 밑동·수관·길 위엔 놓지 않는다 ──
  const ub = clamp(p.underbrush, 0, 1);
  if (ub > 0) {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const cell = idx(x, y);
        if (!paintable(x, y) || trunkCells.has(cell) || pathCells.has(cell)) continue;
        if (upperOut.has(cell)) continue; // 수관 자리.
        const nearTree = trunkCells.has(idx(clamp(x - 1, x0, x1), y)) || trunkCells.has(idx(clamp(x + 1, x0, x1), y))
          || trunkCells.has(idx(x, clamp(y + 1, y0, y1))) || trunkCells.has(idx(x, clamp(y - 1, y0, y1)));
        const clear = inClearing(x, y);
        const prob = ub * (nearTree ? 0.16 : 0.045) + clear * ub * 0.05; // 공터엔 꽃이 조금.
        if (rng() >= prob) continue;
        const wantsBush = rng() < (clear > 0 ? 0.25 : 0.62);
        const prop = (wantsBush ? palette.bush : palette.flower) ?? palette.flower ?? palette.bush;
        if (prop !== null && prop !== undefined) putUpper(x, y, prop);
      }
    }
  }

  // ── 변경 없는 write 제거 후 방출(청크 최소화) ──
  for (const [cell, tile] of lowerOut) {
    if ((map.lowerTiles[cell] ?? -1) === tile) continue;
    writes.push({ layer: "lower", x: cell % map.width, y: Math.floor(cell / map.width), tile });
  }
  for (const [cell, tile] of upperOut) {
    if ((map.upperTiles[cell] ?? EMPTY_UPPER) === tile) continue;
    writes.push({ layer: "upper", x: cell % map.width, y: Math.floor(cell / map.width), tile });
  }
  return { writes, trees };
}
