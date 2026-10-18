import type { PlayResolution, Project, SystemRecords } from "@/project/types";

export const DEFAULT_PLAY_RESOLUTION: Readonly<PlayResolution> = Object.freeze({
  width: 320,
  height: 240,
});

/** 전신 양쪽 스탠딩(dual-fullbody-veil) 대화창 프리셋의 기본 고해상도 논리 화면(1024×768, 4:3)과 카메라 배율(3.2배 = 20×15타일 시야 유지). */
export const HIGH_RES_FULLBODY_PLAY_RESOLUTION: Readonly<PlayResolution> = Object.freeze({
  width: 1024,
  height: 768,
});

export const HIGH_RES_FULLBODY_CAMERA_ZOOM = 3.2;

export function isCrampedFullbodyPlayResolution(
  resolution: Readonly<PlayResolution> | undefined,
): boolean {
  return !resolution || (resolution.width <= 480 && resolution.height <= 320);
}

export function ensureHighResFullbodyPlayResolution(
  system: Pick<SystemRecords, "playResolution" | "cameraZoom">,
): boolean {
  if (!isCrampedFullbodyPlayResolution(system.playResolution)) return false;
  system.playResolution = { ...HIGH_RES_FULLBODY_PLAY_RESOLUTION };
  if (system.cameraZoom === undefined) {
    system.cameraZoom = HIGH_RES_FULLBODY_CAMERA_ZOOM;
  }
  return true;
}
export const PLAY_RESOLUTION_LIMITS = Object.freeze({
  minWidth: 320,
  maxWidth: 1920,
  minHeight: 240,
  maxHeight: 1080,
});

export const PLAY_RESOLUTION_REFERENCE_TILE_SIZE = 16;

export type PlayResolutionAnalysis = {
  readonly aspectWidth: number;
  readonly aspectHeight: number;
  readonly tileColumns: number;
  readonly tileRows: number;
  readonly minMapWidth: number;
  readonly minMapHeight: number;
  readonly partialTileX: boolean;
  readonly partialTileY: boolean;
  readonly incompatibleMaps: readonly {
    readonly id: string;
    readonly name: string;
    readonly width: number;
    readonly height: number;
  }[];
};

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
  system: Pick<SystemRecords, "playResolution" | "dialogueStyle"> | undefined,
): Readonly<PlayResolution> {
  const normalized = normalizePlayResolution(system?.playResolution);
  if (system?.dialogueStyle === "dual-fullbody-veil" && isCrampedFullbodyPlayResolution(normalized)) {
    return HIGH_RES_FULLBODY_PLAY_RESOLUTION;
  }
  return normalized ?? DEFAULT_PLAY_RESOLUTION;
}

export function analyzePlayResolution(
  resolution: Readonly<PlayResolution>,
  maps: Project["maps"],
  referenceTileSize: number = PLAY_RESOLUTION_REFERENCE_TILE_SIZE,
): PlayResolutionAnalysis {
  const tileSize = Number.isFinite(referenceTileSize) && referenceTileSize > 0
    ? referenceTileSize
    : PLAY_RESOLUTION_REFERENCE_TILE_SIZE;
  const divisor = greatestCommonDivisor(resolution.width, resolution.height);
  const incompatibleMaps = Object.values(maps)
    .filter((map) => {
      const mapTileSize = Number.isFinite(map.tileSize) && map.tileSize > 0 ? map.tileSize : tileSize;
      return map.width * mapTileSize < resolution.width || map.height * mapTileSize < resolution.height;
    })
    .map((map) => ({ id: map.id, name: map.name, width: map.width, height: map.height }));

  return {
    aspectWidth: resolution.width / divisor,
    aspectHeight: resolution.height / divisor,
    tileColumns: resolution.width / tileSize,
    tileRows: resolution.height / tileSize,
    minMapWidth: Math.ceil(resolution.width / tileSize),
    minMapHeight: Math.ceil(resolution.height / tileSize),
    partialTileX: resolution.width % tileSize !== 0,
    partialTileY: resolution.height % tileSize !== 0,
    incompatibleMaps,
  };
}

function clampDimension(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(min, Math.min(max, numeric));
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.max(1, Math.trunc(Math.abs(left)));
  let b = Math.max(1, Math.trunc(Math.abs(right)));
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}
