export const WORLD_ENTITY_TYPES = ["character", "place", "faction", "event", "item", "concept", "guideline"] as const;

export type WorldEntityType = (typeof WORLD_ENTITY_TYPES)[number];

export const WORLD_REF_KINDS = ["map", "event", "item", "skill", "actor"] as const;

export type WorldRefKind = (typeof WORLD_REF_KINDS)[number];

export interface WorldRef {
  readonly kind: WorldRefKind;
  readonly id: string;
}

export type WorldOrigin = "user" | "ai" | "interview";

/**
 * 카드(설정집 문서)의 AI 공개 범위. 생략 = public(기존 동작, 저장 바이트 불변).
 *
 * `ai-hidden` 은 작가 전용 비밀 설정이다 — 조수·NPC 대사 작성기·위키 추출기 등 모델에 가는 모든 경로에서
 * 제외된다. 세계 개요(`worldCanon.visibility: "secret"`)와 다르다: 그쪽 `secret` 은 AI 가 읽되 플레이어
 * 문장에 노출하지 말라는 **지시문**이고, 이쪽은 아예 보내지 않는다. 게임 런타임은 이 필드를 읽지 않는다.
 * 모든 AI 경로는 `@/project/world/visibility` 의 함수만 거친다.
 */
export const WORLD_VISIBILITIES = ["public", "ai-hidden"] as const;

export type WorldVisibility = (typeof WORLD_VISIBILITIES)[number];

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
  /** 생략 = public. `ai-hidden` 만 저장한다(guards 가 public 을 떼어 낸다). */
  readonly visibility?: WorldVisibility;
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

export interface ProjectWikiUpsert extends Omit<WorldEntity, "origin" | "locked" | "visibility" | "wiki"> {
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
