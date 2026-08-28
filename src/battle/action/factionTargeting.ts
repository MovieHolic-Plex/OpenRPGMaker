import {
  factionAggression,
  factionStance,
  willAttackOnSight,
  type ResolvedFactionTable,
} from "@/project/factions";

export interface FactionCombatantRef {
  readonly id: string;
  readonly factionId: string;
  readonly x: number;
  readonly y: number;
}

export interface HostileTargetInput {
  readonly self: FactionCombatantRef;
  readonly candidates: readonly FactionCombatantRef[];
  readonly table: ResolvedFactionTable;
  readonly aggroRange: number;
  /**
   * 피격 보복 래치. 후보 목록에 아직 살아 있으면 태도·시야와 무관하게 이 대상을 유지한다.
   * 이게 없으면 유탄과 아군 오사가 "때렸는데 반응이 없는" 버그로 읽힌다.
   */
  readonly forcedTargetId?: string | undefined;
}

/**
 * 가장 가까운 적대 대상. 동거리 타이브레이크를 id 사전순으로 고정해
 * 후보 배열 순서(= Map 삽입 순서, 스폰 이력)에 결과가 의존하지 않게 한다.
 */
export function resolveHostileTarget(input: HostileTargetInput): FactionCombatantRef | null {
  const { self, table } = input;
  if (input.forcedTargetId !== undefined && input.forcedTargetId !== self.id) {
    const forced = input.candidates.find((candidate) => candidate.id === input.forcedTargetId);
    if (forced) return forced;
  }
  const aggression = factionAggression(table, self.factionId);
  let best: FactionCombatantRef | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of input.candidates) {
    if (candidate.id === self.id) continue;
    const distance = Math.max(Math.abs(candidate.x - self.x), Math.abs(candidate.y - self.y));
    if (distance > input.aggroRange) continue;
    if (!willAttackOnSight(factionStance(table, self.factionId, candidate.factionId), aggression)) continue;
    if (distance > bestDistance) continue;
    if (distance === bestDistance && (best === null || candidate.id >= best.id)) continue;
    best = candidate;
    bestDistance = distance;
  }
  return best;
}

export interface NpcDamageOutcome {
  readonly hp: number;
  readonly died: boolean;
  /** protectedFromNpcs 로 HP 1 에서 버텼는가. 플레이어 공격에는 적용되지 않는다. */
  readonly savedByProtection: boolean;
}

/**
 * NPC 가 NPC 에게 주는 피해. 보호 진영은 1 에서 바닥을 친다 —
 * 퀘스트 NPC 가 앰비언트 전투로 사라지는 사고를 막는 Bethesda `protected` 등가물이다.
 */
export function resolveNpcDamage(input: {
  readonly hp: number;
  readonly damage: number;
  readonly protectedFromNpcs: boolean;
}): NpcDamageOutcome {
  const damage = Math.max(0, Math.round(input.damage));
  const raw = Math.max(0, input.hp - damage);
  if (raw > 0) return { hp: raw, died: false, savedByProtection: false };
  if (input.protectedFromNpcs && input.hp > 0) return { hp: 1, died: false, savedByProtection: true };
  return { hp: 0, died: input.hp > 0, savedByProtection: false };
}
