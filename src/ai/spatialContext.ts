import { checkedDocument } from "@/project/spatial/domain";
import type { Project } from "@/project/types";
import { spatialToolDesigns } from "@/editor/tools/spatialTools";

const kinds = ["object", "space", "place", "region", "world"] as const;

/** Bounded structured provenance survives prompt budget trimming, including missing live sources. */
export function spatialAuthoringContext(project: Project): string {
  if (project.spatialAuthoring === undefined) return "";
  const document = checkedDocument(project.spatialAuthoring, project);
  const designs = spatialToolDesigns(project);
  // A large prop library must not crowd complete facilities/geography out of discovery.
  const samples = kinds.flatMap(kind => designs.filter(design => design.kind === kind).slice(0, 6));
  const occurrences = Object.values(document.occurrences);
  const payload = {
    active: true,
    designs: samples.map(design => ({ kind: design.kind, id: design.id, name: design.name,
      revision: design.revision, tags: design.tags.slice(0, 8), children: design.children.slice(0, 16),
      ...("graphic" in design ? { graphic: design.graphic } : {}),
      ...("environment" in design ? { environment: design.environment, width: design.width, height: design.height } : {}),
      ...("placeKind" in design ? { placeKind: design.placeKind } : {}),
      ...("exterior" in design ? { exterior: design.exterior } : {}),
      ...("ports" in design ? { portCount: design.ports.length } : {}),
      ...("connections" in design ? { connectionCount: design.connections.length } : {}),
    })),
    designCount: designs.length,
    designCounts: Object.fromEntries(kinds.map(kind => [kind, designs.filter(design => design.kind === kind).length])),
    omittedDesignCount: designs.length - samples.length,
    occurrences: occurrences.slice(0, 30).map(occurrence => ({ id: occurrence.id, parentId: occurrence.parentId,
      source: occurrence.source, sourceMissing: !designs.some(design => design.kind === occurrence.source.kind && design.id === occurrence.source.id),
      generatorVersion: occurrence.generatorVersion,
      mapIds: [...new Set(occurrence.bindings.map(binding => binding.mapId))],
    })),
    occurrenceCount: occurrences.length,
  };
  // Escape delimiters in user-controlled names; content stays parseable JSON.
  return `Canonical spatial authoring: list_spatial_designs -> get_spatial_design -> upsert_spatial_design -> preview_spatial_build -> apply_spatial_build. Source edits never refresh frozen occurrences.
Object(사물) = reusable appearance/prop including building exterior; space(공간) = usable room/floor/yard; place(장소) = complete facility/settlement grouping spaces or places. A complete house is a place. Designs below are samples (up to 6 per kind); use list_spatial_designs kind:place for complete houses and kind:object query:건물 외형 or an authored name/tag for saved exteriors. Search the full library before reporting missing designs.
Read the exterior object with get_spatial_design. Place it through an outdoor yard space's objectSlots for ground and approach, or copy design.graphic into place.exterior ({tilesetId,kitId}) when painted passable port cells are available; the direct exterior copy has no objectDesignId link or anchors/chips inheritance. Author usable interior/outdoor spaces, ports and connections explicitly. Facade height, floor labels and child level never establish actual usable floor count or navigation; interior children remain separate maps even at the same level. Connect room doors, stairs and exterior entry/return; enclosing place ports need painted passable outdoor surface. Verify traversal after preview/apply.
<spatial-authoring>${JSON.stringify(payload).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}</spatial-authoring>`;
}
