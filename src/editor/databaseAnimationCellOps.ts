import { cellTransformFields } from "@/project/databaseAnimationRecordModel";
import type { BattleAnimationCell } from "@/project/types";

export type AnimationCellBatchPatch = {
  readonly pattern?: number;
  readonly x?: number;
  readonly y?: number;
  readonly zoom?: number;
  readonly opacity?: number;
  readonly visible?: boolean;
};

/** Apply the same numeric/visibility fields to every cell in the frame. */
export function batchApplyCells(
  cells: readonly BattleAnimationCell[],
  patch: AnimationCellBatchPatch,
): BattleAnimationCell[] {
  const source = cells.length > 0 ? cells : [defaultCell()];
  return source.map((cell) => ({
    ...cell,
    pattern: patch.pattern !== undefined ? clampInt(patch.pattern, 0, 999) : cell.pattern,
    x: patch.x !== undefined ? clampInt(patch.x, -999, 999) : cell.x,
    y: patch.y !== undefined ? clampInt(patch.y, -999, 999) : cell.y,
    zoom: patch.zoom !== undefined ? clampInt(patch.zoom, 1, 800) : cell.zoom,
    opacity: patch.opacity !== undefined ? clampInt(patch.opacity, 0, 255) : cell.opacity,
    visible: patch.visible !== undefined ? patch.visible : cell.visible,
    tone: cell.tone ? { ...cell.tone } : undefined,
  }));
}

/**
 * Linearly interpolate cell properties between previous and next frames.
 * Cell count follows the longer of the two neighbors; missing slots use defaults.
 */
export function interpolateCells(
  previous: readonly BattleAnimationCell[],
  next: readonly BattleAnimationCell[],
  t = 0.5,
): BattleAnimationCell[] {
  const amount = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0.5;
  const count = Math.max(previous.length, next.length, 1);
  const result: BattleAnimationCell[] = [];
  for (let index = 0; index < count; index += 1) {
    const a = previous[index] ?? next[index] ?? defaultCell();
    const b = next[index] ?? previous[index] ?? defaultCell();
    result.push({
      pattern: Math.round(lerp(a.pattern, b.pattern, amount)),
      x: Math.round(lerp(a.x, b.x, amount)),
      y: Math.round(lerp(a.y, b.y, amount)),
      zoom: Math.round(lerp(a.zoom, b.zoom, amount)),
      opacity: Math.round(lerp(a.opacity, b.opacity, amount)),
      visible: amount < 0.5 ? a.visible : b.visible,
      ...cellTransformFields({
        rotation: lerp(a.rotation ?? 0, b.rotation ?? 0, amount),
        mirror: amount < 0.5 ? a.mirror : b.mirror,
      }),
      tone: a.tone && b.tone
        ? {
            red: Math.round(lerp(a.tone.red, b.tone.red, amount)),
            green: Math.round(lerp(a.tone.green, b.tone.green, amount)),
            blue: Math.round(lerp(a.tone.blue, b.tone.blue, amount)),
            gray: Math.round(lerp(a.tone.gray, b.tone.gray, amount)),
          }
        : a.tone
          ? { ...a.tone }
          : b.tone
            ? { ...b.tone }
            : undefined,
    });
  }
  return result;
}

function defaultCell(): BattleAnimationCell {
  return { pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
