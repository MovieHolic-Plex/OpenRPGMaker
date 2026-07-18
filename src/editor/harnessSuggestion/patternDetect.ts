// harnessSuggestion/patternDetect.ts
// "보이지 않는 하네스" v2 §③ — 편집 스트림 패턴 탐지(로컬·결정적).
// 맵 데이터에서 "같은 세로 단면(높이 2~6)이 가로로 ≥3회 반복"되는 블록을 찾는다.
// LLM·랜덤 없음: 같은 맵이면 항상 같은 결과. 성 문법 역공학(반복 단면 실측) 기법의 엔진화.

import { TILE } from "@/project/defaults/constants";

export type PatternScanMap = {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
};

export type PatternRegion = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** 감지된 반복 단면 패턴 — unit(period×height)이 스탬프 재료, 나머지는 근거(발견 위치·반복 횟수). */
export type DetectedSectionPattern = {
  /** 반복 전체 스팬(맵 좌표). width = repeats * period. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly period: number;
  readonly repeats: number;
  readonly unit: {
    readonly width: number;
    readonly height: number;
    /** row-major(period×height). */
    readonly lower: readonly number[];
    readonly upper: readonly number[];
  };
  /** 세션 톰스톤/등록 중복 판정용 결정적 서명. */
  readonly signature: string;
};

export type DetectSectionOptions = {
  readonly minHeight?: number;
  readonly maxHeight?: number;
  readonly minRepeats?: number;
  readonly maxPeriod?: number;
  /** 최근 편집 영역 — 지정 시 이 사각형과 겹치는 후보만 인정한다("찍은 곳에서 배운다"). */
  readonly region?: PatternRegion;
};

const DEFAULTS = {
  minHeight: 2,
  maxHeight: 6,
  minRepeats: 3,
  maxPeriod: 4,
} as const;

/** 단위 블록이 "패턴"으로 인정받기 위한 최소 어휘 수 — 단색 채우기/2색 줄무늬 오탐 차단. */
const MIN_DISTINCT_TILES = 3;

/**
 * 맵에서 가장 그럴듯한 반복 단면 패턴 1개를 찾는다. 없으면 null.
 * 결정적: 후보 점수 = (트리밍 후 높이 × 스팬 폭), 동점이면 작은 period → 작은 y → 작은 x.
 */
export function detectRepeatedSectionPattern(
  map: PatternScanMap,
  options: DetectSectionOptions = {},
): DetectedSectionPattern | null {
  const minHeight = options.minHeight ?? DEFAULTS.minHeight;
  const maxHeight = options.maxHeight ?? DEFAULTS.maxHeight;
  const minRepeats = options.minRepeats ?? DEFAULTS.minRepeats;
  const maxPeriod = options.maxPeriod ?? DEFAULTS.maxPeriod;
  if (map.width <= 0 || map.height <= 0) return null;

  const background = dominantLowerTile(map);
  let best: DetectedSectionPattern | null = null;
  let bestScore = -1;

  for (let h = Math.min(maxHeight, map.height); h >= minHeight; h -= 1) {
    for (let y0 = 0; y0 + h <= map.height; y0 += 1) {
      const signatures = columnSignatures(map, y0, h);
      for (let period = 1; period <= maxPeriod; period += 1) {
        for (const run of periodicRuns(signatures, period, minRepeats)) {
          const candidate = finalizeCandidate(map, {
            background,
            minHeight,
            minRepeats,
            period,
            runStart: run.start,
            runWidth: run.width,
            y0,
            h,
          });
          if (!candidate) continue;
          if (options.region && !intersects(candidate, options.region)) continue;
          const score = candidate.height * candidate.width;
          if (
            score > bestScore
            || (score === bestScore && best !== null && candidateOrderBefore(candidate, best))
          ) {
            best = candidate;
            bestScore = score;
          }
        }
      }
    }
  }
  return best;
}

/** 패턴 서명 — 등록/무시 목록과의 결정적 대조 키. */
export function sectionPatternSignature(unit: {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}): string {
  return `s1:${unit.width}x${unit.height}:${unit.lower.join(",")}|${unit.upper.join(",")}`;
}

// ── 내부 ──────────────────────────────────────────────────────────────

type RawRun = { readonly start: number; readonly width: number };

/** 밴드(y0..y0+h-1)의 각 열 서명 — 하위+상위 타일 튜플 문자열. */
function columnSignatures(map: PatternScanMap, y0: number, h: number): string[] {
  const out: string[] = [];
  for (let x = 0; x < map.width; x += 1) {
    const parts: number[] = [];
    for (let y = y0; y < y0 + h; y += 1) {
      const index = y * map.width + x;
      parts.push(map.lowerTiles[index] ?? TILE.EMPTY, map.upperTiles[index] ?? TILE.EMPTY);
    }
    out.push(parts.join(","));
  }
  return out;
}

/**
 * signatures 에서 주기 period 로 반복되는 최대 구간들(폭 ≥ period*minRepeats)을 찾는다.
 * 구간 [start, start+width) 의 불변식: x ∈ [start+period, start+width) 에서 sig[x] === sig[x-period].
 */
function periodicRuns(signatures: readonly string[], period: number, minRepeats: number): RawRun[] {
  const runs: RawRun[] = [];
  const width = signatures.length;
  if (width < period * minRepeats) return runs;
  let runStart = 0;
  for (let x = period; x <= width; x += 1) {
    const continues = x < width && signatures[x] === signatures[x - period];
    if (continues) continue;
    const runWidth = x - runStart;
    if (runWidth >= period * minRepeats) runs.push({ start: runStart, width: runWidth });
    // 불일치 지점 x 를 비교에서 제외하려면 새 시작점은 x-period+1 이상이어야 한다
    // (새 구간의 첫 비교가 x+1 부터 일어나도록 — 앞 period 칸은 검증이 필요 없는 시드).
    runStart = x - period + 1;
  }
  return runs;
}

function finalizeCandidate(
  map: PatternScanMap,
  input: {
    readonly background: number;
    readonly minHeight: number;
    readonly minRepeats: number;
    readonly period: number;
    readonly runStart: number;
    readonly runWidth: number;
    readonly y0: number;
    readonly h: number;
  },
): DetectedSectionPattern | null {
  const repeats = Math.floor(input.runWidth / input.period);
  if (repeats < input.minRepeats) return null;
  const spanWidth = repeats * input.period;
  const spanX = input.runStart;

  // 배경(최빈 하위 타일) 단색 행을 밴드 상/하단에서 걷어낸다 — 잔디 여백이 패턴에 붙는 것 방지.
  let top = input.y0;
  let bottom = input.y0 + input.h - 1;
  while (top <= bottom && isBackgroundRow(map, top, spanX, spanWidth, input.background)) top += 1;
  while (bottom >= top && isBackgroundRow(map, bottom, spanX, spanWidth, input.background)) bottom -= 1;
  const height = bottom - top + 1;
  if (height < input.minHeight) return null;

  const lower: number[] = [];
  const upper: number[] = [];
  const distinct = new Set<number>();
  for (let y = top; y <= bottom; y += 1) {
    for (let dx = 0; dx < input.period; dx += 1) {
      const index = y * map.width + spanX + dx;
      const lowerTile = map.lowerTiles[index] ?? TILE.EMPTY;
      const upperTile = map.upperTiles[index] ?? TILE.EMPTY;
      lower.push(lowerTile);
      upper.push(upperTile);
      if (lowerTile !== TILE.EMPTY) distinct.add(lowerTile);
      if (upperTile !== TILE.EMPTY) distinct.add(upperTile);
    }
  }
  // 어휘 하한: 단색/2색 채우기·줄무늬는 패턴이 아니다.
  if (distinct.size < MIN_DISTINCT_TILES) return null;

  const unit = { width: input.period, height, lower, upper } as const;
  return {
    x: spanX,
    y: top,
    width: spanWidth,
    height,
    period: input.period,
    repeats,
    unit,
    signature: sectionPatternSignature(unit),
  };
}

function isBackgroundRow(
  map: PatternScanMap,
  y: number,
  x0: number,
  width: number,
  background: number,
): boolean {
  for (let x = x0; x < x0 + width; x += 1) {
    const index = y * map.width + x;
    if ((map.lowerTiles[index] ?? TILE.EMPTY) !== background) return false;
    if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) return false;
  }
  return true;
}

function dominantLowerTile(map: PatternScanMap): number {
  const counts = new Map<number, number>();
  for (const tile of map.lowerTiles) {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
  let bestTile: number = TILE.GRASS;
  let bestCount = -1;
  for (const [tile, count] of counts) {
    if (count > bestCount || (count === bestCount && tile < bestTile)) {
      bestTile = tile;
      bestCount = count;
    }
  }
  return bestTile;
}

function intersects(a: PatternRegion, b: PatternRegion): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function candidateOrderBefore(a: DetectedSectionPattern, b: DetectedSectionPattern): boolean {
  if (a.period !== b.period) return a.period < b.period;
  if (a.y !== b.y) return a.y < b.y;
  return a.x < b.x;
}
