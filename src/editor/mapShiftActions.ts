import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { applyMapShift, type MapShiftOffset } from "@/project/mapShift";
export { applyMapShift, type MapShiftOffset } from "@/project/mapShift";

export function shiftMapContent(mapId: MapId, offset: MapShiftOffset): boolean {
  let shifted = false;
  store.update((project) => {
    shifted = applyMapShift(project, mapId, offset);
  }, { scope: "map", mapId });
  return shifted;
}
