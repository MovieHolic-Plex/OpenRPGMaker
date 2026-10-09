// project/factionRuntime.ts
// 저작 태도표 위에 얹는 희소 런타임 오버레이. 순수 모듈 — Phaser/DOM/세션을 모른다.
//
// 설계 요약:
//  - 키는 JSON 문자열 튜플([from,to])이다. 구분자가 들어간 id 도 충돌하지 않고 세이브를 사람이 읽을 수 있다.
//  - 평판은 0.25 같은 작은 누적값을 잃지 않도록 연속값으로 보관하되, 전투 임계값은 기존 -1/0/1 경계를 그대로 쓴다.
//  - 한 쌍을 바꿀 때 양방향을 함께 기록한다. 그래도 조회는 항상 Math.min 을 거쳐 한쪽 낙관이 적대를 숨기지 못한다.

import {
  DEFAULT_ENEMY_FACTION_ID,
  PLAYER_FACTION_ID,
  type ResolvedFactionTable,
} from "@/project/factions";

export type RuntimeFactionStance = number;
export type FactionStanceOverrides = Record<string, RuntimeFactionStance>;

export const DEFAULT_PLAYER_KILL_REPUTATION_WEIGHT = 0.25;

const STANCE_MIN = -2;
const STANCE_MAX = 2;
const STANCE_NEUTRAL = 0;

export function factionStancePairKey(fromFactionId: string, toFactionId: string): string {
  return JSON.stringify([fromFactionId, toFactionId]);
}

export function clampRuntimeFactionStance(value: unknown): RuntimeFactionStance {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : STANCE_NEUTRAL;
  return Math.min(STANCE_MAX, Math.max(STANCE_MIN, numeric));
}

function factionSlot(table: ResolvedFactionTable, factionId: string | undefined): number {
  if (factionId === undefined) return table.ids.indexOf(DEFAULT_ENEMY_FACTION_ID);
  const found = table.ids.indexOf(factionId);
  return found >= 0 ? found : table.ids.indexOf(DEFAULT_ENEMY_FACTION_ID);
}

function resolvedFactionId(table: ResolvedFactionTable, factionId: string | undefined): string {
  const slot = factionSlot(table, factionId);
  return table.ids[slot] ?? DEFAULT_ENEMY_FACTION_ID;
}

function authoredDirectionalStance(table: ResolvedFactionTable, fromSlot: number, toSlot: number): RuntimeFactionStance {
  return clampRuntimeFactionStance(table.stances[fromSlot * table.size + toSlot] ?? STANCE_NEUTRAL);
}

function directionalStance(
  table: ResolvedFactionTable,
  overrides: Readonly<FactionStanceOverrides> | undefined,
  fromSlot: number,
  toSlot: number,
): RuntimeFactionStance {
  const from = table.ids[fromSlot] ?? DEFAULT_ENEMY_FACTION_ID;
  const to = table.ids[toSlot] ?? DEFAULT_ENEMY_FACTION_ID;
  const override = overrides?.[factionStancePairKey(from, to)];
  return override === undefined
    ? authoredDirectionalStance(table, fromSlot, toSlot)
    : clampRuntimeFactionStance(override);
}

/** 오버레이가 없으면 저작 태도와 정확히 같고, 있으면 양방향 중 더 적대적인 값을 돌려준다. */
export function effectiveFactionStance(
  table: ResolvedFactionTable,
  overrides: Readonly<FactionStanceOverrides> | undefined,
  a: string | undefined,
  b: string | undefined,
): RuntimeFactionStance {
  const aSlot = factionSlot(table, a);
  const bSlot = factionSlot(table, b);
  return Math.min(
    directionalStance(table, overrides, aSlot, bSlot),
    directionalStance(table, overrides, bSlot, aSlot),
  );
}

function withDirectionalOverride(
  table: ResolvedFactionTable,
  overrides: Readonly<FactionStanceOverrides>,
  fromFactionId: string,
  toFactionId: string,
  value: RuntimeFactionStance,
): FactionStanceOverrides {
  const fromSlot = factionSlot(table, fromFactionId);
  const toSlot = factionSlot(table, toFactionId);
  const from = table.ids[fromSlot] ?? DEFAULT_ENEMY_FACTION_ID;
  const to = table.ids[toSlot] ?? DEFAULT_ENEMY_FACTION_ID;
  const key = factionStancePairKey(from, to);
  const next = { ...overrides };
  const stance = clampRuntimeFactionStance(value);
  if (stance === authoredDirectionalStance(table, fromSlot, toSlot)) delete next[key];
  else next[key] = stance;
  return next;
}

/** 논리적 진영 쌍을 절대값으로 바꾼다. 저작값과 같은 방향은 지워 희소성을 유지한다. */
export function setEffectiveFactionStance(
  table: ResolvedFactionTable,
  overrides: Readonly<FactionStanceOverrides> | undefined,
  a: string | undefined,
  b: string | undefined,
  value: number,
): FactionStanceOverrides {
  const aId = resolvedFactionId(table, a);
  const bId = resolvedFactionId(table, b);
  let next = withDirectionalOverride(table, overrides ?? {}, aId, bId, value);
  if (aId !== bId) next = withDirectionalOverride(table, next, bId, aId, value);
  return next;
}

/** 현재 유효 태도에 delta 를 더한다. 작은 평판 가중치도 다음 조정까지 그대로 누적된다. */
export function adjustEffectiveFactionStance(
  table: ResolvedFactionTable,
  overrides: Readonly<FactionStanceOverrides> | undefined,
  a: string | undefined,
  b: string | undefined,
  delta: number,
): FactionStanceOverrides {
  const finiteDelta = Number.isFinite(delta) ? delta : 0;
  return setEffectiveFactionStance(
    table,
    overrides,
    a,
    b,
    effectiveFactionStance(table, overrides, a, b) + finiteDelta,
  );
}

/** 알려진 JSON 튜플 키와 유한 범위 값만 받아 세이브의 임의 필드가 런타임으로 새지 않게 한다. */
export function parseFactionStanceOverrides(
  value: unknown,
  table?: ResolvedFactionTable,
): FactionStanceOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const knownFactionIds = table ? new Set(table.ids) : undefined;
  const parsed: FactionStanceOverrides = {};
  for (const [key, rawStance] of Object.entries(value)) {
    let pair: unknown;
    try {
      pair = JSON.parse(key);
    } catch {
      continue;
    }
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some((id) => typeof id !== "string" || id.length === 0)) continue;
    // 현재 없는 진영 키는 누적되거나 예약 enemy 슬롯으로 별칭되지 않게 버린다. 같은 id 재사용은 의도대로 상태를 잇는다.
    if (knownFactionIds && pair.some((id) => !knownFactionIds.has(id as string))) continue;
    if (typeof rawStance !== "number" || !Number.isFinite(rawStance)) continue;
    parsed[factionStancePairKey(pair[0] as string, pair[1] as string)] = clampRuntimeFactionStance(rawStance);
  }
  return parsed;
}

/** 플레이어 처치 평판: 피해 진영과 동맹은 냉각되고, 그 적대 진영은 같은 무게로 온난화된다. */
export function applyPlayerKillReputation(
  table: ResolvedFactionTable,
  overrides: Readonly<FactionStanceOverrides> | undefined,
  defeatedFactionId: string | undefined,
  weight = DEFAULT_PLAYER_KILL_REPUTATION_WEIGHT,
): FactionStanceOverrides {
  const amount = Math.max(0, Number.isFinite(weight) ? weight : DEFAULT_PLAYER_KILL_REPUTATION_WEIGHT);
  if (amount === 0) return { ...(overrides ?? {}) };
  let next = { ...(overrides ?? {}) };
  for (const factionId of table.ids) {
    if (factionId === PLAYER_FACTION_ID) continue;
    const relation = effectiveFactionStance(table, overrides, factionId, defeatedFactionId);
    if (factionId === resolvedFactionId(table, defeatedFactionId) || relation >= 1) {
      next = adjustEffectiveFactionStance(table, next, factionId, PLAYER_FACTION_ID, -amount);
    } else if (relation <= -1) {
      next = adjustEffectiveFactionStance(table, next, factionId, PLAYER_FACTION_ID, amount);
    }
  }
  return next;
}
