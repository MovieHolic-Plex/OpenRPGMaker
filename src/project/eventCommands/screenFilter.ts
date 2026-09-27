import type { M2CommandFields } from "@/project/types";

/**
 * Tint Screen 의 색 필터(채도·흑백·세피아). 색조(tint 오버레이)와 별개로 화면 그림 자체의 색을 바꾼다.
 * 필드는 `.play-stage` 오버레이의 backdrop-filter, 전투는 `.battle-field` 의 filter 가 같은 CSS 문자열을 쓴다.
 *
 * 세 값 모두 퍼센트다. saturation 100 · grayscale 0 · sepia 0 이 "필터 없음"이며, 필드가 없는
 * 옛 Tint Screen 명령도 그 값으로 읽혀 예전과 똑같이 동작한다.
 */
export type ScreenFilter = {
  /** 채도 0~200(%). 100 = 원래 채도. */
  readonly saturation: number;
  /** 흑백 0~100(%). */
  readonly grayscale: number;
  /** 세피아 0~100(%). */
  readonly sepia: number;
};

export const NEUTRAL_SCREEN_FILTER: ScreenFilter = { saturation: 100, grayscale: 0, sepia: 0 };

export const SCREEN_FILTER_LIMITS = {
  saturation: { min: 0, max: 200 },
  grayscale: { min: 0, max: 100 },
  sepia: { min: 0, max: 100 },
} as const;

function clampPercent(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

/** 명령 필드에서 필터를 읽는다. 빠진 키는 중립값이다. */
export function screenFilterFromFields(fields: M2CommandFields): ScreenFilter {
  return normalizeScreenFilter({
    saturation: fields.saturation as number | undefined,
    grayscale: fields.grayscale as number | undefined,
    sepia: fields.sepia as number | undefined,
  });
}

export function normalizeScreenFilter(value: Partial<Record<keyof ScreenFilter, unknown>> | undefined): ScreenFilter {
  return {
    saturation: clampPercent(value?.saturation, 100, SCREEN_FILTER_LIMITS.saturation.min, SCREEN_FILTER_LIMITS.saturation.max),
    grayscale: clampPercent(value?.grayscale, 0, SCREEN_FILTER_LIMITS.grayscale.min, SCREEN_FILTER_LIMITS.grayscale.max),
    sepia: clampPercent(value?.sepia, 0, SCREEN_FILTER_LIMITS.sepia.min, SCREEN_FILTER_LIMITS.sepia.max),
  };
}

export function isNeutralScreenFilter(filter: ScreenFilter | undefined): boolean {
  if (!filter) return true;
  return filter.saturation === 100 && filter.grayscale === 0 && filter.sepia === 0;
}

/** CSS filter 함수 목록. 중립이면 빈 문자열 — 호출부는 속성 자체를 지운다. */
export function screenFilterCss(filter: ScreenFilter | undefined): string {
  if (!filter || isNeutralScreenFilter(filter)) return "";
  const parts: string[] = [];
  if (filter.saturation !== 100) parts.push(`saturate(${round(filter.saturation)}%)`);
  if (filter.grayscale !== 0) parts.push(`grayscale(${round(filter.grayscale)}%)`);
  if (filter.sepia !== 0) parts.push(`sepia(${round(filter.sepia)}%)`);
  return parts.join(" ");
}

/** 색조 트윈과 같은 t(0~1)로 필터를 보간한다. */
export function interpolateScreenFilter(from: ScreenFilter, to: ScreenFilter, t: number): ScreenFilter {
  const k = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 1));
  return {
    saturation: from.saturation + (to.saturation - from.saturation) * k,
    grayscale: from.grayscale + (to.grayscale - from.grayscale) * k,
    sepia: from.sepia + (to.sepia - from.sepia) * k,
  };
}

export function screenFilterEqual(a: ScreenFilter, b: ScreenFilter): boolean {
  return Math.abs(a.saturation - b.saturation) < 0.05
    && Math.abs(a.grayscale - b.grayscale) < 0.05
    && Math.abs(a.sepia - b.sepia) < 0.05;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
