import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { clearAuthoringSession } from "@/editor/panels/spatialAuthoringAccess";
import { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { spatialSpacesChrome } from "@/editor/panels/spatialSpaceChrome";
import { renderSpatialSpacesInspector } from "@/editor/panels/spatialSpaceInspector";
import { resetSpatialSpacesTabChrome as resetSpaceChromeUi } from "@/editor/panels/spatialSpaceChromeState";
import "@/styles/database/spatial-spaces.css";

export { spatialSpacesChrome } from "@/editor/panels/spatialSpaceChrome";
export { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
export { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
export { renderSpatialSpacesInspector } from "@/editor/panels/spatialSpaceInspector";

export function resetSpatialSpacesTabChrome(): void {
  clearAuthoringSession();
  resetSpaceChromeUi();
}

export function renderSpatialSpacesStage(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): { readonly canvas: HTMLElement; readonly inspector: HTMLElement } {
  return {
    canvas: renderSpatialSpacesCanvas(session, card, rerender),
    inspector: renderSpatialSpacesInspector(card, session.inspectorOpen, rerender),
  };
}

export function spatialSpacesTabChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  return spatialSpacesChrome(card, rerender);
}
