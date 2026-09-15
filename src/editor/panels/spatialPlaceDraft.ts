import { assertNever, spatialId } from "@/project/spatial/domain";
import { patchPlacedPlace } from "@/editor/spatial/placedPlaceEdits";
import type { SpatialDeletionImpact } from "@/project/spatial/ownership";
import { genId } from "@/util/id";
import type {
  PlaceDesign,
  SpatialChildSlot,
  SpatialGraphic,
  SpatialId,
  SpatialLibrary,
  SpatialLocalConnection,
} from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";

import { isFacilityChildLevelAllowed } from "@/project/spatial/facilityLevels";
export { FACILITY_FLOOR_MAX } from "@/project/spatial/facilityLevels";

export type PlaceDraftTarget = {
  readonly cardId: string;
  readonly localId: string;
  readonly name: string;
  readonly source: "default" | "own" | "placed";
  readonly libraryId?: SpatialId;
  readonly occurrenceId?: SpatialId;
};

export type PlaceDeletePreview = {
  readonly strong: readonly { readonly path: string }[];
  readonly historical: readonly string[];
  readonly occurrence?: SpatialDeletionImpact;
};

export type PlaceEditRejection = "ancestor" | "missing-floor" | "floor-limit" | "unknown-child";
export type PlaceEditResult =
  | { readonly kind: "ok"; readonly place: PlaceDesign }
  | { readonly kind: "rejected"; readonly code: PlaceEditRejection; readonly place: PlaceDesign };

export type PlaceChildPick = SpatialChildSlot<"space" | "place">;

export function placeDraftTarget(card: SpatialGalleryCard): PlaceDraftTarget {
  if (card.source === "placed") {
    return {
      cardId: card.id,
      localId: card.localId ?? card.id,
      name: card.name,
      source: "placed",
      occurrenceId: spatialId(card.id),
    };
  }
  const libraryId = !card.reviewedPlaceId && card.localId ? spatialId(card.localId) : undefined;
  return {
    cardId: card.id,
    localId: card.localId ?? card.id,
    name: card.name,
    source: card.source,
    ...(libraryId ? { libraryId } : {}),
  };
}

export function placeFromProject(project: Project, target: PlaceDraftTarget): PlaceDesign | undefined {
  const document = project.spatialAuthoring;
  if (!document) return undefined;
  if (target.occurrenceId) {
    const occurrence = document.occurrences[target.occurrenceId];
    if (occurrence?.kind !== "place") return undefined;
    return occurrence.snapshot.library.places[occurrence.source.id];
  }
  if (target.libraryId) return document.library.places[target.libraryId];
  return undefined;
}

export function upsertPlaceDesign(project: Project, design: PlaceDesign): Project {
  const document = project.spatialAuthoring;
  if (!document) return project;
  return {
    ...project,
    spatialAuthoring: {
      ...document,
      library: { ...document.library, places: { ...document.library.places, [design.id]: design } },
    },
  };
}

export function patchPlaceDesign(
  project: Project,
  designId: SpatialId,
  patch: (place: PlaceDesign) => PlaceDesign,
): Project {
  const document = project.spatialAuthoring;
  const current = document?.library.places[designId];
  if (!document || !current) return project;
  const next = patch(current);
  if (next === current) return project;
  return upsertPlaceDesign(project, { ...next, revision: current.revision + 1 });
}

export function patchOccurrencePlace(
  project: Project,
  occurrenceId: SpatialId,
  patch: (place: PlaceDesign) => PlaceDesign,
): Project {
  const document = project.spatialAuthoring;
  const occurrence = document?.occurrences[occurrenceId];
  if (!document || occurrence?.kind !== "place") return project;
  const current = occurrence.snapshot.library.places[occurrence.source.id];
  if (!current) return project;
  return patchPlacedPlace(project, occurrenceId, patch(current));
}

export function editPlace(
  project: Project,
  target: PlaceDraftTarget,
  patch: (place: PlaceDesign) => PlaceDesign,
): Project {
  if (target.occurrenceId) return patchOccurrencePlace(project, target.occurrenceId, patch);
  if (target.libraryId) return patchPlaceDesign(project, target.libraryId, patch);
  return project;
}

export function commitPlaceEdit(
  project: Project,
  target: PlaceDraftTarget,
  result: PlaceEditResult,
): Project {
  switch (result.kind) {
    case "rejected": return project;
    case "ok": return editPlace(project, target, () => result.place);
    default: return assertNever(result);
  }
}

function rejected(place: PlaceDesign, code: PlaceEditRejection): PlaceEditResult {
  return { kind: "rejected", code, place };
}

export function containsPlace(library: SpatialLibrary, fromId: SpatialId, targetId: SpatialId): boolean {
  const seen = new Set<string>();
  const walk = (id: SpatialId): boolean => {
    if (id === targetId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const design = library.places[id];
    if (!design) return false;
    return design.children.some((child) => child.source.kind === "place" && walk(child.source.id));
  };
  return walk(fromId);
}

export function nestChild(
  place: PlaceDesign,
  library: SpatialLibrary,
  slot: PlaceChildPick,
): PlaceEditResult {
  if (place.children.some((child) => child.id === slot.id)) return rejected(place, "unknown-child");
  switch (slot.source.kind) {
    case "space":
      if (!Object.hasOwn(library.spaces, slot.source.id)) return rejected(place, "unknown-child");
      break;
    case "place":
      if (!Object.hasOwn(library.places, slot.source.id)) return rejected(place, "unknown-child");
      if (containsPlace(library, slot.source.id, place.id)) return rejected(place, "ancestor");
      break;
    default:
      return assertNever(slot.source.kind);
  }
  if (place.kind === "facility" && !isFacilityChildLevelAllowed(library, slot)) {
    return rejected(place, "floor-limit");
  }
  return { kind: "ok", place: { ...place, children: [...place.children, slot] } };
}

export function connectLocal(place: PlaceDesign, connection: SpatialLocalConnection): PlaceEditResult {
  const owned = (endpoint: SpatialLocalConnection["from"]): boolean => {
    if (endpoint.childId === null) return place.ports.some((port) => port.id === endpoint.portId);
    return place.children.some((child) => child.id === endpoint.childId);
  };
  if (!owned(connection.from) || !owned(connection.to)) return rejected(place, "missing-floor");
  if (place.connections.some((entry) => entry.id === connection.id)) return rejected(place, "unknown-child");
  return { kind: "ok", place: { ...place, connections: [...place.connections, connection] } };
}

export function moveChild(place: PlaceDesign, childId: SpatialId, x: number, y: number): PlaceEditResult {
  if (!place.children.some((child) => child.id === childId)) return rejected(place, "unknown-child");
  return {
    kind: "ok",
    place: {
      ...place,
      children: place.children.map((child) => (
        child.id === childId ? { ...child, x: Math.floor(x), y: Math.floor(y) } : child
      )),
    },
  };
}

export function removeChild(place: PlaceDesign, childId: SpatialId): PlaceEditResult {
  if (!place.children.some((child) => child.id === childId)) return rejected(place, "unknown-child");
  return {
    kind: "ok",
    place: {
      ...place,
      children: place.children.filter((child) => child.id !== childId),
      connections: place.connections.filter((link) => link.from.childId !== childId && link.to.childId !== childId),
    },
  };
}

export function withPlaceLayout(place: PlaceDesign, layout: PlaceDesign["layout"]): PlaceDesign {
  return { ...place, layout };
}

export function withPlaceKind(place: PlaceDesign, kind: PlaceDesign["kind"]): PlaceDesign {
  return { ...place, kind };
}

export function withPlaceName(place: PlaceDesign, name: string): PlaceDesign {
  return { ...place, name };
}

export function withPlaceExterior(place: PlaceDesign, exterior: SpatialGraphic | undefined): PlaceDesign {
  if (exterior === undefined) {
    const { exterior: _removed, ...rest } = place;
    return rest;
  }
  return { ...place, exterior };
}

export function freshPlaceId(project: Project): SpatialId {
  const used = new Set<string>();
  const document = project.spatialAuthoring;
  if (document) {
    for (const records of Object.values(document.library)) {
      for (const id of Object.keys(records)) used.add(id);
    }
    for (const id of Object.keys(document.occurrences)) used.add(id);
  }
  let id = genId("place");
  while (used.has(id)) id = genId("place");
  return spatialId(id);
}

export function blankPlaceDesign(project: Project): PlaceDesign {
  return {
    id: freshPlaceId(project),
    name: "",
    revision: 1,
    tags: [],
    provenance: { origin: "user" },
    kind: "settlement",
    children: [],
    layout: "manual",
    ports: [],
    connections: [],
  };
}
