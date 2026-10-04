import { PIXEL_ENEMY_SHEETS, type PixelEnemySheet } from "./pixelEnemySheets";

/** Whole-image consumers use the idle cell; the retro renderer keeps the complete pose sheet. */
export function pixelEnemyPortraitPath(sheet: PixelEnemySheet): string {
  return sheet.path.replace("/pixel-enemies/", "/pixel-enemy-portraits/");
}

/** Resource IDs remain stable across all battle skins, editor previews and web export. */
export const PIXEL_ENEMY_PORTRAIT_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  PIXEL_ENEMY_SHEETS.map(sheet => [sheet.resourceId, `/${pixelEnemyPortraitPath(sheet)}`])
);
