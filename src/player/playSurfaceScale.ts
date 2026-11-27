import { PLAY_RESOLUTION } from "@/player/playResolution";

export type PlaySurfaceCropMetrics = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly visibleWidth: number;
  readonly visibleHeight: number;
};

/**
 * 플레이 서피스 배율 정책(정의·기본값 규칙은 project/playSurfaceScaleMode.ts).
 * - `adaptive`: 반응형 정수 도트 카메라. 창·기기 비율에 맞춰 논리 가로×세로를 동적으로 계산한다.
 * - `integer`: 도트 경계가 깨지지 않는 정수 배율, 남는 창은 여백. 1배보다 작은 창만 비정수로 줄인다.
 * - `fit`: contain 배율을 내림하지 않고 그대로 쓴다.
 */
import type { PlaySurfaceScaleMode } from "@/project/playSurfaceScaleMode";
export type { PlaySurfaceScaleMode };

export type PlaySurfacePlacement = {
  readonly left: number;
  readonly top: number;
};

export type AdaptiveViewportMetrics = {
  /** 화면 CSS px 당 게임 1px 배율(정수 또는 소수 DPR 에 맞춘 k/dpr). */
  readonly scale: number;
  /** 현재 뷰포트에 맞춰 계산된 동적 논리 가로(게임 px). */
  readonly logicalWidth: number;
  /** 현재 뷰포트에 맞춰 계산된 동적 논리 세로(게임 px). */
  readonly logicalHeight: number;
  /** 화면상 무대 가로(CSS px, logicalWidth * scale). */
  readonly stageWidth: number;
  /** 화면상 무대 세로(CSS px, logicalHeight * scale). */
  readonly stageHeight: number;
  readonly portrait: boolean;
};

export type AdaptiveViewportOptions = {
  readonly portrait?: boolean;
  /** 세로 풀블리드(9:19.5 등 긴 화면)에서는 세로 논리 상한을 480px 까지 열어 위아래 여백을 없앤다. */
  readonly fullbleed?: boolean;
  readonly devicePixelRatio?: number;
};

/** 반응형 카메라 시야의 안전 하한·상한(16px 타일 기준 최소 11칸 ~ 최대 40×25칸). */
export const ADAPTIVE_MIN_LOGICAL = 176;
export const ADAPTIVE_MAX_LOGICAL_WIDTH = 640;
export const ADAPTIVE_MAX_LOGICAL_HEIGHT = 400;
export const ADAPTIVE_PORTRAIT_FULLBLEED_MAX_HEIGHT = 480;

/**
 * 반응형 정수 도트 뷰포트 계산기(Viewport Solver, 2026-11-26).
 * 고정 해상도(480×270)를 축소·레터박스하는 대신, 현재 가용 영역(availW×availH)에서
 * 도트가 선명한 최적 정수 배율 z 를 고르고 그 배율로 영역을 꽉 채우는 논리 가로×세로를 돌려준다.
 *
 * 실측 예시(기준 480×270):
 * - iPhone 세로 DS 상단 (390×464): z=2 → 195×232 (타일 32px, 12.2×14.5칸)
 * - iPhone 세로 풀블리드 (390×844): z=2 → 195×422 (타일 32px, 여백 0%)
 * - Galaxy 세로 DS 상단 (360×428): z=2 → 180×214 (타일 32px, 11.25×13.4칸)
 * - 노트북 창 (1440×900): z=3 → 480×300 (타일 48px, 여백 0%)
 * - FHD 전체 (1920×1080): z=4 → 480×270 (타일 64px, 기존과 완벽 일치)
 * - QHD 전체 (2560×1440): z=5 → 512×288 (타일 80px, 여백 0%)
 */
export function calculateAdaptiveViewport(
  availW: number,
  availH: number,
  baseLogicalW: number = PLAY_RESOLUTION.width,
  baseLogicalH: number = PLAY_RESOLUTION.height,
  options: AdaptiveViewportOptions = {},
): AdaptiveViewportMetrics {
  const safeW = nonNegativeFinite(availW);
  const safeH = nonNegativeFinite(availH);
  const safeBaseW = positiveFiniteOr(baseLogicalW, PLAY_RESOLUTION.width);
  const safeBaseH = positiveFiniteOr(baseLogicalH, PLAY_RESOLUTION.height);
  const portrait = options.portrait ?? safeH > safeW;
  if (safeW === 0 || safeH === 0) {
    return {
      scale: 1,
      logicalWidth: safeBaseW,
      logicalHeight: safeBaseH,
      stageWidth: safeBaseW,
      stageHeight: safeBaseH,
      portrait,
    };
  }

  const baseShort = Math.min(safeBaseW, safeBaseH);
  // 세로 폰(폭 < 600)과 작은 폰 가로(높이 <= 460)는 타일이 작아지지 않게 짧은 변 목표를 200px(약 12.5칸)로 잡는다.
  // 태블릿 세로(폭 >= 600)는 240px, 데스크톱 가로는 프로젝트 기준 짧은 변(480×270 이면 270px)을 따른다.
  const shortAvail = Math.min(safeW, safeH);
  const targetShort = portrait
    ? Math.min(baseShort, safeW >= 600 ? 240 : 200)
    : safeH <= 460
      ? Math.min(baseShort, 200)
      : baseShort;

  const maxW = Math.max(ADAPTIVE_MAX_LOGICAL_WIDTH, safeBaseW);
  const maxH = options.fullbleed && portrait
    ? Math.max(ADAPTIVE_PORTRAIT_FULLBLEED_MAX_HEIGHT, safeBaseH)
    : Math.max(ADAPTIVE_MAX_LOGICAL_HEIGHT, safeBaseH);
  const minW = Math.min(ADAPTIVE_MIN_LOGICAL, safeBaseW);
  const minH = Math.min(ADAPTIVE_MIN_LOGICAL, safeBaseH);

  let z = Math.max(1, Math.round(shortAvail / Math.max(1, targetShort)));
  // 시야가 너무 넓어지지 않게(맵 밖 미완성 영역 노출 방지) 상한 초과 시 배율을 올린다.
  const minZoomForCap = Math.ceil(Math.max(safeW / maxW, safeH / maxH) - 1e-6);
  if (minZoomForCap > z) z = minZoomForCap;
  // 반대로 시야가 너무 좁아지지 않게(최소 11칸 보장) 하한 미만이면 배율을 내린다.
  while (z > 1 && (safeW / z < minW || safeH / z < minH)) {
    const nextZ = z - 1;
    if (safeW / nextZ > maxW || safeH / nextZ > maxH) break;
    z = nextZ;
  }

  // 소수 DPR(Windows 125%/150% 등)에서는 기기 화소 정수 배율(k/dpr)로 맞춰 도트 번짐을 막는다.
  const dpr = fractionalDevicePixelRatio(options.devicePixelRatio ?? 1);
  let scale = z;
  if (dpr) {
    const k = Math.max(1, Math.round(z * dpr));
    scale = k / dpr;
  }

  // ceil 로 영역을 빈틈없이 채우되 상한을 넘지 않는다(오버플로는 0~z-1px 이내라 중앙 정렬 시 1px 검은 띠도 없다).
  const logicalWidth = Math.max(1, Math.min(maxW, Math.ceil(safeW / scale)));
  const logicalHeight = Math.max(1, Math.min(maxH, Math.ceil(safeH / scale)));
  return {
    scale,
    logicalWidth,
    logicalHeight,
    stageWidth: logicalWidth * scale,
    stageHeight: logicalHeight * scale,
    portrait,
  };
}

export function calculatePlaySurfaceScale(
  viewportW: number,
  viewportH: number,
  logicalW: number = PLAY_RESOLUTION.width,
  logicalH: number = PLAY_RESOLUTION.height,
  mode: PlaySurfaceScaleMode = "integer",
  devicePixelRatio = 1,
): number {
  const safeViewportW = nonNegativeFinite(viewportW);
  const safeViewportH = nonNegativeFinite(viewportH);
  const safeLogicalW = positiveFiniteOr(logicalW, PLAY_RESOLUTION.width);
  const safeLogicalH = positiveFiniteOr(logicalH, PLAY_RESOLUTION.height);
  if (safeViewportW === 0 || safeViewportH === 0) return 1;
  if (mode === "adaptive") {
    return calculateAdaptiveViewport(safeViewportW, safeViewportH, safeLogicalW, safeLogicalH, {
      devicePixelRatio,
    }).scale;
  }
  const containScale = Math.min(safeViewportW / safeLogicalW, safeViewportH / safeLogicalH);
  if (mode === "fit") return containScale;
  // 소수 배율 화면(Windows 125%·150%, 일부 안드로이드 2.625): CSS 정수 배율이어도 기기 화소로는 1.875·3.75 처럼 소수라
  // 도트가 1·2화소로 번갈아 굵어졌다(2026-10-24 아스트라 해상도 점검). 기기 화소 기준 정수 k 를 고르고 CSS 배율은 k/dpr.
  const dpr = fractionalDevicePixelRatio(devicePixelRatio);
  if (dpr) {
    const k = Math.floor(containScale * dpr + 1e-6);
    if (k >= 1) return k / dpr;
    return containScale;
  }
  if (containScale < 1) return containScale;
  const whole = Math.max(1, Math.floor(containScale));
  // 1.5배 단계(2026-10-24): 정수 1배가 화면의 35% 넘게 비우면(아이패드 미니 등) 1.5배를 허용한다 — 최근접 확대라
  // 도트가 1·2화소로 번갈아 굵어지지만, 작은 1배보다 낫다. 2배 이상은 정수만 쓴다.
  if (whole === 1 && containScale >= 1.5 && (safeLogicalW * safeLogicalH) / (safeViewportW * safeViewportH) < INTEGER_FILL_MIN) return 1.5;
  return whole;
}

/** 정수가 아닌(그리고 유한한 양수) 기기 화소 비율만 돌려준다. 1·2·3 같은 정수 비율은 CSS 정수 배율이 곧 기기 정수 배율이라 손대지 않는다. */
function fractionalDevicePixelRatio(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.abs(value - Math.round(value)) > 1e-3 ? value : undefined;
}

/** 정수 배율이 화면을 이만큼은 채워야 한다 — 못 채우면 1.5배 단계를 허용한다. */
export const INTEGER_FILL_MIN = 0.65;

export function calculatePlaySurfaceCropMetrics(
  viewportW: number,
  viewportH: number,
  scale: number,
  logicalW: number = PLAY_RESOLUTION.width,
  logicalH: number = PLAY_RESOLUTION.height
): PlaySurfaceCropMetrics {
  const safeViewportW = nonNegativeFinite(viewportW);
  const safeViewportH = nonNegativeFinite(viewportH);
  const safeLogicalW = positiveFiniteOr(logicalW, PLAY_RESOLUTION.width);
  const safeLogicalH = positiveFiniteOr(logicalH, PLAY_RESOLUTION.height);
  const safeScale = positiveFiniteOr(scale, 1);
  const scaledW = safeLogicalW * safeScale;
  const scaledH = safeLogicalH * safeScale;
  const horizontalCrop = Math.max(0, (scaledW - safeViewportW) / (2 * safeScale));
  const verticalCrop = Math.max(0, (scaledH - safeViewportH) / (2 * safeScale));
  return {
    top: verticalCrop,
    right: horizontalCrop,
    bottom: verticalCrop,
    left: horizontalCrop,
    visibleWidth: Math.max(0, safeLogicalW - horizontalCrop * 2),
    visibleHeight: Math.max(0, safeLogicalH - verticalCrop * 2),
  };
}

export function calculatePlaySurfacePlacement(
  viewportW: number,
  viewportH: number,
  scale: number,
  logicalW: number = PLAY_RESOLUTION.width,
  logicalH: number = PLAY_RESOLUTION.height,
  devicePixelRatio = 1,
): PlaySurfacePlacement {
  const safeViewportW = nonNegativeFinite(viewportW);
  const safeViewportH = nonNegativeFinite(viewportH);
  const safeLogicalW = positiveFiniteOr(logicalW, PLAY_RESOLUTION.width);
  const safeLogicalH = positiveFiniteOr(logicalH, PLAY_RESOLUTION.height);
  const safeScale = positiveFiniteOr(scale, 1);
  // 정수 배율이면 무대 왼쪽 위도 정수 화면 px 에 둔다 — 홀수 여백의 반 화소(예: 1281px 창 → 160.5px)에 걸리면
  // 캔버스와 대화창 도트 글자가 통째로 반 화소 밀려 흐려진다. 맞춤(fit) 배율은 원래대로 가운데 정확히.
  // 소수 dpr 에서 기기 정수 배율(k/dpr)을 골랐으면 왼쪽 위도 기기 화소 격자(1/dpr)에 둔다.
  const dpr = fractionalDevicePixelRatio(devicePixelRatio) ?? 1;
  const deviceAligned = dpr !== 1 && Math.abs(safeScale * dpr - Math.round(safeScale * dpr)) < 1e-6;
  const snap = deviceAligned
    ? (value: number): number => Math.floor(value * dpr) / dpr
    : Number.isInteger(safeScale) ? Math.floor : (value: number): number => value;
  return {
    left: Math.max(0, snap((safeViewportW - safeLogicalW * safeScale) / 2)),
    top: Math.max(0, snap((safeViewportH - safeLogicalH * safeScale) / 2)),
  };
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function positiveFiniteOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
