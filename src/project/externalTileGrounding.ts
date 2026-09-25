import type { ExternalTilesetPack, ExternalTileScene } from './externalTilesetCatalog';

export interface FurnitureGroundingIssue {
  code: 'FURNITURE_FLOATS_ON_WALL';
  sceneId: string;
  recipeId: string;
  x: number;
  y: number;
  bottomPixelY: number;
}

/** Check real opaque feet, not the bounding box's possibly transparent last row.
 * Wall fixtures and countertop props have separate placement contracts.
 * This does not establish correct sprite assembly or overall visual quality.
 */
export function inspectExternalTileGrounding(
  pack: ExternalTilesetPack,
  scene: ExternalTileScene,
  pixels: Uint8ClampedArray,
): FurnitureGroundingIssue[] {
  const issues: FurnitureGroundingIssue[] = [];
  const floors = new Set(scene.passableTiles ?? [pack.floorTile]);
  for (const placement of scene.placements) {
    const recipe = pack.recipes.find(value => value.id === placement.recipeId);
    if (!recipe || recipe.placementKind !== 'standing') continue;
    const rect = recipe.sourceRect;
    let last = -1;
    for (let y = rect.height * 32 - 1; y >= 0 && last < 0; y--) {
      for (let x = 0; x < rect.width * 32; x++) {
        if (pixels[((rect.y * 32 + y) * pack.width + rect.x * 32 + x) * 4 + 3]! > 0) {
          last = y;
          break;
        }
      }
    }
    if (last < 0) continue;
    const feet = new Set<number>();
    for (let x = 0; x < rect.width * 32; x++) {
      if (pixels[((rect.y * 32 + last) * pack.width + rect.x * 32 + x) * 4 + 3]! > 0) feet.add(Math.floor(x / 32));
    }
    for (const dx of feet) {
      const x = placement.x + dx;
      const y = placement.y + Math.floor(last / 32);
      if (!floors.has(scene.lowerTiles[y * scene.width + x]!) || scene.ceilingCells?.some(cell => cell.x === x && cell.y === y)) {
        issues.push({ code: 'FURNITURE_FLOATS_ON_WALL', sceneId: scene.id, recipeId: recipe.id, x, y,
          bottomPixelY: placement.y * 32 + last });
      }
    }
  }
  return issues;
}
