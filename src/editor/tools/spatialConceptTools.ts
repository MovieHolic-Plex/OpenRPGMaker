import { canonicalConceptSource } from "@/editor/spatial/legacyConcepts";
import { previewSpatialAuthoring } from "@/editor/spatial/preview";
import { checkedDocument, designNode, spatialId } from "@/project/spatial/domain";
import { resolveSpatialDesign } from "@/project/spatial/resolve";
import type { Project } from "@/project/types";
import { authorizeSpatialToolChange } from "./spatialToolState";
import { spatialToolDesigns } from "./spatialTools";
import { ToolError, type ToolExecResult } from "./types";

export function getCanonicalConcept(project: Project, args: Record<string, unknown>): ToolExecResult {
  const query = typeof args.query === "string" ? args.query : "";
  const source = canonicalConceptSource(project, query, typeof args.tilesetId === "string" ? args.tilesetId : undefined);
  const document = checkedDocument(project.spatialAuthoring, project);
  const canonical = source ? { ...designNode(document.library, source), resolved: resolveSpatialDesign(document, project, source) } : null;
  return { summary: source ? `Canonical facility ${source.id}` : "Canonical facility discovery", data: {
    canonical, sources: spatialToolDesigns(project),
    tools: ["get_spatial_design", "upsert_spatial_design", "preview_spatial_build", "apply_spatial_build"],
  } };
}
export function placeCanonicalConcept(project: Project, args: Record<string, unknown>): ToolExecResult {
  if (args.plan !== undefined) throw new ToolError("Canonical mode requires kind-specific upsert_spatial_design before placement; legacy plan cannot overwrite the library", { code: "spatial-design-required" });
  const query = typeof args.query === "string" ? args.query : "";
  const source = canonicalConceptSource(project, query, typeof args.tilesetId === "string" ? args.tilesetId : undefined);
  if (!source) throw new ToolError(`Canonical facility not found: ${query}`, { code: "concept-not-found" });
  const rootId = spatialId(String(args.mapId));
  if (Object.hasOwn(project.maps, rootId)) throw new ToolError(`Map already exists: ${rootId}`, { code: "spatial-ownership" });
  const preview = previewSpatialAuthoring(project, {
    operation: { kind: "instantiate", request: { source, rootId, x: 0, y: 0, level: 0,
      seed: typeof args.seed === "number" ? args.seed : 0, generatorVersion: "spatial-ai-v1" } },
    compile: { occurrenceId: rootId },
  }, { original: project, checkpoint: project });
  const before = { ...project };
  Object.assign(project, structuredClone(preview.project));
  authorizeSpatialToolChange(project, before);
  return { summary: `Canonical facility ${source.id}: ${preview.impact.mapIds.length} maps`, data: {
    occurrenceId: rootId, mapId: preview.impact.mapIds[0], mapIds: preview.impact.mapIds, impact: preview.impact,
  } };
}
