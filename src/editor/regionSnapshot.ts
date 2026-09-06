import { loadTilesetImage, MapTileDrawError } from "./mapTileDraw";
import { drawRegionSnapshot } from "./regionSnapshotCore";
import type { RegionRect } from "./regionTask/clipToRegion";
import type { GameMap, Project } from "@/project/types";
export { eventsInRegion, regionSnapshotScale } from "./regionSnapshotCore";

export async function renderRegionSnapshot(project: Project, map: GameMap, region: RegionRect,
  opts?: { readonly targetWidth?: number }): Promise<HTMLCanvasElement> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new MapTileDrawError("맵의 타일셋을 찾지 못했습니다.");
  return drawRegionSnapshot(map, tileset, await loadTilesetImage(tileset), region, opts);
}
