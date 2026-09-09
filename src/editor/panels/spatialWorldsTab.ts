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

export function resetSpatialWorldsTabChrome(): void {
  clearAuthoringSession();
  resetSpatialGeographyChrome();
}

export function renderSpatialWorldsCanvas(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  return renderSpatialGeographyCanvas({ session, card, kind: "world" }, rerender);
}

export function renderSpatialWorldsInspector(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  return renderSpatialGeographyInspector({ session, card, kind: "world" }, rerender);
}

export function renderSpatialWorldsStage(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): { readonly canvas: HTMLElement; readonly inspector: HTMLElement } {
  const selected = visibleGeographySelection(card, "world");
  return {
    canvas: renderSpatialWorldsCanvas(session, selected, rerender),
    inspector: renderSpatialWorldsInspector(session, selected, rerender),
  };
}

export function spatialWorldsTabChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  return spatialGeographyChrome(card, "world", rerender);
}

export function spatialWorldsChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  return spatialWorldsTabChrome(card, rerender);
}
