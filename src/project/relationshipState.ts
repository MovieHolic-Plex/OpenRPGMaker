export const RELATIONSHIP_STATES = ["single", "dating", "engaged", "married"] as const;

export type RelationshipState = (typeof RELATIONSHIP_STATES)[number];

export const DEFAULT_RELATIONSHIP_STATE: RelationshipState = "single";

export type RelationshipHost = {
  relationships?: Record<string, RelationshipState>;
};

export type RelationshipCondition = {
  kind: "relationshipAtLeast";
  npcKey?: string;
  state: RelationshipState;
};

const RELATIONSHIP_STATE_NAMES: Record<RelationshipState, string> = {
  single: "관계 없음",
  dating: "연인",
  engaged: "약혼",
  married: "부부",
};

export function relationshipStateName(state: RelationshipState): string {
  return RELATIONSHIP_STATE_NAMES[state];
}

export function isRelationshipState(value: unknown): value is RelationshipState {
  return typeof value === "string" && (RELATIONSHIP_STATES as readonly string[]).includes(value);
}

export function relationshipRank(state: RelationshipState): number {
  return RELATIONSHIP_STATES.indexOf(state);
}

export function getRelationshipState(host: RelationshipHost, npcKey: string): RelationshipState {
  const stored = host.relationships?.[npcKey];
  return isRelationshipState(stored) ? stored : DEFAULT_RELATIONSHIP_STATE;
}

export function setRelationshipState(
  host: RelationshipHost,
  npcKey: string,
  state: RelationshipState
): RelationshipState {
  const key = npcKey.trim();
  if (!key) return DEFAULT_RELATIONSHIP_STATE;
  const relationships = host.relationships ?? (host.relationships = {});
  if (state === DEFAULT_RELATIONSHIP_STATE) {
    delete relationships[key];
    return DEFAULT_RELATIONSHIP_STATE;
  }
  relationships[key] = state;
  return state;
}

export function evalRelationshipCondition(
  host: RelationshipHost,
  condition: RelationshipCondition,
  npcKey: string | null
): boolean {
  if (!npcKey) return false;
  return relationshipRank(getRelationshipState(host, npcKey)) >= relationshipRank(condition.state);
}

/* 세이브에는 기본값을 쓰지 않으므로(setRelationshipState 가 single 을 지운다) 낡거나 적대적인
   세이브의 알 수 없는 값은 항목을 버린다 — 열거 밖 문자열을 통과시키면 relationshipRank 가
   -1 을 돌려 모든 비교가 참이 된다. */
export function normalizeRelationships(value: unknown): Record<string, RelationshipState> | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: Record<string, RelationshipState> = {};
  for (const [npcKey, state] of Object.entries(value)) {
    const key = npcKey.trim();
    if (!key || !isRelationshipState(state) || state === DEFAULT_RELATIONSHIP_STATE) continue;
    normalized[key] = state;
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
