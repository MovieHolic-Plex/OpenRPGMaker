import { spatialPresentationId } from "@/editor/panels/spatialPresentation";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { SpatialCompileError } from "@/editor/spatial/compilerTypes";
import { patchPlacedSpace } from "@/editor/spatial/placedSpaceEdits";
import { inspectSpatialDesignReferences } from "@/project/spatial/ownership";
import { assertNever, spatialId } from "@/project/spatial/domain";
import type {
  SpaceDesign,
  SpatialFloorArea,
  SpatialId,
  SpatialObjectSlot,
  SpatialPort,
} from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { genId } from "@/util/id";

export type SpaceDraftTarget = {
  readonly cardId: string;
  readonly localId: string;
  readonly name: string;
  readonly source: "default" | "own" | "placed";
  readonly libraryId?: SpatialId;
  readonly occurrenceId?: SpatialId;
};

export type SpaceDeletePreview = {
  readonly strong: readonly { readonly path: string }[];
  readonly historical: readonly string[];
};

const interiorAtlas = "easyrpg_chipset_interior";

export function cloneAuthoringProject(project: Project): Project {
  return structuredClone(project);
}

export function spaceDraftTarget(card: SpatialGalleryCard): SpaceDraftTarget {
  if (card.source === "placed") {
    return {
      cardId: card.id,
      localId: card.localId ?? card.id,
      name: card.name,
      source: "placed",
      occurrenceId: spatialId(card.id),
    };
  }
  const libraryId = card.compatibility || !card.localId ? undefined : spatialId(card.localId);
  return {
    cardId: card.id,
    localId: card.localId ?? card.id,
    name: card.name,
    source: card.source,
    ...(libraryId ? { libraryId } : {}),
  };
}

export function spaceFromProject(project: Project, target: SpaceDraftTarget): SpaceDesign | undefined {
  const document = project.spatialAuthoring;
  if (!document) return undefined;
  if (target.occurrenceId) {
    const occurrence = document.occurrences[target.occurrenceId];
    if (occurrence?.kind !== "space") return undefined;
    return occurrence.snapshot.library.spaces[occurrence.source.id];
  }
  if (target.libraryId) return document.library.spaces[target.libraryId];
  return undefined;
}

export function upsertSpaceDesign(project: Project, design: SpaceDesign): Project {
  const document = project.spatialAuthoring;
  if (!document) return project;
  return {
    ...project,
    spatialAuthoring: {
      ...document,
      library: { ...document.library, spaces: { ...document.library.spaces, [design.id]: design } },
    },
  };
}

export function patchSpaceDesign(
  project: Project,
  designId: SpatialId,
  patch: (space: SpaceDesign) => SpaceDesign,
): Project {
  const document = project.spatialAuthoring;
  const current = document?.library.spaces[designId];
  if (!document || !current) return project;
  const next = patch(current);
  if (next === current) return project;
  return upsertSpaceDesign(project, { ...next, revision: current.revision + 1 });
}

export function patchOccurrenceSpace(
  project: Project,
  occurrenceId: SpatialId,
  patch: (space: SpaceDesign) => SpaceDesign,
): Project {
  return patchPlacedSpace(project, occurrenceId, patch);
}

export function editSpace(project: Project, target: SpaceDraftTarget, patch: (space: SpaceDesign) => SpaceDesign): Project {
  if (target.occurrenceId) return patchOccurrenceSpace(project, target.occurrenceId, patch);
  if (target.libraryId) return patchSpaceDesign(project, target.libraryId, patch);
  return project;
}

export function withShape(space: SpaceDesign, shape: SpaceDesign["shape"]): SpaceDesign {
  return { ...space, shape };
}

export function withSize(space: SpaceDesign, width: number, height: number): SpaceDesign {
  const nextWidth = Math.max(1, Math.floor(width));
  const nextHeight = Math.max(1, Math.floor(height));
  return { ...space, width: nextWidth, height: nextHeight };
}

export function withEnvironment(space: SpaceDesign, environment: "interior" | "outdoor"): SpaceDesign {
  const base = {
    id: space.id,
    name: space.name,
    revision: space.revision,
    tags: space.tags,
    provenance: space.provenance,
    tilesetId: space.tilesetId,
    shape: space.shape,
    width: space.width,
    height: space.height,
    floor: space.floor,
    wall: space.wall,
    objectSlots: space.objectSlots,
    ports: space.ports,
  };
  switch (environment) {
    case "interior":
      return {
        ...base,
        environment: "interior",
        role: space.environment === "interior" ? space.role : "room",
        tilesetId: interiorAtlas,
      };
    case "outdoor":
      return {
        ...base,
        environment: "outdoor",
        floorAreas: space.environment === "outdoor"
          ? space.floorAreas
          : [{ kind: "rect", material: space.floor, x: 0, y: 0, width: space.width, height: space.height } satisfies SpatialFloorArea],
      };
    default:
      return assertNever(environment);
  }
}

export function moveSlot(space: SpaceDesign, slotId: SpatialId, x: number, y: number): SpaceDesign {
  return {
    ...space,
    objectSlots: space.objectSlots.map((slot) => {
      if (slot.id !== slotId) return slot;
      return { ...slot, placement: { mode: "fixed", x: Math.floor(x), y: Math.floor(y) } };
    }),
  };
}

export function setSlotRequired(space: SpaceDesign, slotId: SpatialId, required: boolean): SpaceDesign {
  return {
    ...space,
    objectSlots: space.objectSlots.map((slot) => slot.id === slotId ? { ...slot, required } : slot),
  };
}

export function setSlotChips(space: SpaceDesign, slotId: SpatialId, chips: readonly string[]): SpaceDesign {
  return {
    ...space,
    objectSlots: space.objectSlots.map((slot) => slot.id === slotId ? { ...slot, chipOverrides: chips } : slot),
  };
}

export function addFixedSlot(space: SpaceDesign, slot: SpatialObjectSlot): SpaceDesign {
  return { ...space, objectSlots: [...space.objectSlots, slot] };
}

export function movePort(space: SpaceDesign, portId: SpatialId, x: number, y: number): SpaceDesign {
  return {
    ...space,
    ports: space.ports.map((port) => port.id === portId ? { ...port, x: Math.floor(x), y: Math.floor(y) } : port),
  };
}

export function portNamed(name: string, x: number, y: number, id: string): SpatialPort {
  return { id: spatialId(id), name, x: Math.floor(x), y: Math.floor(y) };
}

export function slotFixed(id: string, objectDesignId: SpatialId, x: number, y: number, required = false): SpatialObjectSlot {
  return {
    id: spatialId(id),
    objectDesignId,
    quantity: 1,
    required,
    placement: { mode: "fixed", x: Math.floor(x), y: Math.floor(y) },
  };
}

export function previewSpaceLayout(project: Project, space: SpaceDesign): { ok: true } | { ok: false; code: string; path: string } {
  try {
    spaceLayout(project, space, { mapId: `spatial-preview:${space.id}`, seed: 7 });
    return { ok: true };
  } catch (error) {
    if (error instanceof SpatialCompileError) return { ok: false, code: error.code, path: error.path };
    throw error;
  }
}

export function previewSpaceDelete(project: Project, target: SpaceDraftTarget): SpaceDeletePreview | null {
  if (!target.libraryId || !project.spatialAuthoring) return null;
  const impact = inspectSpatialDesignReferences(
    project.spatialAuthoring,
    project,
    { kind: "space", id: target.libraryId },
  );
  return {
    strong: impact.strong.map((entry) => ({ path: entry.path })),
    historical: impact.historical.map(String),
  };
}

export function librarySpaceCardId(id: SpatialId): string {
  return spatialPresentationId("library-space", "library", id);
}

export function usedSpatialIds(project: Project): ReadonlySet<string> {
  const document = project.spatialAuthoring;
  const used = new Set<string>();
  if (!document) return used;
  for (const records of [document.library.objects, document.library.spaces, document.library.places, document.library.regions, document.library.worlds]) {
    for (const id of Object.keys(records)) used.add(id);
  }
  for (const id of Object.keys(document.occurrences)) used.add(id);
  return used;
}

export function freshSpatialId(project: Project, prefix: string): SpatialId {
  const used = usedSpatialIds(project);
  let id = genId(prefix);
  while (used.has(id)) id = genId(prefix);
  return spatialId(id);
}
