import type { SpatialId } from "@/project/spatial/types";

export type SpaceEnvironmentFilter = "all" | "interior" | "outdoor";
export type SpaceGesture =
  | { readonly kind: "slot"; readonly id: SpatialId; readonly originX: number; readonly originY: number }
  | { readonly kind: "port"; readonly id: SpatialId; readonly originX: number; readonly originY: number }
  | { readonly kind: "member"; readonly id: SpatialId; readonly index: number; readonly originX: number; readonly originY: number };

export const spaceChromeState: {
  saveState: string;
  previewError: string | null;
  deleteOpen: boolean;
  selectedSlotId: SpatialId | null;
  selectedIndex: number | null;
  selectedPortId: SpatialId | null;
  selectedObjectId: SpatialId | null;
  cursorTile: { x: number; y: number };
  environment: SpaceEnvironmentFilter;
  gesture: SpaceGesture | null;
  buildSeed: number | null;
  buildSeedText: string | null;
} = {
  saveState: "읽기",
  previewError: null,
  deleteOpen: false,
  selectedSlotId: null,
  selectedIndex: null,
  selectedPortId: null,
  selectedObjectId: null,
  cursorTile: { x: 1, y: 1 },
  environment: "all",
  gesture: null,
  buildSeed: 7,
  buildSeedText: null,
};

export function resetSpatialSpacesTabChrome(): void {
  spaceChromeState.saveState = "읽기";
  spaceChromeState.previewError = null;
  spaceChromeState.deleteOpen = false;
  spaceChromeState.selectedSlotId = null;
  spaceChromeState.selectedIndex = null;
  spaceChromeState.selectedPortId = null;
  spaceChromeState.selectedObjectId = null;
  spaceChromeState.cursorTile = { x: 1, y: 1 };
  spaceChromeState.environment = "all";
  spaceChromeState.gesture = null;
  spaceChromeState.buildSeed = 7;
  spaceChromeState.buildSeedText = null;
}
