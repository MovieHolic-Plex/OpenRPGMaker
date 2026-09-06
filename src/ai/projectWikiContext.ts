import type { Project } from "@/project/types";
import { activeWikiEntities, wikiOrder } from "@/project/world/wiki";
import type { WikiCombatMode, WorldEntity } from "@/project/world/types";

export interface ProjectWikiContextResult {
  readonly text: string;
  readonly selectedIds: readonly string[];
}

function inScope(entity: WorldEntity, mapId?: string | null): boolean {
  const maps = (entity.refs ?? []).filter((ref) => ref.kind === "map");
  return maps.length === 0 || maps.some((ref) => ref.id === mapId);
}

function mapSpecific(entity: WorldEntity): boolean {
  return !!entity.refs?.some((ref) => ref.kind === "map");
}

/** Explicit authored decisions alone drive the machine route; inferred defaults stay in read context. */
export function resolveWikiCombatMode(project: Project, mapId?: string | null): { readonly mode: WikiCombatMode; readonly sourceId: string } | undefined {
  const candidates = activeWikiEntities(project.world)
    .filter((entity) => entity.wiki?.kind === "declaration" && entity.wiki.basis === "explicit" && entity.wiki.combatMode && inScope(entity, mapId))
    .sort((a, b) => Number(mapSpecific(b)) - Number(mapSpecific(a)) || wikiOrder(b) - wikiOrder(a) || a.id.localeCompare(b.id));
  const wiki = candidates[0]?.wiki;
  const source = wiki?.sources.slice().sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))[0];
  return wiki?.combatMode && source ? { mode: wiki.combatMode, sourceId: source.id } : undefined;
}

/** At most eight relevant documents and 6000 characters, with provenance kept distinct from content. */
export function projectWikiContext(project: Project, options: { readonly query: string; readonly mapId?: string | null }): ProjectWikiContextResult {
  const terms = [...new Set(options.query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [])].slice(0, 32);
  const candidates = [...activeWikiEntities(project.world), ...(project.world?.entities.filter((entity) => !entity.wiki) ?? [])]
    .filter((entity) => inScope(entity, options.mapId))
    .map((entity) => {
      const text = `${entity.name} ${entity.summary} ${entity.tags?.join(" ") ?? ""} ${entity.body?.slice(0, 4000) ?? ""}`.toLowerCase();
      const relevance = terms.reduce((sum, term) => sum + Number(text.includes(term)), 0);
      const declaration = entity.wiki?.kind === "declaration";
      const score = relevance * 20 + (declaration ? 10000 : 0) + (mapSpecific(entity) ? 5 : 0) + (declaration && entity.wiki?.basis === "explicit" ? 1000 : 0);
      return { entity, score, relevant: relevance > 0 || declaration || mapSpecific(entity) };
    })
    .filter((entry) => entry.relevant)
    .sort((a, b) => b.score - a.score || wikiOrder(b.entity) - wikiOrder(a.entity) || a.entity.id.localeCompare(b.entity.id));
  const lines: string[] = [];
  const selectedIds: string[] = [];
  let remaining = 6000;
  for (const { entity } of candidates.slice(0, 8)) {
    const wiki = entity.wiki;
    const line = JSON.stringify({
      id: entity.id.slice(0, 160), name: entity.name.slice(0, 100),
      kind: wiki?.kind ?? "legacy", basis: wiki?.basis ?? "manual",
      summary: entity.summary.slice(0, 350), body: entity.body?.slice(0, 350),
      refs: entity.refs?.slice(0, 8), combatMode: wiki?.combatMode,
      sources: wiki?.sources.slice(-3).map((source) => ({ id: source.id.slice(0, 160), kind: source.kind, at: source.at })),
    });
    if (line.length + 1 > remaining) continue;
    lines.push(line);
    selectedIds.push(entity.id);
    remaining -= line.length + 1;
  }
  return { text: lines.join("\n"), selectedIds };
}
