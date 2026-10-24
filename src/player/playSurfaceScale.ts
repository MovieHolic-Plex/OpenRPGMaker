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
 * - `integer`: 도트 경계가 깨지지 않는 정수 배율, 남는 창은 여백. 1배보다 작은 창만 비정수로 줄인다.
 * - `fit`: contain 배율을 내림하지 않고 그대로 쓴다.
 */
import type { PlaySurfaceScaleMode } from "@/project/playSurfaceScaleMode";
export type { PlaySurfaceScaleMode };

export type PlaySurfacePlacement = {
  readonly left: number;
  readonly top: number;
};

export function calculatePlaySurfaceScale(
  viewportW: number,
  viewportH: number,
  logicalW: number = PLAY_RESOLUTION.width,
  logicalH: number = PLAY_RESOLUTION.height,
  mode: PlaySurfaceScaleMode = "integer"
): number {
  const safeViewportW = nonNegativeFinite(viewportW);
  const safeViewportH = nonNegativeFinite(viewportH);
  const safeLogicalW = positiveFiniteOr(logicalW, PLAY_RESOLUTION.width);
  const safeLogicalH = positiveFiniteOr(logicalH, PLAY_RESOLUTION.height);
  if (safeViewportW === 0 || safeViewportH === 0) return 1;
  const containScale = Math.min(safeViewportW / safeLogicalW, safeViewportH / safeLogicalH);
  if (mode === "fit") return containScale;
  return containScale < 1 ? containScale : Math.max(1, Math.floor(containScale));
}

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
): PlaySurfacePlacement {
  const safeViewportW = nonNegativeFinite(viewportW);
  const safeViewportH = nonNegativeFinite(viewportH);
  const safeLogicalW = positiveFiniteOr(logicalW, PLAY_RESOLUTION.width);
  const safeLogicalH = positiveFiniteOr(logicalH, PLAY_RESOLUTION.height);
  const safeScale = positiveFiniteOr(scale, 1);
  // 정수 배율이면 무대 왼쪽 위도 정수 화면 px 에 둔다 — 홀수 여백의 반 화소(예: 1281px 창 → 160.5px)에 걸리면
  // 캔버스와 대화창 도트 글자가 통째로 반 화소 밀려 흐려진다. 맞춤(fit) 배율은 원래대로 가운데 정확히.
  const snap = Number.isInteger(safeScale) ? Math.floor : (value: number): number => value;
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
