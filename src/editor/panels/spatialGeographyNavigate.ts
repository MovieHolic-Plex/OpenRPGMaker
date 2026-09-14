import { spatialPresentationId } from "./spatialPresentation";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import {
  openSpatialDestination,
  patchSpatialSession,
  popSpatialBreadcrumb,
  pushSpatialBreadcrumb,
} from "@/editor/panels/spatialAuthoringSession";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { workingProject } from "@/editor/panels/spatialGeographyCommands";
import type { GeographyDesign } from "@/editor/panels/spatialGeographyDraft";
import { geographyChildren } from "@/editor/panels/spatialGeographyGeometry";
import { childOccurrenceId, libraryGeographyCardId, libraryPlaceCardId } from "@/editor/panels/spatialGeographyQuery";
import { spatialId } from "@/project/spatial/domain";

/** Open a child on its domain tab without setSpatialTab, which would drop the breadcrumb. */
export function openSelectedChild(session: SpatialAuthoringSession, design: GeographyDesign, rerender: () => void): void {
  const child = geographyChildren(design).find((entry) => entry.id === geographyChromeState.selectedChildId);
  if (!child) return;
  const tab = child.source.kind === "space" ? "spaces" : child.source.kind === "place" ? "places" : "regions";
  if (session.mode === "instances" && session.occurrenceId) {
    const occurrenceId = childOccurrenceId(workingProject(), spatialId(session.occurrenceId), child.id);
    if (!occurrenceId) return;
    pushSpatialBreadcrumb();
    openSpatialDestination(tab, null);
    patchSpatialSession({ mode: "instances", occurrenceId, designId: null });
  } else {
    const designId = child.source.kind === "space"
      ? spatialPresentationId("library-space", "library", child.source.id)
      : child.source.kind === "place"
      ? libraryPlaceCardId(child.source.id)
      : libraryGeographyCardId("region", child.source.id);
    pushSpatialBreadcrumb();
    openSpatialDestination(tab, designId);
  }
  rerender();
}

/** Back restores session tab/selection/camera; tabReveal updates the Database tab. */
export function restoreGeographyParent(rerender: () => void): void {
  popSpatialBreadcrumb();
  rerender();
}
