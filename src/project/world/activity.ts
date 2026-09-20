import type { ProjectWorld, WorldEntity } from "./types";

/** Legacy automatic work logs belong to history, not authored codex documents.
 * Keep the stored originals intact: references, exports and manual annotations
 * must survive without replaying old work as newly timestamped commits.
 */
export function isWikiActivityRecord(entity: WorldEntity): boolean {
  return entity.origin === "ai" && entity.wiki?.kind === "progress"
    && entity.wiki.basis === "observed" && entity.wiki.sources.length > 0
    && entity.wiki.sources.every((source) => source.kind === "application");
}

export function legacyWikiActivity(world: ProjectWorld | undefined): readonly WorldEntity[] {
  const at = (entity: WorldEntity): number => Math.max(0, ...(entity.wiki?.sources.map((source) => source.at) ?? []));
  return (world?.entities ?? []).filter(isWikiActivityRecord)
    .sort((a, b) => at(b) - at(a) || a.id.localeCompare(b.id));
}
