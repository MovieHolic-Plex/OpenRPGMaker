import { emeraldMonsterKitSheet } from "@/assets/emeraldMonsterKitAssets";
import references from "@/assets/emeraldMonsterReferences.json";
import { createMonsterKitTileset } from "./monsterKit";
import type { TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const EMERALD_MONSTER_KIT_FAMILY = "oprn-monster-emerald";

export function isEmeraldMonsterKitTexture(textureKey: string): boolean {
  return !!emeraldMonsterKitSheet(textureKey);
}

/** Deep clone: groups, kits, home layers and passability retain original indices. */
export function createEmeraldMonsterKitTileset(textureKey: string): TilesetDef {
  const sheet = emeraldMonsterKitSheet(textureKey);
  if (!sheet) throw new Error(`Unknown Emerald monster atlas: ${textureKey}`);
  const tileset = createMonsterKitTileset(sheet.sourceTextureKey);
  tileset.id = sheet.id;
  tileset.name = sheet.name;
  tileset.image = { type: "bundled", id: sheet.textureKey };
  // 같은 칸 배치의 재채색이지만 그림 톤이 달라 한 게임에 섞으면 안 된다.
  tileset.family = EMERALD_MONSTER_KIT_FAMILY;
  // Reference pointers hide local categories. Own complete inherited assembly docs
  // plus Emerald native examples instead of a pointer to another reference owner.
  delete tileset.referenceSourceTilesetId;
  tileset.referenceDocuments = structuredClone(
    (references as unknown as Record<string, TilesetReferenceCategory[]>)[textureKey] ?? [],
  );
  return tileset;
}

/** Existing copies receive missing shipped categories; author edits and [] survive. */
export function ensureEmeraldMonsterKitTileset(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || !isEmeraldMonsterKitTexture(tileset.image.id)) return false;
  if (tileset.referenceDocuments?.length === 0) return false;
  const fresh = createEmeraldMonsterKitTileset(tileset.image.id);
  const present = new Set((tileset.referenceDocuments ?? []).map((category) => category.id));
  const missing = (fresh.referenceDocuments ?? []).filter((category) => !present.has(category.id));
  if (!missing.length) return false;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...missing];
  return true;
}
