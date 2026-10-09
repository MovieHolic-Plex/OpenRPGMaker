import { regionReferenceImage, regionReferenceInspector } from "./regionReferenceView";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { spatialPlacesChrome, visiblePlaceSelection } from "@/editor/panels/spatialPlaceCommands";
import { renderSpatialPlacesCanvas } from "@/editor/panels/spatialPlaceCanvas";
import { renderSpatialPlacesInspector } from "@/editor/panels/spatialPlaceInspector";

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
  if (card?.regionReferenceId) return { canvas: regionReferenceImage(card.regionReferenceId), inspector: regionReferenceInspector(card.regionReferenceId) };
  const selected = visiblePlaceSelection(card);
  return {
    canvas: renderSpatialPlacesCanvas(session, selected, rerender),
    inspector: renderSpatialPlacesInspector(selected, session.inspectorOpen, rerender),
  };
}

export function spatialPlacesTabChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  if (card?.regionReferenceId) return { saveState: "완성 장소 사례 · 읽기 전용", previewError: null };
  return spatialPlacesChrome(card, rerender);
}
