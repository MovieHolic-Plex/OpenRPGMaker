import catalog from "../../public/assets/beodeul-objects/catalog.json";
import type { StructureGrowthAxis } from "@/project/types";

export const BEODEUL_OBJECT_TILE_SIZE = 16;
export const BEODEUL_OBJECT_KIT_PREFIX = "bd-object:";
export const BEODEUL_OBJECT_CATEGORIES = ["prop", "indoor", "nature", "structure"] as const;

export interface BeodeulPlaceableObject {
  readonly id: string;
  readonly nameKo: string;
  readonly category: (typeof BEODEUL_OBJECT_CATEGORIES)[number];
  readonly sourceFile: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly footprint: readonly string[];
  readonly tags: readonly string[];
  readonly group?: "hedge" | "dock";
  readonly growthAxis?: StructureGrowthAxis;
  readonly surface?: "water" | "wall";
}

export const BEODEUL_PLACEABLE_OBJECTS = catalog as readonly BeodeulPlaceableObject[];
const textureKey = (id: string) => `tex_beodeul_object_${id}`;
const byTexture = new Map(BEODEUL_PLACEABLE_OBJECTS.map(object => [textureKey(object.id), object]));
const byKitId = new Map(BEODEUL_PLACEABLE_OBJECTS.map(object => [BEODEUL_OBJECT_KIT_PREFIX + object.id, object]));

export const BEODEUL_OBJECT_IMAGE_ASSETS = BEODEUL_PLACEABLE_OBJECTS.map(object => ({
  textureKey: textureKey(object.id),
  path: `assets/beodeul-objects/${object.id}.png`,
  name: object.nameKo,
}));

export function beodeulPlaceableObjectForTexture(key: string): BeodeulPlaceableObject | undefined {
  return byTexture.get(key);
}

export function beodeulPlaceableObjectForKit(id: string): BeodeulPlaceableObject | undefined {
  return byKitId.get(id);
}
