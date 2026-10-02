import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";

// Field sprites must use a registered catalog entry. Native enemy portraits are
// single idle cells; the complete pose grid is reserved for battle animation.
const generatedMonsterIds = new Set(builtinGeneratedResourceIds().filter((id) => id.startsWith("generated-enemy-")));

export function isGeneratedMonsterSprite(resourceId: string): boolean {
  return generatedMonsterIds.has(resourceId);
}

export function generatedMonsterSpriteUrl(resourceId: string): string | null {
  return isGeneratedMonsterSprite(resourceId) ? resolveAssetResourceUrl(resourceId) : null;
}
