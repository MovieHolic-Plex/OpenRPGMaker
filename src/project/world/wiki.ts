import type { Project } from "../types";
import { ProjectFormatError } from "../io/errors";
import { createWikiSource, normalizeWikiMetadata, normalizeWorld } from "./guards";
import { lintWorld } from "./lint";
import type { ProjectWikiApplyResult, ProjectWikiConflict, ProjectWikiPatch, ProjectWikiUpsert, ProjectWorld, WikiSource, WorldEntity } from "./types";

/**
 * The patch parsed, but applying it would damage existing records — a locked/manual document,
 * or an inversion that buries a newer explicit fact.
 *
 * Kept apart from plain shape errors because the two deserve different answers: a model that
 * cannot format its reply costs this turn a record, while a model reaching for protected
 * memory has misread the project and must not keep authoring against it.
 */
export class ProjectWikiPatchConflictError extends ProjectFormatError {
  constructor(readonly conflicts: readonly ProjectWikiConflict[]) {
    super(`Invalid wiki patch: ${JSON.stringify(conflicts)}`);
    this.name = "ProjectWikiPatchConflictError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProjectFormatError("Expected wiki object");
  return Object.fromEntries(Object.entries(value));
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new ProjectFormatError(`Unexpected wiki field: ${key}`);
}

function sourceMap(sources: readonly WikiSource[]): ReadonlyMap<string, WikiSource> {
  const result = new Map<string, WikiSource>();
  for (const value of sources) {
    const source = createWikiSource(value);
    if (result.has(source.id)) throw new ProjectFormatError(`Duplicate wiki source: ${source.id}`);
    result.set(source.id, source);
  }
  return result;
}

/** Parse the model boundary once. No model-supplied origin, locks, or source excerpts are accepted. */
export function parseProjectWikiPatch(value: unknown, project: Project, sources: readonly WikiSource[]): ProjectWikiPatch {
  // Accept prose around one fence, but never discard competing objects, arrays or fences.
  // Parse the entire payload below; malformed JSON and invalid records still fail atomically.
  const json = typeof value === "string" ? value.trim().replace(/^[^`{}\[\]]*```(?:json)?\s*\n([\s\S]*?)\n```[^`{}\[\]]*$/u, "$1") : value;
  const root = record(typeof json === "string" ? JSON.parse(json) : json);
  onlyKeys(root, ["upserts"]);
  if (!Array.isArray(root.upserts) || root.upserts.length > 32) throw new ProjectFormatError("Wiki upserts must be an array of at most 32 documents");
  const knownSources = sourceMap(sources);
  const ids = new Set<string>();
  const upserts = root.upserts.map((entry: unknown): ProjectWikiUpsert => {
    const input = record(entry);
    onlyKeys(input, ["id", "type", "name", "summary", "body", "tags", "refs", "wiki"]);
    const metadata = record(input.wiki);
    onlyKeys(metadata, ["kind", "basis", "sourceIds", "topic", "combatMode", "supersedes"]);
    if (!Array.isArray(metadata.sourceIds) || metadata.sourceIds.some((id: unknown) => typeof id !== "string")) throw new ProjectFormatError("Wiki sourceIds must be strings");
    const stamped = metadata.sourceIds.map((id: string) => {
      const source = knownSources.get(id);
      if (!source) throw new ProjectFormatError(`Unknown wiki source: ${id}`);
      return source;
    });
    const wiki = normalizeWikiMetadata({ ...metadata, sources: stamped });
    const normalized = normalizeWorld({ entities: [{ ...input, origin: "ai", wiki: { ...wiki, supersedes: [] } }], relations: [] }).entities[0];
    if (!normalized || !normalized.name.trim() || !normalized.summary.trim()) throw new ProjectFormatError("Wiki document needs a name and summary");
    if (ids.has(normalized.id)) throw new ProjectFormatError(`Duplicate wiki document: ${normalized.id}`);
    ids.add(normalized.id);
    const errors = lintWorld({ entities: [normalized], relations: [] }, project).filter((issue) => issue.code === "world-ref-missing");
    if (errors.length) throw new ProjectFormatError(errors.map((issue) => issue.message).join("; "));
    const { origin: _origin, wiki: _wiki, ...document } = normalized;
    const { sources: _sources, ...fields } = wiki;
    return { ...document, wiki: { ...fields, sourceIds: stamped.map((source) => source.id) } };
  });
  const result = { upserts };
  const base = project.world ?? { entities: [], relations: [] };
  const applied = applyProjectWikiPatch(base, base, result, sources);
  if (applied.conflicts.length) throw new ProjectWikiPatchConflictError(applied.conflicts);
  return result;
}

export function wikiScope(entity: WorldEntity): string {
  return JSON.stringify([...new Set((entity.refs ?? []).filter((ref) => ref.kind === "map").map((ref) => ref.id))].sort());
}

export function wikiTopic(entity: WorldEntity): string {
  return entity.wiki?.combatMode ? "combat-mode" : entity.wiki?.topic ?? entity.name.trim().toLowerCase();
}

export function wikiOrder(entity: WorldEntity): number {
  return Math.max(0, ...(entity.wiki?.sources ?? []).map((source) => source.at));
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function protectedDocument(entity: WorldEntity): boolean {
  return !!entity.locked || entity.origin !== "ai" || !entity.wiki || entity.wiki.sources.some((source) => source.kind === "manual");
}

/** Reconcile document writes only; relations and unrelated live documents are never replaced. */
export function reconcileProjectWiki(base: ProjectWorld, proposed: ProjectWorld, live: ProjectWorld): ProjectWikiApplyResult {
  const conflicts: ProjectWikiConflict[] = [];
  const writes = new Map<string, WorldEntity>();
  for (const candidate of proposed.entities) {
    const previous = base.entities.find((entity) => entity.id === candidate.id);
    if (same(previous, candidate)) continue;
    const current = live.entities.find((entity) => entity.id === candidate.id);
    if (same(current, candidate)) continue;
    if (!same(previous, current)) conflicts.push({ id: candidate.id, reason: "concurrent-edit" });
    else if (current && protectedDocument(current)) conflicts.push({ id: candidate.id, reason: "protected" });
    else writes.set(candidate.id, candidate);
    for (const id of candidate.wiki?.supersedes ?? []) {
      const before = base.entities.find((entity) => entity.id === id);
      const now = live.entities.find((entity) => entity.id === id);
      if (!same(before, now)) conflicts.push({ id, reason: "concurrent-edit" });
      else if (now && protectedDocument(now)) conflicts.push({ id, reason: "protected" });
    }
  }
  if (conflicts.length || writes.size === 0) return { world: live, changed: false, conflicts };
  const entities = live.entities.map((entity) => writes.get(entity.id) ?? entity);
  for (const [id, entity] of writes) if (!live.entities.some((existing) => existing.id === id)) entities.push(entity);
  return { world: normalizeWorld({ entities, relations: live.relations }), changed: true, conflicts: [] };
}

/** Append immutable revisions. Corrections use a new entity id and retain the prior document. */
export function applyProjectWikiPatch(liveWorld: ProjectWorld, baseWorld: ProjectWorld, patch: ProjectWikiPatch, sources: readonly WikiSource[]): ProjectWikiApplyResult {
  const knownSources = sourceMap(sources);
  const seenSources = new Map(liveWorld.entities.flatMap((entity) => (entity.wiki?.sources ?? []).map((source) => [source.id, source] as const)));
  for (const [id, source] of knownSources) {
    const previous = seenSources.get(id);
    if (previous && !same(previous, source)) throw new ProjectFormatError(`Changed wiki source: ${id}`);
  }
  const additions: WorldEntity[] = [];
  const conflicts: ProjectWikiConflict[] = [];
  for (const upsert of patch.upserts) {
    const { sourceIds, ...metadata } = upsert.wiki;
    const stamped = sourceIds.map((id) => {
      const source = knownSources.get(id);
      if (!source) throw new ProjectFormatError(`Unknown wiki source: ${id}`);
      return source;
    });
    const wiki = normalizeWikiMetadata({ ...metadata, sources: stamped });
    if (sourceIds.every((id) => seenSources.has(id))) continue;
    const candidate: WorldEntity = { ...upsert, origin: "ai", wiki };
    const existing = baseWorld.entities.find((entity) => entity.id === candidate.id);
    if (existing) {
      conflicts.push({ id: candidate.id, reason: protectedDocument(existing) ? "protected" : "concurrent-edit" });
      continue;
    }
    const peers = baseWorld.entities.filter((entity) => entity.wiki && wikiScope(entity) === wikiScope(candidate) && wikiTopic(entity) === wikiTopic(candidate) && entity.wiki.kind === wiki.kind);
    if (peers.some((entity) => entity.wiki?.basis === wiki.basis && wikiOrder(entity) >= wikiOrder(candidate))) {
      conflicts.push({ id: candidate.id, reason: "stale" });
      continue;
    }
    const supersedes = new Set(wiki.supersedes ?? []);
    if (wiki.basis === "explicit") for (const peer of peers) {
      if (peer.wiki?.basis === "explicit" && wikiOrder(peer) < wikiOrder(candidate)) supersedes.add(peer.id);
    }
    for (const id of supersedes) {
      const previous = baseWorld.entities.find((entity) => entity.id === id);
      if (!previous?.wiki || wikiScope(previous) !== wikiScope(candidate) || wikiTopic(previous) !== wikiTopic(candidate) || wikiOrder(previous) >= wikiOrder(candidate) || (wiki.basis !== "explicit" && previous.wiki.basis === "explicit")) {
        conflicts.push({ id: candidate.id, reason: "invalid-supersession" });
      } else if (protectedDocument(previous)) conflicts.push({ id: previous.id, reason: "protected" });
    }
    additions.push({ ...candidate, wiki: { ...wiki, ...(supersedes.size ? { supersedes: [...supersedes] } : {}) } });
  }
  if (conflicts.length) return { world: liveWorld, changed: false, conflicts };
  const proposed = { ...baseWorld, entities: [...baseWorld.entities, ...additions] };
  return reconcileProjectWiki(baseWorld, proposed, liveWorld);
}

/** History remains persisted but is never an active retrieval/routing candidate. */
export function activeWikiEntities(world: ProjectWorld | undefined): readonly WorldEntity[] {
  const entities = world?.entities ?? [];
  const superseded = new Set(entities.flatMap((entity) => entity.wiki?.supersedes ?? []));
  return entities.filter((entity) => entity.wiki && !superseded.has(entity.id));
}
