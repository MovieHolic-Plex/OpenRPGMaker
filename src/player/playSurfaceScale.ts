import { PLAY_RESOLUTION } from "@/player/playResolution";

export type PlaySurfaceCropMetrics = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly visibleWidth: number;
  readonly visibleHeight: number;
};

export function calculatePlaySurfaceScale(
  viewportW: number,
  viewportH: number,
  logicalW: number = PLAY_RESOLUTION.width,
  logicalH: number = PLAY_RESOLUTION.height
): number {
  const safeViewportW = nonNegativeFinite(viewportW);
  const safeViewportH = nonNegativeFinite(viewportH);
  const safeLogicalW = positiveFiniteOr(logicalW, PLAY_RESOLUTION.width);
  const safeLogicalH = positiveFiniteOr(logicalH, PLAY_RESOLUTION.height);
  return Math.max(1, Math.ceil(safeViewportW / safeLogicalW), Math.ceil(safeViewportH / safeLogicalH));
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
  const safeScale = Math.max(1, Math.floor(nonNegativeFinite(scale)));
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

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function positiveFiniteOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
