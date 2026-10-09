/**
 * Chipset water animation strips.
 *
 * Lake/canal shore+body: horizontal triplets on the sheet, 3 fps
 *   base → base+1 → base+2
 *
 * Waterfall (Combined Town col 3): vertical 4-frame loop, 4 fps
 *   123 → 153 → 183 → 213
 * Optional foam/frame columns share the same vertical timing:
 *   124 → 154 → 184 → 214
 *   125 → 155 → 185 → 215
 */

export const CHIPSET_ANIMATION_FPS = 3;
export const CHIPSET_ANIMATION_FRAME_COUNT = 3;
export const WATERFALL_ANIMATION_FPS = 4;

export type ChipsetAnimationStrip = {
  readonly key: string;
  readonly baseTile: number;
  readonly frames: readonly number[];
  readonly fps: number;
};

/** Horizontal 3-frame water bases (lake + canal). Waterfall bases excluded. */
const HORIZONTAL_WATER_BASE_TILES = [
  0, 30, 60, 90,
  120, 150, 180, 210,
  // 93 = 수로 오목 코너 (폭포 아님). 가로 3프레임.
  93,
  // 석축 수로 프레임 — 볼록 3 · 세로 변 33 · 가로 변 63
  3, 33, 63,
] as const;

/** 폭포 세로 4프레임 스트립 (한 칸에 저장되는 베이스 = 각 열의 맨 위). */
const WATERFALL_VERTICAL_STRIPS: readonly { readonly baseTile: number; readonly frames: readonly number[] }[] = [
  { baseTile: 123, frames: [123, 153, 183, 213] },
  { baseTile: 124, frames: [124, 154, 184, 214] },
  { baseTile: 125, frames: [125, 155, 185, 215] },
];

export const CHIPSET_ANIMATION_STRIPS: readonly ChipsetAnimationStrip[] = [
  ...HORIZONTAL_WATER_BASE_TILES.map((baseTile) => horizontalStrip(baseTile)),
  ...WATERFALL_VERTICAL_STRIPS.map((entry) => waterfallStrip(entry.baseTile, entry.frames)),
];

export const CHIPSET_ANIMATION_FRAME_TILES = CHIPSET_ANIMATION_STRIPS.flatMap((strip) => strip.frames);

export function animationKeyForTile(tile: number): string | null {
  return animationStripForTile(tile)?.key ?? null;
}

export function animationFrameForTile(tile: number, elapsedMs: number): number {
  const strip = animationStripForTile(tile);
  if (!strip || strip.frames.length === 0) return tile;
  const safeElapsedMs = Math.max(0, elapsedMs);
  const fps = strip.fps > 0 ? strip.fps : CHIPSET_ANIMATION_FPS;
  const frameMs = 1000 / fps;
  const frameIndex = Math.floor(safeElapsedMs / frameMs) % strip.frames.length;
  return strip.frames[frameIndex] ?? strip.baseTile;
}

export function animationStripForTile(tile: number): ChipsetAnimationStrip | null {
  return CHIPSET_ANIMATION_STRIPS.find((strip) => strip.frames.includes(tile)) ?? null;
}

function horizontalStrip(baseTile: number): ChipsetAnimationStrip {
  return {
    key: `chipset_tile_${baseTile}_3fps`,
    baseTile,
    frames: [baseTile, baseTile + 1, baseTile + 2],
    fps: CHIPSET_ANIMATION_FPS,
  };
}

function waterfallStrip(baseTile: number, frames: readonly number[]): ChipsetAnimationStrip {
  return {
    key: `chipset_waterfall_${baseTile}_4fps`,
    baseTile,
    frames: [...frames],
    fps: WATERFALL_ANIMATION_FPS,
  };
}
