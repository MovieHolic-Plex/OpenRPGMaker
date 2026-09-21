import { DEFAULT_TILESET_ID } from "./constants";
import saved from "@/assets/forestHarmonyTileset.json";
import type { Project, TilesetDef } from "../types";

export const FOREST_HARMONY_TEXTURE = "tex_forest_harmony";
export const FOREST_HARMONY_ID = "forest_harmony";

/** Independent copies preserve authored passability, autotiles and forest assemblies. */
export function createForestHarmonyTileset(): TilesetDef {
  return JSON.parse(JSON.stringify(saved)) as TilesetDef;
}

/** New outdoor authoring prefers the bundled forest atlas; old stripped projects remain usable. */
export function defaultOutdoorTilesetId(project: Pick<Project, "tilesets">): string {
  return isForestHarmonyTileset(project.tilesets[FOREST_HARMONY_ID])
    ? FOREST_HARMONY_ID : DEFAULT_TILESET_ID;
}

export function isForestHarmonyTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === FOREST_HARMONY_TEXTURE;
}
