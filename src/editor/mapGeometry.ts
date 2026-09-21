import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";

export function editorMapTileSize(mapId = editorState.get().currentMapId): number {
  const project = store.getCurrent();
  const map = project.maps[mapId ?? project.startMapId];
  return mapTileSize(map, map ? project.tilesets[map.tilesetId] : undefined);
}
