import { previewSpatialAuthoring } from "@/editor/spatial/preview";
import type { SpatialStampTarget } from "@/editor/spatial/compilerTypes";
import { checkedDocument, designNode, designSlots, own } from "@/project/spatial/domain";
import { choice, id, integer, point, record, rect } from "@/project/spatial/guardValues";
import { resolveSpatialDesign } from "@/project/spatial/resolve";
import type { Project } from "@/project/types";
import type { SpatialDesignReference } from "@/project/spatial/types";
import { authorizeSpatialToolChange, consumeSpatialToolPreview, issueSpatialToolPreview } from "./spatialToolState";
import { SPATIAL_APPLY_SCHEMA, SPATIAL_BUILD_SCHEMA, SPATIAL_GET_SCHEMA, SPATIAL_LIST_SCHEMA, SPATIAL_UPSERT_SCHEMA } from "./spatialToolSchemas";
import { ToolError, type ToolDefinition } from "./types";

const kinds = ["object", "space", "place", "region", "world"] as const;
const collections = { object: "objects", space: "spaces", place: "places", region: "regions", world: "worlds" } as const;
const parseKind = choice(kinds);
function source(args: Record<string, unknown>): SpatialDesignReference {
  return { kind: parseKind(args.kind, "kind"), id: id(args.id, "id") };
}
export function spatialToolDesigns(project: Project) {
  if (project.spatialAuthoring === undefined) return [];
  const document = checkedDocument(project.spatialAuthoring, project);
  return kinds.flatMap(kind => Object.keys(document.library[collections[kind]]).map(key => {
    const node = designNode(document.library, { kind, id: id(key, "designId") });
    return { ...node.design, kind, children: designSlots(node).map(slot => ({ id: slot.id, source: slot.source, quantity: slot.quantity })) };
  }));
}
function target(value: unknown): SpatialStampTarget | undefined {
  if (value === undefined) return undefined;
  const input = record(value, "target", "mapId rect entry");
  return { mapId: id(input.mapId, "target.mapId"), rect: rect(input.rect, "target.rect"), entry: point(input.entry, "target.entry") };
}
export const SPATIAL_TOOLS: readonly ToolDefinition[] = [
  { name: "list_spatial_designs", mode: "read", domains: ["map", "database", "world"],
    description: "Discover canonical object, space, place, region and world designs across all project tilesets. Read-only; never activates or seeds an empty library. Use explicit project activation to import legacy/default designs.",
    parameters: SPATIAL_LIST_SCHEMA,
    run(project, args) {
      const kind = args.kind === undefined ? undefined : parseKind(args.kind, "kind");
      const query = typeof args.query === "string" ? args.query.toLocaleLowerCase() : "";
      const designs = spatialToolDesigns(project).filter(design => (!kind || design.kind === kind)
        && [design.id, design.name, ...design.tags].some(value => value.toLocaleLowerCase().includes(query)));
      return { summary: `${designs.length} spatial designs`, data: { active: project.spatialAuthoring !== undefined, designs } };
    },
  },
  { name: "get_spatial_design", mode: "read", domains: ["map", "database", "world"],
    description: "Read a canonical design and its resolved transitive source revisions, object selections and frozen kit cells. Use the returned kind-specific design as the starting point for upsert_spatial_design.",
    parameters: SPATIAL_GET_SCHEMA,
    run(project, args) {
      const ref = source(args);
      const document = checkedDocument(project.spatialAuthoring, project);
      return { summary: `Spatial ${ref.kind}: ${ref.id}`, data: {
        ...designNode(document.library, ref), resolved: resolveSpatialDesign(document, project, ref),
      } };
    },
  },
  { name: "upsert_spatial_design", mode: "write", domains: ["map", "database", "world"],
    description: "Author one canonical design in the detached AI proposal. Supply exactly the body named by kind (object/space/place/region/world). expectedRevision=0 creates a new id; updates require the current revision and design.revision=current+1. References must already exist. Never refreshes frozen occurrences or overwrites maps. Uses normal proposal acceptance.",
    parameters: SPATIAL_UPSERT_SCHEMA,
    run(project, args) {
      const kind = parseKind(args.kind, "kind");
      for (const other of kinds) if (other !== kind && args[other] !== undefined) throw new ToolError(`Unexpected ${other} body for ${kind}`, { code: "invalid-args" });
      const raw = record(args[kind], kind);
      const designId = id(raw.id, `${kind}.id`);
      const document = checkedDocument(project.spatialAuthoring, project);
      const collection = collections[kind];
      const previous = Object.hasOwn(document.library[collection], designId) ? designNode(document.library, { kind, id: designId }).design : undefined;
      const expected = integer([0, Number.MAX_SAFE_INTEGER])(args.expectedRevision, "expectedRevision");
      if (expected !== (previous?.revision ?? 0) || raw.revision !== expected + 1) throw new ToolError("Source revision conflict", { code: "spatial-stale-source" });
      const proposed = { ...project, spatialAuthoring: checkedDocument({ ...document, library: { ...document.library,
        [collection]: { ...document.library[collection], [designId]: raw },
      } }, project) };
      const preview = previewSpatialAuthoring(proposed, { operation: { kind: "edit" } }, { original: project, checkpoint: project });
      const before = { ...project };
      project.spatialAuthoring = preview.project.spatialAuthoring;
      authorizeSpatialToolChange(project, before);
      return { summary: `Spatial ${kind} ${designId} revision ${expected + 1}`, data: designNode(checkedDocument(project.spatialAuthoring, project).library, { kind, id: designId }) };
    },
  },
  { name: "preview_spatial_build", mode: "read", domains: ["map", "world"],
    description: "Preview a fresh frozen occurrence through the shared validated compiler without changing project data. Object requires an explicit compatible target map rectangle and entry; other kinds generate maps. Returns a draft-owned previewId for apply_spatial_build. Existing occurrences are never implicitly refreshed.",
    parameters: SPATIAL_BUILD_SCHEMA,
    run(project, args) {
      const ref = source(args);
      const occurrenceId = id(args.occurrenceId, "occurrenceId");
      const stamp = target(args.target);
      const preview = previewSpatialAuthoring(project, {
        operation: { kind: "instantiate", request: { source: ref, rootId: occurrenceId, x: 0, y: 0, level: 0,
          seed: integer([-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])(args.seed, "seed"), generatorVersion: "spatial-ai-v1" } },
        compile: { occurrenceId, ...(stamp ? { target: stamp } : {}) },
      }, { original: project, checkpoint: project });
      return { summary: `Preview ${ref.kind} ${ref.id}: ${preview.impact.mapIds.length} maps`, data: {
        previewId: issueSpatialToolPreview(project, preview), impact: preview.impact,
        source: own(checkedDocument(preview.project.spatialAuthoring, preview.project).occurrences, occurrenceId).source,
      } };
    },
  },
  { name: "apply_spatial_build", mode: "write", domains: ["map", "world"],
    description: "Accept an exact preview_spatial_build result into the detached AI proposal. Requires the issued previewId and unchanged draft. This does not publish the live store; the normal AI proposal acceptance path owns publication and undo.",
    parameters: SPATIAL_APPLY_SCHEMA,
    run(project, args) {
      const preview = consumeSpatialToolPreview(project, id(args.previewId, "previewId"));
      const before = { ...project };
      const accepted = structuredClone(preview.project);
      Object.assign(project, accepted);
      authorizeSpatialToolChange(project, before);
      return { summary: `Spatial build: ${preview.impact.mapIds.length} maps`, data: { impact: preview.impact } };
    },
  },
];
