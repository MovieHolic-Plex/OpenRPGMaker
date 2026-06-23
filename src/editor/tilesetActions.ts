import { store } from "@/project/store";
import type { TilesetId } from "@/project/types";
import { markUserTileRuntimeMetadata } from "./runtimeTileMetadata";

export function setTerrainTag(tilesetId: TilesetId, tile: number, terrain: number): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset || tile < 0 || tile >= tileset.count) return;
    const terrainTag = Math.max(0, Math.floor(terrain));
    tileset.terrain[tile] = terrainTag;
    markUserTileRuntimeMetadata(tileset, tile, { terrainTag });
  });
}
