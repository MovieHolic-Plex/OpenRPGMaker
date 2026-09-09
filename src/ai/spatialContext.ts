import { checkedDocument } from "@/project/spatial/domain";
import type { Project } from "@/project/types";
import { spatialToolDesigns } from "@/editor/tools/spatialTools";

/** Bounded structured provenance survives prompt budget trimming, including missing live sources. */
export function spatialAuthoringContext(project: Project): string {
  if (project.spatialAuthoring === undefined) return "";
  const document = checkedDocument(project.spatialAuthoring, project);
  const designs = spatialToolDesigns(project);
  const occurrences = Object.values(document.occurrences);
  const payload = {
    active: true,
    designs: designs.slice(0, 30).map(design => ({ kind: design.kind, id: design.id, name: design.name,
      revision: design.revision, children: design.children.slice(0, 16) })),
    designCount: designs.length,
    occurrences: occurrences.slice(0, 30).map(occurrence => ({ id: occurrence.id, parentId: occurrence.parentId,
      source: occurrence.source, sourceMissing: !designs.some(design => design.kind === occurrence.source.kind && design.id === occurrence.source.id),
      generatorVersion: occurrence.generatorVersion,
      mapIds: [...new Set(occurrence.bindings.map(binding => binding.mapId))],
    })),
    occurrenceCount: occurrences.length,
  };
  // Escape delimiters in user-controlled names; content stays parseable JSON.
  return `Canonical spatial authoring: list_spatial_designs -> get_spatial_design -> upsert_spatial_design -> preview_spatial_build -> apply_spatial_build. Source edits never refresh frozen occurrences.\n<spatial-authoring>${JSON.stringify(payload).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}</spatial-authoring>`;
}
