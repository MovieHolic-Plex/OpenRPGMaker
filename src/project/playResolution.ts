import type { PlayResolution, SystemRecords } from "@/project/types";

export const DEFAULT_PLAY_RESOLUTION: Readonly<PlayResolution> = Object.freeze({
  width: 320,
  height: 240,
});

export const PLAY_RESOLUTION_LIMITS = Object.freeze({
  minWidth: 320,
  maxWidth: 1920,
  minHeight: 240,
  maxHeight: 1080,
});

/**
 * Normalize an authored logical viewport. The default is stored by omission so
 * legacy projects and explicit 320x240 projects have the same wire shape.
 */
export function normalizePlayResolution(value: unknown): PlayResolution | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as { readonly width?: unknown; readonly height?: unknown };
  const width = clampDimension(
    candidate.width,
    DEFAULT_PLAY_RESOLUTION.width,
    PLAY_RESOLUTION_LIMITS.minWidth,
    PLAY_RESOLUTION_LIMITS.maxWidth,
  );
  const height = clampDimension(
    candidate.height,
    DEFAULT_PLAY_RESOLUTION.height,
    PLAY_RESOLUTION_LIMITS.minHeight,
    PLAY_RESOLUTION_LIMITS.maxHeight,
  );
  if (width === DEFAULT_PLAY_RESOLUTION.width && height === DEFAULT_PLAY_RESOLUTION.height) return undefined;
  return { width, height };
}

export function resolvePlayResolution(
  system: Pick<SystemRecords, "playResolution"> | undefined,
): Readonly<PlayResolution> {
  return normalizePlayResolution(system?.playResolution) ?? DEFAULT_PLAY_RESOLUTION;
}

function clampDimension(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, numeric));
}
