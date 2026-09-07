import { normalizeWorld } from "./guards";
import type { ProjectWorld, WorldEntity } from "./types";

/**
 * R2: the reviewed authored candidate must reach the store intact.
 *
 * `world` mixes two ownerships: wiki documents (coordinator-owned checkpoints and
 * manual codex edits, including legacy guidelines) and authored registrations
 * (the active `author_npc_cast` character/place entities and
 * locatedIn/knows relations). Blanket-replacing the reviewed world with the live
 * world protects the former but silently erases the latter after approval.
 */

/** Wiki documents have an independent owner. Legacy guidelines are codex documents. */
export function isWikiOwnedDocument(entity: WorldEntity): boolean {
  return entity.type === "guideline" || entity.wiki !== undefined;
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .map((key) => [key, sorted((value as Record<string, unknown>)[key])]));
  }
  return value;
}

/** Order-insensitive deep equality: normalization key order must not read as an edit. */
function same(value: unknown, other: unknown): boolean {
  return JSON.stringify(sorted(value)) === JSON.stringify(sorted(other));
}

/**
 * Merge for the shared apply boundary (agent + region). Runs after the
 * staleness gates, so live authored state already matches the draft base:
 * reviewed non-wiki entities/relations are authoritative, live wiki-owned
 * documents (coordinator checkpoints, newer manual edits) are preserved.
 * Relations carry no wiki ownership; the reviewed graph wins wholesale.
 */
export function reconcileReviewedWorldForApply(
  reviewed: ProjectWorld | undefined,
  live: ProjectWorld | undefined,
): ProjectWorld | undefined {
  const reviewedWorld = reviewed ? normalizeWorld(structuredClone(reviewed)) : undefined;
  const liveWorld = live ? normalizeWorld(structuredClone(live)) : undefined;
  if (!reviewedWorld) return liveWorld ? structuredClone(liveWorld) : undefined;
  if (!liveWorld) return structuredClone(reviewedWorld);
  // Preserve reviewed entity order: substitute live wiki-owned documents in place
  // and append only unseen ones. When live matches the draft base, the merged
  // object is byte-identical to the reviewed candidate, so the post-apply
  // approval identity survives rebase instead of flipping to a false "unapproved".
  const liveWiki = new Map(
    liveWorld.entities.filter((entity) => isWikiOwnedDocument(entity)).map((entity) => [entity.id, entity]));
  const entities: WorldEntity[] = [];
  for (const entity of reviewedWorld.entities) {
    if (!isWikiOwnedDocument(entity)) {
      entities.push(entity);
      continue;
    }
    // Live owns wiki documents: newer manual/coordinator versions substitute in
    // place, live deletions win, and writer-side wiki writes without a coordinator
    // receipt are dropped. (Pre-review sync already reports those visibly.)
    // When live equals reviewed, keep the reviewed object verbatim so the merged
    // candidate stays byte-identical to the reviewed one and the post-apply
    // approval identity survives instead of flipping to a false "unapproved".
    const current = liveWiki.get(entity.id);
    liveWiki.delete(entity.id);
    if (current) entities.push(same(current, entity) ? entity : structuredClone(current));
  }
  for (const entity of liveWiki.values()) entities.push(structuredClone(entity));
  return normalizeWorld({ entities, relations: structuredClone(reviewedWorld.relations) });
}

export interface DraftWikiSync {
  readonly world: ProjectWorld;
  /** True when live wiki documents were adopted into the draft before review. */
  readonly changed: boolean;
  /**
   * Writer-owned writes to wiki-owned documents. The writer has no wiki tools;
   * a draft wiki change is never coordinator-owned content and must fail visibly
   * instead of reaching the reviewer silently.
   */
  readonly conflicts: readonly string[];
}

/**
 * Pre-review reconciliation of the draft candidate: adopt newer live
 * wiki-owned documents so the reviewer sees the true final object, and report
 * draft-side wiki writes as conflicts. Non-wiki registrations are untouched —
 * concurrent authored edits stay the R1 staleness gate's responsibility.
 */
export function syncDraftWikiWithLive(
  draft: ProjectWorld | undefined,
  base: ProjectWorld | undefined,
  live: ProjectWorld | undefined,
): DraftWikiSync {
  const draftWorld = draft ? normalizeWorld(structuredClone(draft)) : undefined;
  if (!draftWorld) return { world: normalizeWorld({ entities: [], relations: [] }), changed: false, conflicts: [] };
  // Normalize all sides: key order and defaults must not read as authored edits.
  const baseWorld = base ? normalizeWorld(structuredClone(base)) : undefined;
  const liveWorld = live ? normalizeWorld(structuredClone(live)) : undefined;
  const baseById = new Map((baseWorld?.entities ?? []).map((entity) => [entity.id, entity]));
  const liveById = new Map((liveWorld?.entities ?? []).map((entity) => [entity.id, entity]));
  const conflicts: string[] = [];
  let changed = false;
  const entities = draftWorld.entities.map((entity) => {
    if (!isWikiOwnedDocument(entity)) return entity;
    const before = baseById.get(entity.id);
    const current = liveById.get(entity.id);
    if (before && !same(before, entity) && !(current && same(current, entity))) {
      conflicts.push(entity.id);
    }
    if (current && !same(current, entity)) {
      changed = true;
      return structuredClone(current);
    }
    return entity;
  });
  for (const entity of liveWorld?.entities ?? []) {
    if (isWikiOwnedDocument(entity) && !entities.some((existing) => existing.id === entity.id)) {
      changed = true;
      entities.push(structuredClone(entity));
    }
  }
  return { world: normalizeWorld({ entities, relations: structuredClone(draftWorld.relations) }), changed, conflicts };
}
