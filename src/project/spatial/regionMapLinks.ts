import type { Project } from "@/project/types";

/** A whole-map, nonowning association. Never guess from names or provenance IDs. */
export function linkedRegionMapId(project: Project, sourceId: string, occurrenceId?: string): string | undefined {
  const document = project.spatialAuthoring;
  if (!document) return undefined;
  const candidates = Object.values(document.occurrences).filter(occurrence => {
    if (occurrence.kind !== "region" || occurrence.source.id !== sourceId || occurrence.parentId !== null) return false;
    if (occurrenceId ? occurrence.id !== occurrenceId : occurrence.source.revision !== document.library.regions[sourceId]?.revision) return false;
    const binding = occurrence.bindings[0];
    if (occurrence.bindings.length !== 1 || binding?.kind !== "projection") return false;
    const map = project.maps[binding.mapId];
    return map && binding.rect.x === 0 && binding.rect.y === 0
      && binding.rect.width === map.width && binding.rect.height === map.height;
  });
  return candidates.length === 1 ? candidates[0].bindings[0].mapId : undefined;
}
