import { CHARACTER_SCALE_MAX, normalizeCharacterScale } from "./footprint";
import type { EventPageGraphic } from "./types";

/** Fit a walking frame's width to one cell, using whole pixels and never shrinking. */
export function automaticCharacterScale(frameWidth: number | undefined, tileSize: number): number {
  if (!frameWidth || !Number.isFinite(frameWidth) || frameWidth <= 0 || !Number.isFinite(tileSize)) return 1;
  return Math.min(CHARACTER_SCALE_MAX, Math.max(1, Math.floor(tileSize / frameWidth)));
}

export function isAutomaticCharacterScale(graphic?: Pick<EventPageGraphic, "scale" | "scaleMode">): boolean {
  return graphic?.scaleMode === "auto" || (graphic?.scaleMode !== "manual" && graphic?.scale === undefined);
}

/** Legacy explicit scales remain absolute. Auto mode uses scale as its body multiplier. */
export function characterRenderScale(
  frameWidth: number | undefined,
  tileSize: number,
  graphic?: Pick<EventPageGraphic, "scale" | "scaleMode">,
): number {
  const authored = normalizeCharacterScale(graphic?.scale);
  return isAutomaticCharacterScale(graphic)
    ? Math.min(CHARACTER_SCALE_MAX, authored * automaticCharacterScale(frameWidth, tileSize))
    : authored;
}
