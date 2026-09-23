import { regionMapPreview, regionMapInspector } from "./regionMapView";
import { el } from "@/util/dom";
import { regionReferenceImage, regionReferenceInspector } from "./regionReferenceView";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { clearAuthoringSession } from "@/editor/panels/spatialAuthoringAccess";
import { renderSpatialGeographyCanvas } from "@/editor/panels/spatialGeographyCanvas";
import { resetSpatialGeographyChrome } from "@/editor/panels/spatialGeographyChromeState";
import { spatialGeographyChrome, visibleGeographySelection } from "@/editor/panels/spatialGeographyCommands";
import { renderSpatialGeographyInspector } from "@/editor/panels/spatialGeographyInspector";

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
  if (card?.regionMapId) return el("div", { class: "spatial-canvas",
    attrs: { tabindex: "0", "aria-label": "연결된 지역 맵" }, dataset: { testid: "spatial-canvas" },
    children: [regionMapPreview(card.regionMapId)] });
  if (card?.regionReferenceId) return el("div", { class: "spatial-canvas",
    attrs: { tabindex: "0", "aria-label": "완성 지역 사례" }, dataset: { testid: "spatial-canvas" },
    children: [regionReferenceImage(card.regionReferenceId)] });
  return renderSpatialGeographyCanvas({ session, card, kind: "region" }, rerender);
}

export function renderSpatialRegionsInspector(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  if (card?.regionMapId) return regionMapInspector(card.regionMapId, card.name);
  if (card?.regionReferenceId) return regionReferenceInspector(card.regionReferenceId);
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
  if (card?.regionMapId) return { saveState: "완성 맵 · 연결됨", previewError: null };
  if (card?.regionReferenceId) return { saveState: "예시 · 읽기 전용", previewError: null };
  return spatialGeographyChrome(card, "region", rerender);
}

export function spatialRegionsChrome(card: SpatialGalleryCard | undefined, rerender: () => void) {
  return spatialRegionsTabChrome(card, rerender);
}
