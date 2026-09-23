import { CHARACTER_SCALE_MAX, normalizeCharacterScale } from "./footprint";
import { mapWorldScale } from "./mapViewScale";
import type { EventPageGraphic } from "./types";

/** Fit a walking frame's width to one cell, using whole pixels and never shrinking. */
export function automaticCharacterScale(frameWidth: number | undefined, tileSize: number): number {
  if (!frameWidth || !Number.isFinite(frameWidth) || frameWidth <= 0 || !Number.isFinite(tileSize)) return 1;
  return Math.min(CHARACTER_SCALE_MAX, Math.max(1, Math.floor(tileSize / frameWidth)));
}

/**
 * World scale of a walking character on a map whose cell differs from the project's reference cell.
 * The whole-pixel fit is chosen on the reference cell, then the map's world scale keeps the on-screen
 * size unchanged across doors (see mapViewScale). Same cell as the reference: identical to the fit.
 */
export function mapCharacterScale(frameWidth: number | undefined, tileSize: number, referenceTileSize = tileSize): number {
  return automaticCharacterScale(frameWidth, referenceTileSize) * mapWorldScale(tileSize, referenceTileSize);
}

export function isAutomaticCharacterScale(graphic?: Pick<EventPageGraphic, "scale" | "scaleMode">): boolean {
  return graphic?.scaleMode === "auto" || (graphic?.scaleMode !== "manual" && graphic?.scale === undefined);
}

/** Legacy explicit scales remain absolute. Auto mode uses scale as its body multiplier. */
export function characterRenderScale(
  frameWidth: number | undefined,
  tileSize: number,
  graphic?: Pick<EventPageGraphic, "scale" | "scaleMode">,
  referenceTileSize = tileSize,
): number {
  const authored = normalizeCharacterScale(graphic?.scale);
  if (!isAutomaticCharacterScale(graphic)) return authored;
  const onReference = Math.min(CHARACTER_SCALE_MAX, authored * automaticCharacterScale(frameWidth, referenceTileSize));
  return onReference * mapWorldScale(tileSize, referenceTileSize);
}
