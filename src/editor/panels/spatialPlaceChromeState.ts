import type { SpatialId } from "@/project/spatial/types";

export type PlaceFloorFilter = number | null;
export type PlaceMoveGesture = {
  readonly kind: "move";
  readonly childId: SpatialId;
  readonly originX: number;
  readonly originY: number;
  readonly originLevel: number;
  readonly originClientX: number;
  readonly originClientY: number;
  liveX: number;
  liveY: number;
};

export const placeChromeState: {
  saveState: string;
  previewError: string | null;
  deleteOpen: boolean;
  selectedChildId: SpatialId | null;
  selectedConnectionId: SpatialId | null;
  selectedFloor: PlaceFloorFilter;
  createdDesignId: SpatialId | null;
  buildSeed: number | null;
  buildSeedText: string | null;
  gesture: PlaceMoveGesture | null;
  connectFromId: string;
  connectFromPort: string;
  connectToId: string;
  connectToPort: string;
  connectBidirectional: boolean;
} = {
  saveState: "읽기",
  previewError: null,
  deleteOpen: false,
  selectedChildId: null,
  selectedConnectionId: null,
  selectedFloor: null,
  createdDesignId: null,
  buildSeed: 7,
  buildSeedText: null,
  gesture: null,
  connectFromId: "",
  connectFromPort: "",
  connectToId: "",
  connectToPort: "",
  connectBidirectional: true,
};

export function resetSpatialPlacesTabChrome(): void {
  placeChromeState.saveState = "읽기";
  placeChromeState.previewError = null;
  placeChromeState.deleteOpen = false;
  placeChromeState.selectedChildId = null;
  placeChromeState.selectedConnectionId = null;
  placeChromeState.selectedFloor = null;
  placeChromeState.createdDesignId = null;
  placeChromeState.buildSeed = 7;
  placeChromeState.buildSeedText = null;
  placeChromeState.gesture = null;
  placeChromeState.connectFromId = "";
  placeChromeState.connectFromPort = "";
  placeChromeState.connectToId = "";
  placeChromeState.connectToPort = "";
  placeChromeState.connectBidirectional = true;
}
