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

/** 좌표 결정적 해시 노이즈(0..1) — 지면 변형이 시드·좌표에만 의존하게. */
function cellNoise(seed: number, x: number, y: number, channel: number): number {
  let h = (seed ^ Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1103515245, 2246822519) ^ Math.imul(channel + 1, 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2654435761) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
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
  const paintable = (x: number, y: number): boolean => PAINTABLE_LOWER.has(map.lowerTiles[idx(x, y)] ?? -1);

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

  // ── L1 지면 노이즈 ──
  if (p.groundNoise) {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (!paintable(x, y)) continue;
        if (pathCells.has(idx(x, y))) continue;
        const dark = cellNoise(seed, Math.floor(x / 3), Math.floor(y / 3), 7);
        if (dark < 0.16 + density * 0.1) {
          putLower(x, y, DARK_GRASS);
          continue;
        }
        const v = cellNoise(seed, x, y, 1);
        if (v < 0.14) {
          putLower(x, y, GRASS_VARIANTS[Math.floor(cellNoise(seed, x, y, 2) * GRASS_VARIANTS.length) % GRASS_VARIANTS.length]);
        } else {
          putLower(x, y, GRASS_BASE);
        }
      }
    }
  }

  // ── L5(경로 먼저 깔기 — 나무가 길을 밟지 않게) ──
  for (const cell of pathCells) {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    if (!paintable(x, y)) continue;
    putLower(x, y, DIRT_PATH);
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
      const dead = rng() < clamp(p.deadRatio, 0, 1);
      const species = dead ? DEAD_SPECIES : SPECIES[Math.floor(rng() * SPECIES.length) % SPECIES.length];
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
        putUpper(x, y, rng() < (clear > 0 ? 0.25 : 0.62) ? BUSH : FLOWER);
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
