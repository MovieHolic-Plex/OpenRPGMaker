import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";

// Field sprites must use a real catalog entry. The general resource resolver also
// guesses monster art from unknown names, which would hide a broken authored ID.
const generatedMonsterIds = new Set(builtinGeneratedResourceIds().filter((id) => id.startsWith("generated-enemy-")));

export function isGeneratedMonsterSprite(resourceId: string): boolean {
  return generatedMonsterIds.has(resourceId);
}

export function generatedMonsterSpriteUrl(resourceId: string): string | null {
  return isGeneratedMonsterSprite(resourceId) ? resolveAssetResourceUrl(resourceId) : null;
}
