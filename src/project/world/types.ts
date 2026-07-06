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
