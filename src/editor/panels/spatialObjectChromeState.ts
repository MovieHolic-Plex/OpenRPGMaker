
export type ObjectChromeState = {
  deleteOpen: boolean;
  previewError: string | null;
  saveState: string;
  buildSeed: number | null;
  buildSeedText: string | null;
  buildMapId: string | null;
  buildRectX: number | null;
  buildRectY: number | null;
  buildRectWidth: number | null;
  buildRectHeight: number | null;
  buildEntryX: number | null;
  buildEntryY: number | null;
};

export const objectChromeState: ObjectChromeState = {
  deleteOpen: false,
  previewError: null,
  saveState: "읽기",
  buildSeed: 7,
  buildSeedText: null,
  buildMapId: null,
  buildRectX: null,
  buildRectY: null,
  buildRectWidth: null,
  buildRectHeight: null,
  buildEntryX: null,
  buildEntryY: null,
};

export function resetSpatialObjectsTabChrome(): void {
  objectChromeState.deleteOpen = false;
  objectChromeState.previewError = null;
  objectChromeState.saveState = "읽기";
  objectChromeState.buildSeed = 7;
  objectChromeState.buildSeedText = null;
  objectChromeState.buildMapId = null;
  objectChromeState.buildRectX = null;
  objectChromeState.buildRectY = null;
  objectChromeState.buildRectWidth = null;
  objectChromeState.buildRectHeight = null;
  objectChromeState.buildEntryX = null;
  objectChromeState.buildEntryY = null;
}
