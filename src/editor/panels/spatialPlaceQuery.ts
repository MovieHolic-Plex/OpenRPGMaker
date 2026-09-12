import { spatialPresentationId } from "@/editor/panels/spatialPresentation";
import { compileSpatialOccurrence, SpatialCompileError } from "@/editor/spatial/compileSpatialOccurrence";
import { inspectSpatialDesignReferences, inspectSpatialOccurrenceDeletion } from "@/project/spatial/ownership";
import type { SpatialAuthoringRequest } from "@/editor/spatial/authoringTypes";
import { spatialId } from "@/project/spatial/domain";
import { genId } from "@/util/id";
import type { PlaceDesign, SpatialId, SpatialLibrary } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { containsPlace, type PlaceChildPick, type PlaceDeletePreview, type PlaceDraftTarget } from "@/editor/panels/spatialPlaceDraft";

export function floorsOf(place: PlaceDesign): readonly number[] {
  return [...new Set(place.children.map((child) => child.level))].sort((a, b) => a - b);
}

export function childrenOnFloor(place: PlaceDesign, level: number | null): readonly PlaceDesign["children"][number][] {
  if (level === null) return place.children;
  return place.children.filter((child) => child.level === level);
}

export function pickerCandidates(library: SpatialLibrary, place: PlaceDesign): readonly PlaceChildPick[] {
  const spaces = Object.values(library.spaces).map((space) => ({
    id: spatialId(`pick-space-${space.id}`),
    source: { kind: "space" as const, id: space.id },
    x: 0,
    y: 0,
    level: place.kind === "facility" && space.environment === "interior" ? 1 : 0,
  }));
  const places = Object.values(library.places)
    .filter((candidate) => !containsPlace(library, candidate.id, place.id))
    .map((candidate) => ({
      id: spatialId(`pick-place-${candidate.id}`),
      source: { kind: "place" as const, id: candidate.id },
      x: 0,
      y: 0,
      level: place.kind === "facility" ? 1 : 0,
    }));
  return [...spaces, ...places];
}

export function previewPlaceDelete(project: Project, target: PlaceDraftTarget): PlaceDeletePreview | null {
  if (!project.spatialAuthoring) return null;
  if (target.occurrenceId) {
    const occurrence = inspectSpatialOccurrenceDeletion(project.spatialAuthoring, project, target.occurrenceId);
    return { strong: occurrence.externalConnectionIds.map(id => ({ path: id })), historical: [], occurrence };
  }
  if (!target.libraryId) return null;
  const impact = inspectSpatialDesignReferences(
    project.spatialAuthoring,
    project,
    { kind: "place", id: target.libraryId },
  );
  return {
    strong: impact.strong.map((entry) => ({ path: entry.path })),
    historical: impact.historical.map(String),
  };
}

export function previewSpaceDependants(project: Project, spaceId: SpatialId): PlaceDeletePreview | null {
  if (!project.spatialAuthoring) return null;
  const impact = inspectSpatialDesignReferences(project.spatialAuthoring, project, { kind: "space", id: spaceId });
  return {
    strong: impact.strong.map((entry) => ({ path: entry.path })),
    historical: impact.historical.map(String),
  };
}

export function previewPlaceCompile(
  project: Project,
  occurrenceId: SpatialId,
): { readonly kind: "ok"; readonly project: Project } | { readonly kind: "error"; readonly code: string; readonly path: string } {
  try {
    return { kind: "ok", project: compileSpatialOccurrence(project, { occurrenceId }) };
  } catch (error) {
    if (error instanceof SpatialCompileError) return { kind: "error", code: error.code, path: error.path };
    throw error;
  }
}

export function libraryPlaceCardId(id: SpatialId): string {
  return spatialPresentationId("library-place", "library", id);
}

export function newConnectionId(): SpatialId {
  return spatialId(genId("place-link"));
}

/** Bare clones are independent frozen trees, not compiled copies. The returned compile
 * target is an explicit subsequent preview, while destination selects the proposed root.
 */
export function placedPlaceCloneProposal(identity: { readonly occurrenceId: SpatialId; readonly rootId: SpatialId }) {
  return {
    request: { operation: { kind: "clone-occurrence", request: { ...identity, externalConnections: "omit" } } } satisfies SpatialAuthoringRequest,
    destination: { tab: "places", mode: "instances", occurrenceId: identity.rootId },
    compile: { occurrenceId: identity.rootId },
  } as const;
}
