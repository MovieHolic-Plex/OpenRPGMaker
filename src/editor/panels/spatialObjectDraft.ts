import { bakeInteriorObject, bakeStructureKit, copyName } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { spatialPresentationId } from "@/editor/panels/spatialPresentation";
import { inspectSpatialDesignReferences } from "@/project/spatial/ownership";
import { spatialId } from "@/project/spatial/domain";
import type { ObjectDesign, SpatialId, SpatialPort } from "@/project/spatial/types";
import type { Project, SectionStructureKitDef, TilesetDef } from "@/project/types";

export type ObjectDraftTarget = {
  readonly cardId: string;
  readonly tilesetId: string;
  readonly kitId: string;
  readonly name: string;
  readonly source: "default" | "own" | "placed";
  readonly libraryId?: SpatialId;
};

export type ObjectDeletePreview = {
  readonly kitThings: readonly { readonly label: string }[];
  readonly strong: readonly { readonly path: string }[];
  readonly historical: readonly string[];
};

export function cloneAuthoringProject(project: Project): Project {
  return structuredClone(project);
}

export function atlasMismatch(project: Project, graphicTilesetId: string, mapId: string): string | null {
  const map = Object.hasOwn(project.maps, mapId) ? project.maps[mapId] : undefined;
  if (!map) return "대상 맵이 없습니다";
  if (map.tilesetId === graphicTilesetId) return null;
  return "다른 타일셋에는 찍을 수 없습니다";
}

export function copyBuiltinObjectIntoProject(input: {
  readonly project: Project;
  readonly tilesetId: string;
  readonly builtinId: string;
  readonly kitId: string;
  readonly designId?: string;
}): { readonly project: Project; readonly kit: SectionStructureKitDef } | { readonly error: string } {
  const object = interiorObjectById(input.builtinId);
  const tileset = input.project.tilesets[input.tilesetId];
  if (!object) return { error: "원본 오브젝트가 없습니다" };
  if (!tileset) return { error: "타일셋이 없습니다" };
  const names = (tileset.structureKits ?? []).map((kit) => kit.name ?? "구조물");
  const kit = bakeInteriorObject(object, input.kitId, copyName(object.label, names));
  const nextTileset: TilesetDef = {
    ...tileset,
    structureKits: [...(tileset.structureKits ?? []), kit],
  };
  let project: Project = {
    ...input.project,
    tilesets: { ...input.project.tilesets, [input.tilesetId]: nextTileset },
  };
  if (input.designId && project.spatialAuthoring) {
    project = upsertObjectDesign(project, {
      id: spatialId(input.designId),
      name: kit.name ?? object.label,
      revision: 1,
      tags: [],
      provenance: { origin: "user", sourceId: object.id },
      graphic: { tilesetId: input.tilesetId, kitId: kit.id },
      anchors: [{ id: spatialId(`${input.designId}-anchor`), name: "기준", x: 0, y: Math.max(0, object.height - 1) }],
      chips: [],
    });
  }
  return { project, kit };
}

export function duplicateOwnedKitIntoProject(input: {
  readonly project: Project;
  readonly tilesetId: string;
  readonly kitId: string;
  readonly nextKitId: string;
}): { readonly project: Project; readonly kit: SectionStructureKitDef } | { readonly error: string } {
  const tileset = input.project.tilesets[input.tilesetId];
  const source = tileset?.structureKits?.find((kit) => kit.id === input.kitId);
  if (!tileset || !source || source.kind !== "section") return { error: "복제할 구조물이 없습니다" };
  const names = (tileset.structureKits ?? []).map((kit) => kit.name ?? "구조물");
  const kit = bakeStructureKit(source, input.nextKitId, copyName(source.name ?? "구조물", names));
  const nextTileset: TilesetDef = { ...tileset, structureKits: [...(tileset.structureKits ?? []), kit] };
  return {
    project: { ...input.project, tilesets: { ...input.project.tilesets, [input.tilesetId]: nextTileset } },
    kit,
  };
}

export function renameOwnedKit(project: Project, tilesetId: string, kitId: string, name: string): Project {
  const trimmed = name.trim();
  const tileset = project.tilesets[tilesetId];
  if (!trimmed || !tileset?.structureKits) return project;
  return {
    ...project,
    tilesets: {
      ...project.tilesets,
      [tilesetId]: {
        ...tileset,
        structureKits: tileset.structureKits.map((kit) => kit.id === kitId ? { ...kit, name: trimmed } : kit),
      },
    },
  };
}

export function upsertObjectDesign(project: Project, design: ObjectDesign): Project {
  const document = project.spatialAuthoring;
  if (!document) return project;
  return {
    ...project,
    spatialAuthoring: {
      ...document,
      library: { ...document.library, objects: { ...document.library.objects, [design.id]: design } },
    },
  };
}

export function patchObjectDesign(
  project: Project,
  designId: SpatialId,
  patch: Partial<Pick<ObjectDesign, "name" | "graphic" | "anchors" | "chips">>,
): Project {
  const current = project.spatialAuthoring?.library.objects[designId];
  if (!current) return project;
  return upsertObjectDesign(project, {
    ...current,
    ...patch,
    revision: current.revision + 1,
  });
}

export function previewObjectDelete(project: Project, target: ObjectDraftTarget): ObjectDeletePreview {
  const tileset = project.tilesets[target.tilesetId];
  const kitThings = [];
  for (const bundle of tileset?.scratchConceptBundles ?? []) {
    for (const thing of bundle.things) {
      if (thing.objectId === target.kitId) kitThings.push({ label: `${bundle.label} / ${thing.label}` });
    }
  }
  const graphicRefs = Object.values(project.spatialAuthoring?.library.objects ?? {})
    .filter((design) => design.graphic.tilesetId === target.tilesetId && design.graphic.kitId === target.kitId && design.id !== target.libraryId)
    .map((design) => ({ path: `library.objects.${design.id}.graphic.kitId` }));
  if (!target.libraryId || !project.spatialAuthoring) {
    return { kitThings, strong: graphicRefs, historical: [] };
  }
  const impact = inspectSpatialDesignReferences(
    project.spatialAuthoring,
    { tilesets: project.tilesets, maps: project.maps },
    { kind: "object", id: target.libraryId },
  );
  return { kitThings, strong: [...impact.strong, ...graphicRefs], historical: impact.historical };
}

export function libraryObjectCardId(designId: string): string {
  return spatialPresentationId("library-object", "library", designId);
}

export function ownedKitCardId(tilesetId: string, kitId: string): string {
  return spatialPresentationId("tileset-kit", tilesetId, kitId);
}


export function replaceKitInProject(project: Project, tilesetId: string, kit: SectionStructureKitDef): Project {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return project;
  const kits = tileset.structureKits ?? [];
  const nextKits = kits.some((entry) => entry.id === kit.id)
    ? kits.map((entry) => entry.id === kit.id ? kit : entry)
    : [...kits, kit];
  return { ...project, tilesets: { ...project.tilesets, [tilesetId]: { ...tileset, structureKits: nextKits } } };
}

export function createBlankKitIntoProject(project: Project, tilesetId: string, kitId: string): { readonly project: Project; readonly kit: SectionStructureKitDef } | { readonly error: string } {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return { error: "타일셋이 없습니다" };
  const kit: SectionStructureKitDef = {
    id: kitId,
    kind: "section",
    name: "새 구조물",
    width: 3,
    height: 3,
    rows: [
      { tiles: [-1, -1, -1] },
      { tiles: [-1, -1, -1] },
      { tiles: [-1, -1, -1] },
    ],
    learnedFrom: "db-authored",
  };
  return { project: replaceKitInProject(project, tilesetId, kit), kit };
}


export function createBlankObjectIntoProject(input: {
  readonly project: Project;
  readonly tilesetId: string;
  readonly kitId: string;
  readonly designId?: string;
}): { readonly project: Project; readonly kit: SectionStructureKitDef; readonly designId?: SpatialId } | { readonly error: string } {
  const created = createBlankKitIntoProject(input.project, input.tilesetId, input.kitId);
  if ("error" in created) return created;
  if (!input.designId || !created.project.spatialAuthoring) return created;
  const designId = spatialId(input.designId);
  return {
    project: upsertObjectDesign(created.project, {
      id: designId,
      name: created.kit.name ?? "새 오브젝트",
      revision: 1,
      tags: [],
      provenance: { origin: "user" },
      graphic: { tilesetId: input.tilesetId, kitId: created.kit.id },
      anchors: [{ id: spatialId(`${input.designId}-anchor`), name: "기준", x: 0, y: 2 }],
      chips: [],
    }),
    kit: created.kit,
    designId,
  };
}

export function removeKitFromProject(project: Project, tilesetId: string, kitId: string): Project {
  const tileset = project.tilesets[tilesetId];
  if (!tileset?.structureKits) return project;
  return {
    ...project,
    tilesets: {
      ...project.tilesets,
      [tilesetId]: { ...tileset, structureKits: tileset.structureKits.filter((kit) => kit.id !== kitId) },
    },
  };
}

export function duplicateObjectIntoProject(input: {
  readonly project: Project;
  readonly tilesetId: string;
  readonly kitId: string;
  readonly nextKitId: string;
  readonly sourceDesignId?: SpatialId;
  readonly nextDesignId?: string;
}): { readonly project: Project; readonly kit: SectionStructureKitDef; readonly designId?: SpatialId } | { readonly error: string } {
  const copied = duplicateOwnedKitIntoProject({
    project: input.project, tilesetId: input.tilesetId, kitId: input.kitId, nextKitId: input.nextKitId,
  });
  if ("error" in copied) return copied;
  const sourceId = input.sourceDesignId;
  const nextId = input.nextDesignId;
  if (!sourceId || !nextId || !copied.project.spatialAuthoring) return copied;
  const source = copied.project.spatialAuthoring.library.objects[sourceId];
  if (!source) return copied;
  const designId = spatialId(nextId);
  return {
    project: upsertObjectDesign(copied.project, {
      ...source,
      id: designId,
      name: copied.kit.name ?? source.name,
      revision: 1,
      provenance: { origin: "user", sourceId: source.id },
      graphic: { tilesetId: input.tilesetId, kitId: copied.kit.id },
    }),
    kit: copied.kit,
    designId,
  };
}

export function objectAnchor(id: string, name: string, x: number, y: number): SpatialPort {
  return { id: spatialId(id), name, x, y };
}
