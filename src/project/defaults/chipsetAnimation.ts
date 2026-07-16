export const CHIPSET_ANIMATION_FPS = 3;
export const CHIPSET_ANIMATION_FRAME_COUNT = 3;

export type ChipsetAnimationStrip = {
  readonly key: string;
  readonly baseTile: number;
  readonly frames: readonly [number, number, number];
};

const ANIMATED_WATER_BASE_TILES = [
  0, 30, 60, 90,
  120, 150, 180, 210,
  // 93 = 수로 오목 코너(2026-07-17 정본 교정 — 폭포 아님), 123~213 = 폭포.
  93, 123, 153, 183, 213,
  // 석축 수로 프레임 — 볼록 3 · 세로 변 33 · 가로 변 63 (호수 스킨 0/30/60과 평행).
  3, 33, 63,
] as const;

export const CHIPSET_ANIMATION_STRIPS: readonly ChipsetAnimationStrip[] = ANIMATED_WATER_BASE_TILES.map((baseTile) =>
  animationStrip(baseTile)
);

export const CHIPSET_ANIMATION_FRAME_TILES = CHIPSET_ANIMATION_STRIPS.flatMap((strip) => strip.frames);

export function animationKeyForTile(tile: number): string | null {
  return animationStripForTile(tile)?.key ?? null;
}

export function animationFrameForTile(tile: number, elapsedMs: number): number {
  const strip = animationStripForTile(tile);
  if (!strip) return tile;
  const safeElapsedMs = Math.max(0, elapsedMs);
  const frameMs = 1000 / CHIPSET_ANIMATION_FPS;
  const frameIndex = Math.floor(safeElapsedMs / frameMs) % CHIPSET_ANIMATION_FRAME_COUNT;
  return strip.frames[frameIndex] ?? strip.baseTile;
}

export function animationStripForTile(tile: number): ChipsetAnimationStrip | null {
  return CHIPSET_ANIMATION_STRIPS.find((strip) => strip.frames.includes(tile)) ?? null;
}

function animationStrip(baseTile: number): ChipsetAnimationStrip {
  return {
    key: `chipset_tile_${baseTile}_3fps`,
    baseTile,
    frames: [baseTile, baseTile + 1, baseTile + 2],
  };
}
