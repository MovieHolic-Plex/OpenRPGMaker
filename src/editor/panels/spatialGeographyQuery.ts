import { spatialPresentationId } from "@/editor/panels/spatialPresentation";
import { compileSpatialOccurrence, SpatialCompileError } from "@/editor/spatial/compileSpatialOccurrence";
import { findOccurrenceChildId } from "@/project/spatial/domain";
import { inspectSpatialDesignReferences } from "@/project/spatial/ownership";
import type { SpatialChildSlot, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { GeographyDesign, GeographyDraftTarget, GeographyKind } from "@/editor/panels/spatialGeographyDraft";
import { geographyChildren } from "@/editor/panels/spatialGeographyGeometry";

export type GeographyDeletePreview = {
  readonly strong: readonly { readonly path: string }[];
  readonly historical: readonly string[];
};

export function libraryPlaceCardId(id: SpatialId): string {
  return spatialPresentationId("library-place", "library", id);
}

export function libraryRegionCardId(id: SpatialId): string {
  return spatialPresentationId("library-region", "library", id);
}

export function libraryWorldCardId(id: SpatialId): string {
  return spatialPresentationId("library-world", "library", id);
}

export function libraryGeographyCardId(kind: GeographyKind, id: SpatialId): string {
  return kind === "region" ? libraryRegionCardId(id) : libraryWorldCardId(id);
}

export function previewGeographyDelete(project: Project, target: GeographyDraftTarget): GeographyDeletePreview | null {
  if (!target.libraryId || !project.spatialAuthoring) return null;
  const impact = inspectSpatialDesignReferences(
    project.spatialAuthoring,
    project,
    { kind: target.kind, id: target.libraryId },
  );
  return {
    strong: impact.strong.map((entry) => ({ path: entry.path })),
    historical: impact.historical.map(String),
  };
}

export function previewGeographyCompile(
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

export function childOccurrenceId(
  project: Project,
  parentOccurrenceId: SpatialId,
  slotId: SpatialId,
  index = 0,
): SpatialId | undefined {
  const document = project.spatialAuthoring;
  if (!document?.occurrences[parentOccurrenceId]) return undefined;
  return findOccurrenceChildId(document, parentOccurrenceId, { slotId, index });
}

/** Instance boards use persisted parent-slot occurrence coords; source boards use design slots. */
export function geographyViewChildren(
  project: Project,
  design: GeographyDesign,
  occurrenceId?: SpatialId,
): readonly SpatialChildSlot<"space" | "place" | "region">[] {
  const slots = geographyChildren(design);
  if (!occurrenceId) return slots;
  return slots.map((slot) => {
    const id = childOccurrenceId(project, occurrenceId, slot.id);
    const child = id ? project.spatialAuthoring?.occurrences[id] : undefined;
    return child ? { ...slot, x: child.x, y: child.y, level: child.level } : slot;
  });
}
