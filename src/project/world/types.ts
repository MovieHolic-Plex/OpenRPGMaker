export const WORLD_ENTITY_TYPES = ["character", "place", "faction", "event", "item", "concept", "guideline"] as const;

export type WorldEntityType = (typeof WORLD_ENTITY_TYPES)[number];

export const WORLD_REF_KINDS = ["map", "event", "item", "skill", "actor"] as const;

export type WorldRefKind = (typeof WORLD_REF_KINDS)[number];

export interface WorldRef {
  readonly kind: WorldRefKind;
  readonly id: string;
}

export type WorldOrigin = "user" | "ai" | "interview";

export interface WorldEntity {
  readonly id: string;
  readonly type: WorldEntityType;
  readonly name: string;
  readonly summary: string;
  readonly body?: string;
  readonly tags?: readonly string[];
  readonly refs?: readonly WorldRef[];
  readonly origin: WorldOrigin;
  readonly locked?: boolean;
  readonly wiki?: WorldWikiMetadata;
}

export const WORLD_RELATION_KINDS = ["memberOf", "locatedIn", "knows", "enemyOf", "allyOf", "causedBy", "owns", "custom"] as const;

export type WorldRelationKind = (typeof WORLD_RELATION_KINDS)[number];

export interface WorldRelation {
  readonly a: string;
  readonly b: string;
  readonly kind: WorldRelationKind;
  readonly note?: string;
}

export interface ProjectWorld {
  readonly entities: readonly WorldEntity[];
  readonly relations: readonly WorldRelation[];
}

export const WIKI_KINDS = ["declaration", "knowledge", "progress"] as const;
export const WIKI_BASES = ["explicit", "inferred", "observed"] as const;
export const WIKI_SOURCE_KINDS = ["user", "application", "manual"] as const;
export const WIKI_COMBAT_MODES = ["contact", "action", "random"] as const;
export type WikiCombatMode = (typeof WIKI_COMBAT_MODES)[number];

/** Source text and ordering are supplied by the host, never by the extractor. */
export interface WikiSource {
  readonly id: string;
  readonly kind: (typeof WIKI_SOURCE_KINDS)[number];
  readonly text: string;
  readonly at: number;
}

export interface WorldWikiMetadata {
  readonly kind: (typeof WIKI_KINDS)[number];
  readonly basis: (typeof WIKI_BASES)[number];
  readonly sources: readonly WikiSource[];
  readonly topic?: string;
  readonly combatMode?: WikiCombatMode;
  readonly supersedes?: readonly string[];
}

export interface ProjectWikiUpsert extends Omit<WorldEntity, "origin" | "locked" | "wiki"> {
  readonly wiki: Omit<WorldWikiMetadata, "sources"> & { readonly sourceIds: readonly string[] };
}

export interface ProjectWikiPatch {
  readonly upserts: readonly ProjectWikiUpsert[];
}

export interface ProjectWikiConflict {
  readonly id: string;
  readonly reason: "concurrent-edit" | "protected" | "stale" | "invalid-supersession";
}

export interface ProjectWikiApplyResult {
  readonly world: ProjectWorld;
  readonly changed: boolean;
  readonly conflicts: readonly ProjectWikiConflict[];
}
