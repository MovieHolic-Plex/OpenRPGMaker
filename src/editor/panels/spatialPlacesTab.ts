import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { spatialPlacesChrome, visiblePlaceSelection } from "@/editor/panels/spatialPlaceCommands";
import { renderSpatialPlacesCanvas } from "@/editor/panels/spatialPlaceCanvas";
import { renderSpatialPlacesInspector } from "@/editor/panels/spatialPlaceInspector";
import "@/styles/database/spatial-places.css";

export { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
export { resetSpatialPlacesTabChrome } from "@/editor/panels/spatialPlaceChromeState";
export { spatialPlacesChrome, visiblePlaceSelection } from "@/editor/panels/spatialPlaceCommands";
export { renderSpatialPlacesCanvas } from "@/editor/panels/spatialPlaceCanvas";
export { renderSpatialPlacesInspector } from "@/editor/panels/spatialPlaceInspector";

export function renderSpatialPlacesStage(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): { readonly canvas: HTMLElement; readonly inspector: HTMLElement } {
  const selected = visiblePlaceSelection(card);
  return {
    canvas: renderSpatialPlacesCanvas(session, selected, rerender),
    inspector: renderSpatialPlacesInspector(selected, session.inspectorOpen, rerender),
  };
}

export function spatialPlacesTabChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  return spatialPlacesChrome(card, rerender);
}
