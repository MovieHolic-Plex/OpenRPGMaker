import type { SpatialId, SpatialPoint } from "@/project/spatial/types";

export type GeographyTool = "select" | "route" | "entry" | "terrain";
export type GeographyGesture = {
  readonly childId: SpatialId;
  readonly originX: number;
  readonly originY: number;
};

export const geographyChromeState: {
  saveState: string;
  previewError: string | null;
  deleteOpen: boolean;
  selectedChildId: SpatialId | null;
  selectedRouteId: SpatialId | null;
  selectedPortId: SpatialId | null;
  tool: GeographyTool;
  routeDraft: SpatialPoint[];
  gesture: GeographyGesture | null;
  createdDesignId: SpatialId | null;
  boardKey: string;
} = {
  saveState: "읽기",
  previewError: null,
  deleteOpen: false,
  selectedChildId: null,
  selectedRouteId: null,
  selectedPortId: null,
  tool: "select",
  routeDraft: [],
  gesture: null,
  createdDesignId: null,
  boardKey: "",
};

export function resetSpatialGeographyChrome(): void {
  geographyChromeState.saveState = "읽기";
  geographyChromeState.previewError = null;
  geographyChromeState.deleteOpen = false;
  geographyChromeState.selectedChildId = null;
  geographyChromeState.selectedRouteId = null;
  geographyChromeState.selectedPortId = null;
  geographyChromeState.tool = "select";
  geographyChromeState.routeDraft = [];
  geographyChromeState.gesture = null;
  geographyChromeState.createdDesignId = null;
  geographyChromeState.boardKey = "";
}

export function bindGeographyBoard(key: string): void {
  if (geographyChromeState.boardKey === key) return;
  geographyChromeState.boardKey = key;
  geographyChromeState.tool = "select";
  geographyChromeState.gesture = null;
  geographyChromeState.routeDraft = [];
  geographyChromeState.selectedChildId = null;
  geographyChromeState.selectedRouteId = null;
}

