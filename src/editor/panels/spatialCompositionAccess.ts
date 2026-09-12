import { checkedDocument, designNode, requireOccurrenceAssociations, spatialId, type DesignNode } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { compositionOf } from "@/project/spatial/composition";
import type { SpatialComposition, SpatialDesignReference } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { mixedCompositionRaster, type MixedRaster } from "@/editor/spatial/mixedCompositionRaster";
import { editAuthoringDraft, visibleAuthoringProject, spatialAuthoringErrorText } from "./spatialAuthoringAccess";
import { randomUuid } from "@/util/id";

export const COMPOSITION_NAMES = { object: "오브젝트", space: "공간", place: "장소", region: "지역", world: "세계" } as const;
export const COMPOSITION_COLLECTIONS = { object: "objects", space: "spaces", place: "places", region: "regions", world: "worlds" } as const;
export function defaultComposition(project: Project, node: DesignNode): SpatialComposition {
  const current = compositionOf(node);
  if (current) return current;
  if (node.kind === "space") return { tilesetId: node.design.tilesetId,
    width: node.design.width + (node.design.environment === "interior" ? 4 : 0), height: node.design.height + (node.design.environment === "interior" ? 6 : 0), tiles: [], members: [] };
  if (node.kind === "region" || node.kind === "world") return { tilesetId: node.design.terrain.tilesetId, width: node.design.terrain.width, height: node.design.terrain.height, tiles: [], members: [] };
  const firstSpace = Object.values(project.spatialAuthoring?.library.spaces ?? {})[0];
  return { tilesetId: node.kind === "object" ? node.design.graphic.tilesetId : node.design.exterior?.tilesetId ?? firstSpace?.tilesetId ?? Object.keys(project.tilesets)[0], width: 40, height: 30, tiles: [], members: [] };
}
export function withComposition(project: Project, source: SpatialDesignReference, composition: SpatialComposition): Project {
  const doc = project.spatialAuthoring;
  if (!doc || source.kind === "object") return project;
  const node = designNode(doc.library, source);
  const collection = COMPOSITION_COLLECTIONS[source.kind];
  return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library,
    [collection]: { ...doc.library[collection], [source.id]: { ...node.design, composition } } } } };
}
export function editComposition(source: SpatialDesignReference, mutate: (value: SpatialComposition) => SpatialComposition): string | null {
  try {
    const project = visibleAuthoringProject();
    const next = withComposition(project, source, mutate(defaultComposition(project, designNode(project.spatialAuthoring!.library, source))));
    checkedDocument(next.spatialAuthoring, next);
    compositionPreview(next, source);
    return spatialAuthoringErrorText(editAuthoringDraft(() => next));
  } catch (error) { return error instanceof Error ? error.message : String(error); }
}
const cache = new WeakMap<Project, Map<string, MixedRaster>>();
export function compositionPreview(project: Project, source: SpatialDesignReference): MixedRaster {
  let entries = cache.get(project); if (!entries) { entries = new Map(); cache.set(project, entries); }
  const key = `${source.kind}:${source.id}`;
  const cached = entries.get(key); if (cached) return cached;
  const node = designNode(project.spatialAuthoring!.library, source);
  const previewProject = structuredClone(withComposition(project, source, defaultComposition(project, node)));
  const id = spatialId(`composition-preview:${randomUuid()}`);
  const document = instantiateSpatialDesign(previewProject.spatialAuthoring, previewProject, { source, rootId: id, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "composition-preview" });
  const raster = mixedCompositionRaster({ project: previewProject, document, occurrence: requireOccurrenceAssociations(document.occurrences[id]) });
  entries.set(key, raster); return raster;
}
export function currentComposition(source: SpatialDesignReference): SpatialComposition {
  const project = visibleAuthoringProject();
  return defaultComposition(project, designNode(project.spatialAuthoring!.library, source));
}

/** Existing recipes retain their shape; moving one automatic repetition splits only that repetition. */
export function editExistingComponent(source: SpatialDesignReference, slotId: string, point: { x: number; y: number } | null): string | null {
  const mutate = (project: Project): Project => {
    const doc = project.spatialAuthoring!;
    const node = designNode(doc.library, source);
    if (node.kind === "object") return project;
    let design: typeof node.design;
    if (node.kind === "space") {
      const slot = node.design.objectSlots.find(slot => slot.id === slotId);
      if (!slot) return project;
      const rest = node.design.objectSlots.filter(item => item.id !== slot.id);
      if (slot.quantity > 1) rest.push({ ...slot, quantity: slot.quantity - 1 });
      if (point) rest.push({ ...slot, id: slot.quantity > 1 ? spatialId(`slot_${randomUuid()}`) : slot.id, quantity: 1,
        placement: { mode: "fixed", x: point.x - (node.design.environment === "interior" ? 2 : 0), y: point.y - (node.design.environment === "interior" ? 4 : 0) } });
      design = { ...node.design, objectSlots: rest };
    } else {
      const field = node.kind === "place" ? "children" : node.kind === "region" ? "places" : "regions";
      const slots = node.kind === "place" ? node.design.children : node.kind === "region" ? node.design.places : node.design.regions;
      design = { ...node.design, [field]: point ? slots.map(slot => slot.id === slotId ? { ...slot, ...point } : slot) : slots.filter(slot => slot.id !== slotId) };
    }
    const collection = COMPOSITION_COLLECTIONS[source.kind];
    return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library, [collection]: { ...doc.library[collection], [source.id]: design } } } };
  };
  try {
    const next = mutate(visibleAuthoringProject()); checkedDocument(next.spatialAuthoring, next);
    compositionPreview(next, source);
    return spatialAuthoringErrorText(editAuthoringDraft(() => next));
  } catch (error) { return error instanceof Error ? error.message : String(error); }
}
