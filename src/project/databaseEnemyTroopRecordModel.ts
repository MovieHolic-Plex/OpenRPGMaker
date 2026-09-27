import { DEFAULT_ELEMENT_RATE_LABELS } from "@/project/actorModel";
import { normalizeEnemyActionProfile } from "@/project/actionCombat";
import { normalizeStealItems } from "@/battle/battleSpecialEffects";
import { normalizeBattleBackdropAnimation } from "@/project/battleBackdropAnimation";
import type {
  EnemyActionCondition,
  EnemyActionPattern,
  EnemyActionSwitchEffect,
  EnemyCritical,
  EnemyOptions,
  EnemyReaction,
  EnemyRecord,
  EnemyRewards,
  EnemyStats,
  BattleFlow,
  BattleEventPageRecord,
  TroopMemberRecord,
  TroopRecord,
} from "@/project/types";

export function normalizeEnemyRecord(
  record: Partial<Omit<EnemyRecord, "actions">> & { actions?: readonly Partial<EnemyActionPattern>[] } & Pick<EnemyRecord, "id" | "name">,
): EnemyRecord {
  const actions = normalizeEnemyActions(record.actions, record.skillIds);
  const legacy = record as Partial<EnemyRecord> & { critical?: EnemyCritical; options?: EnemyOptions };
  const critical = normalizeCritical(legacy.critical ?? record.criticalHit);
  const options = normalizeOptions(legacy.options ?? record.attackOptions);
  const battleScalePercent = typeof record.battleScalePercent === "number" && Number.isFinite(record.battleScalePercent)
    ? Math.round(Math.max(10, Math.min(300, record.battleScalePercent)))
    : 100;
  return {
    id: record.id,
    name: record.name,
    speciesId: cleanOptionalId(record.speciesId),
    level: typeof record.level === "number" && Number.isFinite(record.level) ? clampInteger(record.level, 1, 99) : undefined,
    monsterResourceId: cleanOptionalId(record.monsterResourceId),
    ...(battleScalePercent === 100 ? {} : { battleScalePercent }),
    graphicHue: clampInteger(record.graphicHue ?? 0, 0, 360),
    transparent: record.transparent ?? false,
    flying: record.flying ?? false,
    criticalHit: critical,
    attackOptions: options,
    // skillIds is the legacy skill-only projection; empty skillId means basic attack and is omitted here.
    skillIds: actions.map((action) => action.skillId).filter((skillId) => skillId.length > 0),
    stats: normalizeEnemyStats(record.stats),
    rewards: normalizeRewards(record.rewards),
    actions,
    ...(() => {
      const actionProfile = normalizeEnemyActionProfile(record.actionProfile);
      return actionProfile ? { actionProfile } : {};
    })(),
    ...(typeof record.factionId === "string" && record.factionId.length > 0 ? { factionId: record.factionId } : {}),
    stateRates: record.stateRates === undefined
      ? { state_death: "C" }
      : normalizeRates(record.stateRates),
    elementRates: defaultElementRates(record.elementRates),
    ...(() => {
      const reactions = normalizeEnemyReactions(record.reactions);
      return reactions.length > 0 ? { reactions } : {};
    })(),
    ...(() => {
      const stealItems = normalizeStealItems(record.stealItems);
      return stealItems.length > 0 ? { stealItems } : {};
    })(),
  };
}

/** 반격 목록. trigger 가 비었거나 skillId 가 문자열이 아닌 항목은 버린다. 빈 목록은 저장하지 않는다. */
function normalizeEnemyReactions(reactions: readonly Partial<EnemyReaction>[] | undefined): EnemyReaction[] {
  if (!Array.isArray(reactions)) return [];
  return reactions
    .filter((entry): entry is Partial<EnemyReaction> & { trigger: string; skillId: string } =>
      typeof entry?.trigger === "string" && entry.trigger.trim().length > 0 && typeof entry.skillId === "string")
    .map((entry) => ({
      trigger: entry.trigger.trim(),
      skillId: entry.skillId.trim(),
      chance: clampInteger(typeof entry.chance === "number" && Number.isFinite(entry.chance) ? entry.chance : 100, 0, 100),
    }));
}

/** Side-view battle field art. EasyRPG "backdrop" pack is mostly sky panoramas — not usable as JRPG battlebacks. */
export const DEFAULT_BATTLE_FIELD_BACKGROUND_ID = "generated-battle-reference-forest";

/** Only rewrite panoramas that read as unusable battle fields (noise / pure black night). */
const SKY_PANORAMA_BATTLEBACK_IDS = new Set([
  "easyrpg-backdrop-night-sky1",
  "easyrpg-backdrop-night-sky2",
  "easyrpg-backdrop-dimension-rift",
  "easyrpg-backdrop-planet1",
  "easyrpg-backdrop-planet2",
  "easyrpg-backdrop-planet3",
]);

export function normalizeTroopRecord(record: Partial<TroopRecord> & Pick<TroopRecord, "id" | "name">): TroopRecord {
  const members = normalizeMembers(record.members, record.enemyIds);
  return {
    id: record.id,
    name: record.name,
    enemyIds: members.map((member) => member.enemyId),
    members,
    autoAlign: record.autoAlign ?? true,
    uncapturable: record.uncapturable === true,
    ...(record.trainerBattle === true ? { trainerBattle: true } : {}),
    previewBackgroundResourceId: normalizeBattleFieldBackgroundId(record.previewBackgroundResourceId),
    // 움직이는 전투 배경. 효과가 하나도 없으면 키를 만들지 않는다(옛 JSON 바이트 유지).
    ...(() => {
      const backdropAnimation = normalizeBattleBackdropAnimation(record.backdropAnimation);
      return backdropAnimation ? { backdropAnimation } : {};
    })(),
    battleFlow: normalizeBattleFlow(record.battleFlow),
    activeSlots: normalizeOptionalPositiveInteger(record.activeSlots),
    battleEventPages: uniqueBattleEventPages(record.battleEventPages ?? []),
  };
}

/** Repair old length-based ID collisions deterministically. References keep targeting the first page. */
function uniqueBattleEventPages(pages: readonly BattleEventPageRecord[]): BattleEventPageRecord[] {
  const reserved = new Set(pages.map((page) => page.id));
  const seen = new Set<string>();
  return pages.map((page) => {
    if (!seen.has(page.id)) { seen.add(page.id); return page; }
    let suffix = 2;
    while (reserved.has(`${page.id}_${suffix}`)) suffix += 1;
    const id = `${page.id}_${suffix}`;
    reserved.add(id);
    seen.add(id);
    return { ...page, id };
  });
}

/** Rewrite sky-panorama "backdrops" to a real side-view field; leave custom/forest ids alone. */
export function normalizeBattleFieldBackgroundId(value: unknown): string | undefined {
  const id = cleanOptionalId(value);
  if (!id) return undefined;
  if (SKY_PANORAMA_BATTLEBACK_IDS.has(id)) return DEFAULT_BATTLE_FIELD_BACKGROUND_ID;
  return id;
}

function normalizeBattleFlow(value: BattleFlow | undefined): BattleFlow | undefined {
  if (value === "strict") return "strict";
  if (value === "gauge") return "gauge";
  return undefined;
}

function normalizeOptionalPositiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.min(99, Math.trunc(value)));
}

function normalizeEnemyStats(stats: Partial<EnemyStats> | undefined): EnemyStats {
  return {
    maxHp: clampInteger(stats?.maxHp ?? 10, 1, 99999),
    maxMp: clampInteger(stats?.maxMp ?? 0, 0, 9999),
    attack: clampInteger(stats?.attack ?? 10, 1, 999),
    defense: clampInteger(stats?.defense ?? 10, 1, 999),
    mind: clampInteger(stats?.mind ?? 10, 1, 999),
    agility: clampInteger(stats?.agility ?? 10, 1, 999),
  };
}

function normalizeRewards(rewards: Partial<EnemyRewards> | undefined): EnemyRewards {
  return {
    exp: clampInteger(rewards?.exp ?? 0, 0, 9999999),
    gold: clampInteger(rewards?.gold ?? 0, 0, 999999),
    dropItemId: cleanOptionalId(rewards?.dropItemId),
    dropRatePercent: clampInteger(rewards?.dropRatePercent ?? 0, 0, 100),
    ...(typeof rewards?.tp === "number" && Number.isFinite(rewards.tp) && rewards.tp > 0 ? { tp: clampInteger(rewards.tp, 1, 999999) } : {}),
    ...(Array.isArray(rewards?.drops) ? { drops: rewards.drops.slice(0, 64).filter(drop => drop && cleanOptionalId(drop.itemId)).map(drop => ({
      itemId: drop.itemId.trim(), ratePercent: clampInteger(drop.ratePercent ?? 100, 0, 100),
      quantity: clampInteger(drop.quantity ?? 1, 1, 99), condition: normalizeActionCondition(drop.condition),
    })) } : {}),
  };
}

function normalizeCritical(critical: Partial<EnemyCritical> | undefined): EnemyCritical {
  return {
    enabled: critical?.enabled ?? false,
    oneIn: clampInteger(critical?.oneIn ?? 30, 1, 999),
  };
}

function normalizeOptions(options: Partial<EnemyOptions> | undefined): EnemyOptions {
  return {
    normalAttacksMiss: options?.normalAttacksMiss ?? false,
  };
}

function normalizeEnemyActions(actions: readonly Partial<EnemyActionPattern>[] | undefined, legacy: readonly string[] = []): EnemyActionPattern[] {
  const source = actions ?? legacy.map((skillId) => defaultEnemyAction(skillId));
  return source
    // skillId "" is a basic (normal) attack; keep it. Only drop missing/non-string skillId.
    .filter((action): action is Partial<EnemyActionPattern> & { skillId: string } => typeof action.skillId === "string")
    .map((action) => ({
      skillId: action.skillId,
      priority: clampInteger(action.priority ?? 50, 1, 100),
      condition: normalizeActionCondition(action.condition),
      switchOnAfterAction: normalizeActionSwitchEffect(action.switchOnAfterAction),
      switchOffAfterAction: normalizeActionSwitchEffect(action.switchOffAfterAction),
      ...(action.moveTo && Number.isFinite(action.moveTo.x) && Number.isFinite(action.moveTo.y)
        ? { moveTo: { x: clampInteger(action.moveTo.x, 0, 320), y: clampInteger(action.moveTo.y, 0, 240) } }
        : {}),
      ...(typeof action.requiresPart === "string" && action.requiresPart.trim() ? { requiresPart: action.requiresPart.trim().slice(0, 32) } : {}),
    }));
}

function defaultEnemyAction(skillId: string): Partial<EnemyActionPattern> {
  return {
    skillId,
    priority: 50,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

export function normalizeActionCondition(condition: EnemyActionCondition | undefined): EnemyActionCondition {
  if (condition?.kind === "hp" || condition?.kind === "mp") {
    const minPercent = clampInteger(condition.minPercent ?? 0, 0, 100);
    return { kind: condition.kind, minPercent, maxPercent: Math.max(minPercent, clampInteger(condition.maxPercent ?? 100, 0, 100)) };
  }
  if (condition?.kind === "switch") return { kind: "switch", switchId: cleanOptionalId(condition.switchId) ?? "", value: condition.value !== false };
  if (condition?.kind === "status") return { kind: "status", stateId: cleanOptionalId(condition.stateId) ?? "", present: condition.present !== false };
  if (condition?.kind === "allies") {
    const min = clampInteger(condition.min ?? 0, 0, 99);
    return { kind: "allies", min, max: Math.max(min, clampInteger(condition.max ?? 99, 0, 99)) };
  }
  if (condition?.kind === "turn") {
    return { kind: "turn", start: clampInteger(condition.start, 1, 999), interval: clampInteger(condition.interval, 1, 999) };
  }
  return { kind: "always" };
}

function normalizeActionSwitchEffect(effect: Partial<EnemyActionSwitchEffect> | undefined): EnemyActionSwitchEffect {
  return {
    enabled: effect?.enabled ?? false,
    switchId: cleanOptionalId(effect?.switchId),
  };
}

function normalizeMembers(members: readonly Partial<TroopMemberRecord>[] | undefined, legacy: readonly string[] = []): TroopMemberRecord[] {
  const source = members ?? legacy.map((enemyId, index) => ({ enemyId, x: 104 + index * 56, y: 96 }));
  return source
    .filter((member): member is TroopMemberRecord => typeof member.enemyId === "string" && member.enemyId.length > 0)
    .map((member) => ({
      enemyId: member.enemyId,
      x: clampInteger(member.x ?? 160, 0, 320),
      y: clampInteger(member.y ?? 120, 0, 240),
      hidden: member.hidden ?? false,
      ...(typeof member.partOf === "number" && Number.isInteger(member.partOf) && member.partOf >= 0 && member.partOf < 64 ? { partOf: member.partOf } : {}),
      ...(typeof member.partTag === "string" && member.partTag.trim() ? { partTag: member.partTag.trim().slice(0, 32) } : {}),
    }));
}

function normalizeRates(rates: Record<string, unknown> | undefined): Record<string, "A" | "B" | "C" | "D" | "E"> {
  const normalized: Record<string, "A" | "B" | "C" | "D" | "E"> = {};
  for (const [id, grade] of Object.entries(rates ?? {})) normalized[id] = isRateGrade(grade) ? grade : "C";
  return normalized;
}

function defaultElementRates(overrides: Record<string, unknown> | undefined): Record<string, "A" | "B" | "C" | "D" | "E"> {
  const rates: Record<string, "A" | "B" | "C" | "D" | "E"> = {};
  for (const element of DEFAULT_ELEMENT_RATE_LABELS) rates[element.id] = "C";
  return { ...rates, ...normalizeRates(overrides) };
}

function isRateGrade(value: unknown): value is "A" | "B" | "C" | "D" | "E" {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

function cleanOptionalId(value: unknown): string | undefined {
  // 빈 그래픽은 항상 실수라 재보완한다. 의도적으로 숨기는 경로는 transparent:true 이다.
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
