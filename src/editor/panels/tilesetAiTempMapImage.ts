import { loadTilesetImage } from "@/editor/mapTileDraw";
import { renderTempMapSnapshotImage, renderTilesetAtlasSnapshotImage } from "@/editor/tilesetAiSnapshotImage";
import type { GameMap, TilesetDef } from "@/project/types";
export async function renderTempMapImage(map: GameMap, tileset: TilesetDef): Promise<string> {
  return renderTempMapSnapshotImage(map, tileset, await loadTilesetImage(tileset));
}
export async function renderTilesetAtlasImage(tileset: TilesetDef): Promise<string> {
  return renderTilesetAtlasSnapshotImage(tileset, await loadTilesetImage(tileset));
}
