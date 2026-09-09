import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { clearAuthoringSession } from "@/editor/panels/spatialAuthoringAccess";
import { renderSpatialGeographyCanvas } from "@/editor/panels/spatialGeographyCanvas";
import { resetSpatialGeographyChrome } from "@/editor/panels/spatialGeographyChromeState";
import { spatialGeographyChrome, visibleGeographySelection } from "@/editor/panels/spatialGeographyCommands";
import { renderSpatialGeographyInspector } from "@/editor/panels/spatialGeographyInspector";
import "@/styles/database/spatial-geography.css";

export { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
export { renderSpatialGeographyCanvas } from "@/editor/panels/spatialGeographyCanvas";
export { renderSpatialGeographyInspector } from "@/editor/panels/spatialGeographyInspector";
export { spatialGeographyChrome, visibleGeographySelection } from "@/editor/panels/spatialGeographyCommands";

export function resetSpatialRegionsTabChrome(): void {
  clearAuthoringSession();
  resetSpatialGeographyChrome();
}

export function renderSpatialRegionsCanvas(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  return renderSpatialGeographyCanvas({ session, card, kind: "region" }, rerender);
}

export function renderSpatialRegionsInspector(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  return renderSpatialGeographyInspector({ session, card, kind: "region" }, rerender);
}

export function renderSpatialRegionsStage(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): { readonly canvas: HTMLElement; readonly inspector: HTMLElement } {
  const selected = visibleGeographySelection(card, "region");
  return {
    canvas: renderSpatialRegionsCanvas(session, selected, rerender),
    inspector: renderSpatialRegionsInspector(session, selected, rerender),
  };
}

export function spatialRegionsTabChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  return spatialGeographyChrome(card, "region", rerender);
}

export function spatialRegionsChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  return spatialRegionsTabChrome(card, rerender);
}
