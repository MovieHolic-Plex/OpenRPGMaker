import { RIVER_VILLAGE_STYLE } from "@/project/defaults/riverVillageStyle";
import type { Project } from "@/project/types";
import type { AuthorVillageRequest } from "@/editor/construction/contracts";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createForestHarmonyTileset, FOREST_HARMONY_ID } from "@/project/defaults/forestHarmony";

/** Choose the village default before the scope baseline, just like blank-map sizing.
 * Existing authored maps, selections and explicitly selected custom chipsets retain their identity. */
export function prepareVillageDefaultTileset(project: Project, request: AuthorVillageRequest): void {
  if (request.target.kind === "new") {
    project.tilesets[FOREST_HARMONY_ID] ??= createForestHarmonyTileset();
    return;
  }
  const map = project.maps[request.target.mapId];
  if (!map || request.target.bounds || map.tilesetId !== DEFAULT_TILESET_ID || map.events.length
    || map.lowerTiles.some(tile => tile !== TILE.GRASS) || map.upperTiles.some(tile => tile !== TILE.EMPTY)
    || Object.values(map.lowerTileStacks ?? {}).some(stack => stack?.length)
    || Object.values(map.upperTileStacks ?? {}).some(stack => stack?.length)
    || map.layoutPlan?.regions.length
    || Object.values(project.spatialAuthoring?.occurrences ?? {}).some(o => o.bindings.some(b => b.mapId === map.id))) return;
  project.tilesets[FOREST_HARMONY_ID] ??= createForestHarmonyTileset();
  map.tilesetId = RIVER_VILLAGE_STYLE.tilesetId;
}
