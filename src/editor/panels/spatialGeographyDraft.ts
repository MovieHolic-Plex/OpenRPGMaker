import { assertNever, findOccurrenceChildId, spatialId } from "@/project/spatial/domain";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { villagePresetPlaza } from "@/editor/tools/village/plazaLayout";
import { genId } from "@/util/id";
import type {
  RegionDesign,
  SpatialAuthoringDocument,
  SpatialId,
  SpatialOccurrence,
  SpatialTerrain,
  WorldDesign,
} from "@/project/spatial/types";
import type { Project } from "@/project/types";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
export type GeographyKind = "region" | "world";
export type GeographyDesign = RegionDesign | WorldDesign;
export type GeographyDraftTarget = {
  readonly cardId: string;
  readonly localId: string;
  readonly name: string;
  readonly source: "default" | "own" | "placed";
  readonly kind: GeographyKind;
  readonly libraryId?: SpatialId;
  readonly occurrenceId?: SpatialId;
};
export type GeographyRejection =
  | "clipped"
  | "diagonal"
  | "endpoint"
  | "unknown-child"
  | "material"
  | "level"
  | "port";
export type GeographyEditResult<T extends GeographyDesign = GeographyDesign> =
  | { readonly kind: "ok"; readonly design: T }
  | { readonly kind: "rejected"; readonly code: GeographyRejection; readonly design: T };

export function geographyDraftTarget(card: SpatialGalleryCard, kind: GeographyKind): GeographyDraftTarget {
  if (card.source === "placed") {
    return {
      cardId: card.id,
      localId: card.localId ?? card.id,
      name: card.name,
      source: "placed",
      kind,
      occurrenceId: spatialId(card.id),
    };
  }
  const libraryId = card.localId ? spatialId(card.localId) : undefined;
  return {
    cardId: card.id,
    localId: card.localId ?? card.id,
    name: card.name,
    source: card.source,
    kind,
    ...(libraryId ? { libraryId } : {}),
  };
}

export function geographyFromProject(project: Project, target: GeographyDraftTarget): GeographyDesign | undefined {
  const document = project.spatialAuthoring;
  if (!document) return undefined;
  if (target.occurrenceId) {
    const occurrence = document.occurrences[target.occurrenceId];
    if (occurrence?.kind !== target.kind) return undefined;
    return target.kind === "region"
      ? occurrence.snapshot.library.regions[occurrence.source.id]
      : occurrence.snapshot.library.worlds[occurrence.source.id];
  }
  if (!target.libraryId) return undefined;
  return target.kind === "region"
    ? document.library.regions[target.libraryId]
    : document.library.worlds[target.libraryId];
}

export function withGeographyName<T extends GeographyDesign>(design: T, name: string): T {
  return { ...design, name };
}

export function upsertGeography(project: Project, kind: GeographyKind, design: GeographyDesign): Project {
  const document = project.spatialAuthoring;
  if (!document) return project;
  if (kind === "region" && "places" in design) {
    return {
      ...project,
      spatialAuthoring: {
        ...document,
        library: { ...document.library, regions: { ...document.library.regions, [design.id]: design } },
      },
    };
  }
  if (kind === "world" && "entryPort" in design) {
    return {
      ...project,
      spatialAuthoring: {
        ...document,
        library: { ...document.library, worlds: { ...document.library.worlds, [design.id]: design } },
      },
    };
  }
  return project;
}

function bump<T extends GeographyDesign>(current: T, next: T): T {
  if (next === current) return current;
  return { ...next, revision: current.revision + 1 };
}

function syncPlacedChildren(
  document: SpatialAuthoringDocument,
  parentId: SpatialId,
  change: { readonly before: GeographyDesign; readonly after: GeographyDesign },
): SpatialAuthoringDocument["occurrences"] {
  const before = "places" in change.before ? change.before.places : change.before.regions;
  const after = "places" in change.after ? change.after.places : change.after.regions;
  const next: Record<string, SpatialOccurrence> = { ...document.occurrences };
  for (const slot of after) {
    const previous = before.find(entry => entry.id === slot.id);
    // Unchanged frozen slots are not instructions to reset actual occurrence overrides.
    if (!previous || previous.x === slot.x && previous.y === slot.y && previous.level === slot.level) continue;
    const id = findOccurrenceChildId(document, parentId, { slotId: slot.id, index: 0 });
    if (!id) continue;
    const child = next[id];
    if (!child) continue;
    if (child.x === slot.x && child.y === slot.y && child.level === slot.level) continue;
    next[id] = { ...child, x: slot.x, y: slot.y, level: slot.level };
  }
  return next;
}

export function editGeography(
  project: Project,
  target: GeographyDraftTarget,
  patch: (design: GeographyDesign) => GeographyDesign,
): Project {
  const document = project.spatialAuthoring;
  if (!document) return project;
  if (target.occurrenceId) {
    const occurrence = document.occurrences[target.occurrenceId];
    if (occurrence?.kind !== target.kind) return project;
    const current = geographyFromProject(project, target);
    if (!current) return project;
    const next = patch(current);
    const library = occurrence.snapshot.library;
    const snapshotLibrary = target.kind === "region" && "places" in next
      ? { ...library, regions: { ...library.regions, [occurrence.source.id]: next } }
      : target.kind === "world" && "entryPort" in next
        ? { ...library, worlds: { ...library.worlds, [occurrence.source.id]: next } }
        : library;
    const occurrences = {
      ...syncPlacedChildren(document, target.occurrenceId, { before: current, after: next }),
      // Narrow before spreading so parentSlot retains its snapshot-port correlation.
      [target.occurrenceId]: occurrence.parentSlot === undefined
        ? { ...occurrence, snapshot: { ...occurrence.snapshot, library: snapshotLibrary } }
        : { ...occurrence, snapshot: { ...occurrence.snapshot, library: snapshotLibrary } },
    };
    return {
      ...project,
      spatialAuthoring: { ...document, occurrences },
    };
  }
  if (!target.libraryId) return project;
  const current = geographyFromProject(project, target);
  if (!current) return project;
  return upsertGeography(project, target.kind, bump(current, patch(current)));
}

export function commitGeographyEdit(
  project: Project,
  target: GeographyDraftTarget,
  result: GeographyEditResult,
): Project {
  switch (result.kind) {
    case "rejected": return project;
    case "ok": return editGeography(project, target, () => result.design);
    default: return assertNever(result);
  }
}

export function freshGeographyId(project: Project, kind: GeographyKind): SpatialId {
  const used = new Set<string>();
  const document = project.spatialAuthoring;
  if (document) {
    for (const records of Object.values(document.library)) {
      for (const id of Object.keys(records)) used.add(id);
    }
    for (const id of Object.keys(document.occurrences)) used.add(id);
  }
  let id = genId(kind);
  while (used.has(id)) id = genId(kind);
  return spatialId(id);
}

function blankTerrain(width: number, height: number): SpatialTerrain {
  return { tilesetId: "easyrpg_chipset_world", width, height, floor: "ground", areas: [] };
}

export function blankRegionDesign(project: Project): RegionDesign {
  return {
    id: freshGeographyId(project, "region"),
    name: "",
    revision: 1,
    tags: [],
    provenance: { origin: "user" },
    terrain: blankTerrain(128, 96),
    places: [],
    ports: [],
    routes: [],
  };
}

/** 정주지 지역 — 지형은 combined_town(마을 시공 전용 칩셋), 본문은 설계서+시드가 채운다. */
export function blankSettlementRegionDesign(project: Project, presetId: string, name = ""): RegionDesign {
  const preset = project.villagePresets?.find(p => p.id === presetId);
  const profile = preset?.design?.objectVillage;
  const width = profile?.previewSize.width ?? 50, height = profile?.previewSize.height ?? 50;
  const plaza = profile ? villagePresetPlaza({ x: 0, y: 0, w: width, h: height }, preset, 1) : undefined;
  return {
    id: freshGeographyId(project, "region"),
    name,
    revision: 1,
    tags: ["settlement"],
    provenance: { origin: "user" },
    terrain: { tilesetId: COMBINED_TOWN_TILESET_ID, width, height, floor: "ground", areas: [] },
    places: [],
    ports: [{ id: spatialId(genId("port")), name: plaza ? "마을 광장" : "남쪽 출구", x: plaza?.centerX ?? Math.floor(width / 2), y: plaza?.centerRow ?? height - 1 }],
    routes: [],
    settlement: { presetId, seed: 1 },
  };
}

export function blankWorldDesign(project: Project): WorldDesign {
  return {
    id: freshGeographyId(project, "world"),
    name: "",
    revision: 1,
    tags: [],
    provenance: { origin: "user" },
    terrain: blankTerrain(96, 64),
    regions: [],
    ports: [],
    connections: [],
    entryPort: { childId: null, portId: spatialId("entry") },
  };
}
