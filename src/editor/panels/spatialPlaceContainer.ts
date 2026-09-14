import type { Project } from "@/project/types";
import type { SpatialDesignReference } from "@/project/spatial/types";
import { checkedDocument, designNode } from "@/project/spatial/domain";
import { blankPlaceDesign, upsertPlaceDesign } from "./spatialPlaceDraft";
import { freshSpatialId } from "./spatialSpaceDraft";
import { editAuthoringDraft, spatialAuthoringErrorText } from "./spatialAuthoringAccess";
import { openSpatialDestination, patchSpatialSession, pushSpatialBreadcrumb } from "./spatialAuthoringSession";
import { spatialPresentationId } from "./spatialPresentation";
import { placeChromeState } from "./spatialPlaceChromeState";

/** Add a reusable container without rewriting the original room or its existing instances. */
export function preparePlaceContainer(project: Project, source: SpatialDesignReference) {
  if (!project.spatialAuthoring || (source.kind !== "space" && source.kind !== "place")) throw new Error("건물로 구성할 장소를 선택해 주세요.");
  const node = designNode(project.spatialAuthoring.library, source);
  const level = node.kind === "space" && node.design.environment === "outdoor" ? 0 : 1;
  const building = { ...blankPlaceDesign(project), kind: "facility" as const, name: `${node.design.name} 건물`,
    children: [{ id: freshSpatialId(project, "room-slot"), source: { kind: source.kind, id: source.id }, x: 0, y: 0, level }] };
  const next = upsertPlaceDesign(project, building);
  checkedDocument(next.spatialAuthoring, next);
  return { project: next, source: { kind: "place" as const, id: building.id }, level };
}

export function startPlaceContainer(source: SpatialDesignReference): string | null {
  let prepared: ReturnType<typeof preparePlaceContainer> | undefined;
  const result = editAuthoringDraft(project => {
    prepared = preparePlaceContainer(project, source);
    return prepared.project;
  });
  if (result.kind !== "ok" || !prepared) return spatialAuthoringErrorText(result);
  placeChromeState.createdDesignId = prepared.source.id;
  placeChromeState.selectedFloor = prepared.level;
  placeChromeState.selectedChildId = null;
  placeChromeState.previewError = null;
  placeChromeState.saveState = "초안";
  pushSpatialBreadcrumb();
  patchSpatialSession({ mode: "design", source: "own", placeKindFilter: null, inspectorOpen: false });
  openSpatialDestination("places", spatialPresentationId("library-place", "library", prepared.source.id));
  return null;
}
