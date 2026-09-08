export type ObjectChromeState = {
  deleteOpen: boolean;
  previewError: string | null;
  saveState: string;
};

export const objectChromeState: ObjectChromeState = { deleteOpen: false, previewError: null, saveState: "읽기" };

export function resetSpatialObjectsTabChrome(): void {
  objectChromeState.deleteOpen = false;
  objectChromeState.previewError = null;
  objectChromeState.saveState = "읽기";
}
