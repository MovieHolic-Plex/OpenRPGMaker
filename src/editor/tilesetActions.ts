import { store } from "@/project/store";
import type { TilesetId } from "@/project/types";

export function setTerrainTag(tilesetId: TilesetId, tile: number, terrain: number): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset || tile < 0 || tile >= tileset.count) return;
    tileset.terrain[tile] = Math.max(0, Math.floor(terrain));
  });
}
