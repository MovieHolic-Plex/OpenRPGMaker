import type { SpatialId } from "@/project/spatial/types";

export type SpaceEnvironmentFilter = "all" | "interior" | "outdoor";
export type SpaceGesture = {
  readonly kind: "slot" | "port";
  readonly id: SpatialId;
  readonly originX: number;
  readonly originY: number;
};

export const spaceChromeState: {
  saveState: string;
  previewError: string | null;
  deleteOpen: boolean;
  selectedSlotId: SpatialId | null;
  selectedPortId: SpatialId | null;
  environment: SpaceEnvironmentFilter;
  gesture: SpaceGesture | null;
} = {
  saveState: "읽기",
  previewError: null,
  deleteOpen: false,
  selectedSlotId: null,
  selectedPortId: null,
  environment: "all",
  gesture: null,
};

export function resetSpatialSpacesTabChrome(): void {
  spaceChromeState.saveState = "읽기";
  spaceChromeState.previewError = null;
  spaceChromeState.deleteOpen = false;
  spaceChromeState.selectedSlotId = null;
  spaceChromeState.selectedPortId = null;
  spaceChromeState.environment = "all";
  spaceChromeState.gesture = null;
}
