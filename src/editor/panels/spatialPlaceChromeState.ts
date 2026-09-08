import type { SpatialId } from "@/project/spatial/types";

export type PlaceFloorFilter = number | null;

export const placeChromeState: {
  saveState: string;
  previewError: string | null;
  deleteOpen: boolean;
  selectedChildId: SpatialId | null;
  selectedConnectionId: SpatialId | null;
  selectedFloor: PlaceFloorFilter;
  createdDesignId: SpatialId | null;
} = {
  saveState: "읽기",
  previewError: null,
  deleteOpen: false,
  selectedChildId: null,
  selectedConnectionId: null,
  selectedFloor: null,
  createdDesignId: null,
};

export function resetSpatialPlacesTabChrome(): void {
  placeChromeState.saveState = "읽기";
  placeChromeState.previewError = null;
  placeChromeState.deleteOpen = false;
  placeChromeState.selectedChildId = null;
  placeChromeState.selectedConnectionId = null;
  placeChromeState.selectedFloor = null;
  placeChromeState.createdDesignId = null;
}
