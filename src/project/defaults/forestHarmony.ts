import saved from "@/assets/forestHarmonyTileset.json";
import type { TilesetDef } from "../types";

export const FOREST_HARMONY_TEXTURE = "tex_forest_harmony";
export const FOREST_HARMONY_ID = "forest_harmony";

/** Independent copies preserve authored passability, autotiles and forest assemblies. */
export function createForestHarmonyTileset(): TilesetDef {
  return JSON.parse(JSON.stringify(saved)) as TilesetDef;
}
