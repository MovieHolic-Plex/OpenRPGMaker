import type { HouseStructureKitDef, TilesetDef } from "@/project/types";

export const BUILTIN_HOUSE_STRUCTURE_KITS: readonly HouseStructureKitDef[] = [];

export function builtinHouseStructureKitsFor(_tileset: Pick<TilesetDef, "id">): readonly HouseStructureKitDef[] {
  void _tileset;
  return [];
}
