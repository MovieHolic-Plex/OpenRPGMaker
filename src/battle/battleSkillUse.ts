import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import { canBattlerAct, stateBlocksSkillUse } from "@/battle/battleStates";
import { limitGaugeConfig, partyGaugeConfig, resource2Config } from "@/battle/battleGauges";
import type { ActorId, Project, SkillId, SkillRecord } from "@/project/types";

export type BattleSkillUser = Pick<
  MutableBattler | BattleBattlerSnapshot,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp" | "skillCooldowns" | "stateIds" | "equipmentEffects" | "limitGauge" | "resource2"
>;
export type MutableBattleSkillUser = Pick<
  MutableBattler,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp" | "skillCooldowns" | "equipmentEffects" | "limitGauge" | "resource2"
>;
export type BattleSkillUseFailure =
  | "missingSkill" | "notLearned" | "skillBlocked" | "insufficientMp" | "noPp" | "cooldown"
  | "comboPartnerAbsent" | "comboPartnerNotReady" | "comboPartnerMp"
  | "insufficientResource2" | "limitNotReady" | "insufficientPartyGauge";
export type BattleSkillResourceConsumption =
  | { readonly kind: "pp" | "mp"; readonly remaining: number }
  | { readonly kind: "none" };

export function battleSkillMpCost(skill: Pick<SkillRecord, "mpCost">, maxMp: number, halfCost = false): number {
  const flat = skill.mpCost.flat ?? 0;
  const percentMax = skill.mpCost.percentMax ?? 0;
  const cost = Math.max(0, Math.trunc(flat) + Math.floor((Math.max(0, maxMp) * percentMax) / 100));
  // 장비 「MP 소모 절반」: RM2k3/EasyRPG 와 같은 (cost + 1) / 2 내림 — 1 짜리 기술이 공짜가 되지 않는다.
  return halfCost ? Math.floor((cost + 1) / 2) : cost;
}

/** 시전자 장비의 MP 절반 효과까지 반영한 소모량. 적법성·소비·메뉴 표시가 같은 값을 본다. */
export function battleSkillMpCostFor(
  skill: Pick<SkillRecord, "mpCost">,
  user: { readonly maxMp: number; readonly equipmentEffects?: { readonly halfMpCost?: boolean } },
): number {
  return battleSkillMpCost(skill, user.maxMp, user.equipmentEffects?.halfMpCost === true);
}

/** 장비가 준 스킬까지 포함해 이 배틀러가 「가진」 스킬인가. */
export function battlerHasSkill(user: Pick<BattleSkillUser, "skillIds" | "equipmentEffects">, skillId: SkillId): boolean {
  return user.skillIds.includes(skillId) || user.equipmentEffects?.grantedSkillIds?.includes(skillId) === true;
}

/** 배운 스킬 뒤에 장비가 준 스킬을 겹치지 않게 붙인다(전투 메뉴·자동 전투 목록). */
export function battlerSkillIdsWithGrants(user: Pick<BattleSkillUser, "skillIds" | "equipmentEffects">): SkillId[] {
  const granted = (user.equipmentEffects?.grantedSkillIds ?? []).filter((id) => !user.skillIds.includes(id));
  return [...user.skillIds, ...granted];
}

/** 제2 자원(기력) 소모량. 시스템에서 끄면 0 이다. */
export function battleSkillResource2Cost(project: Pick<Project, "system">, skill: Pick<SkillRecord, "resource2Cost">): number {
  if (!resource2Config(project)) return 0;
  return Math.max(0, Math.trunc(skill.resource2Cost ?? 0));
}

/** 리미트 기술인가. 시스템에서 끄면 일반 기술처럼 쓴다. */
export function battleSkillNeedsLimit(project: Pick<Project, "system">, skill: Pick<SkillRecord, "limitSkill">): boolean {
  return skill.limitSkill === true && limitGaugeConfig(project) !== undefined;
}

/** 파티 공용 게이지 소모량. 시스템에서 끄면 0 이다. */
export function battleSkillPartyGaugeCost(project: Pick<Project, "system">, skill: Pick<SkillRecord, "partyGaugeCost">): number {
  if (!partyGaugeConfig(project)) return 0;
  return Math.max(0, Math.trunc(skill.partyGaugeCost ?? 0));
}

export function battleSkillUseFailure(
  project: Project,
  user: BattleSkillUser,
  skillId: SkillId,
  options: { readonly requireLearned?: boolean } = {},
): BattleSkillUseFailure | undefined {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill) return "missingSkill";
  if (options.requireLearned !== false && !battlerHasSkill(user, skillId)) return "notLearned";
  if ((user.skillCooldowns?.[skillId] ?? 0) > 0) return "cooldown";
  if (stateBlocksSkillUse(project, user)) return "skillBlocked";
  if (usesSkillPp(project, user, skill)) {
    const currentPp = user.skillPp?.[skillId] ?? Math.max(1, Math.trunc(skill.maxPp ?? 1));
    if (currentPp <= 0) return "noPp";
    return undefined;
  }
  if (user.mp < battleSkillMpCostFor(skill, user)) return "insufficientMp";
  // 기력·리미트는 그 게이지를 가진 배틀러(켠 전투의 아군)만 판정한다 — 적은 게이지가 없어 같은 기술을 그냥 쓴다.
  if (user.resource2 !== undefined && user.resource2 < battleSkillResource2Cost(project, skill)) return "insufficientResource2";
  if (user.limitGauge !== undefined && battleSkillNeedsLimit(project, skill) && user.limitGauge < 100) return "limitNotReady";
  return undefined;
}

/** Runtime-ready single authority for MP/PP consumption. */
export function consumeBattleSkillResource(
  project: Project,
  user: MutableBattleSkillUser,
  skillId: SkillId,
): BattleSkillResourceConsumption {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill) return { kind: "none" };
  startBattleSkillCooldown(user, skill);
  if (usesSkillPp(project, user, skill)) {
    const maxPp = Math.max(1, Math.trunc(skill.maxPp ?? 1));
    const currentPp = user.skillPp?.[skillId] ?? maxPp;
    const remaining = Math.max(0, Math.trunc(currentPp) - 1);
    user.skillPp ??= {};
    user.skillPp[skillId] = remaining;
    return { kind: "pp", remaining };
  }
  const remaining = Math.max(0, user.mp - battleSkillMpCostFor(skill, user));
  user.mp = remaining;
  const resource2Cost = battleSkillResource2Cost(project, skill);
  if (resource2Cost > 0 && user.resource2 !== undefined) user.resource2 = Math.max(0, user.resource2 - resource2Cost);
  if (user.limitGauge !== undefined && battleSkillNeedsLimit(project, skill)) user.limitGauge = 0;
  return { kind: "mp", remaining };
}

function usesSkillPp(
  project: Pick<Project, "system">,
  user: Pick<BattleSkillUser, "monsterInstanceId">,
  skill: Pick<SkillRecord, "maxPp">,
): boolean {
  return skill.maxPp !== undefined
    && (typeof user.monsterInstanceId === "string" || project.system.battleModel === "gen1");
}

export function battleSkillUseFailureLabel(
  failure: BattleSkillUseFailure,
  skill: SkillRecord | undefined,
  user: Pick<BattleSkillUser, "mp" | "maxMp"> & Partial<Pick<BattleSkillUser, "equipmentEffects" | "resource2">>,
  project?: Pick<Project, "system">,
): string {
  switch (failure) {
    case "missingSkill":
      return "스킬 데이터가 없습니다.";
    case "notLearned":
      return "아직 습득하지 않은 스킬입니다.";
    case "skillBlocked":
      return "침묵 상태라 스킬을 사용할 수 없습니다.";
    case "insufficientMp": {
      const cost = skill ? battleSkillMpCostFor(skill, user) : 0;
      return `MP 부족 (필요 ${cost} / 현재 ${user.mp})`;
    }
    case "insufficientResource2": {
      const label = (project && resource2Config(project)?.label) || "기력";
      return `${label} 부족 (필요 ${skill?.resource2Cost ?? 0} / 현재 ${Math.floor(user.resource2 ?? 0)})`;
    }
    case "limitNotReady":
      return `${(project && limitGaugeConfig(project)?.label) || "리미트"} 게이지가 가득 차야 합니다.`;
    case "insufficientPartyGauge":
      return `${(project && partyGaugeConfig(project)?.label) || "연계 게이지"}가 부족합니다.`;
    case "cooldown": return "재사용 대기 중입니다.";
    case "noPp":
      return "PP가 부족합니다.";
    case "comboPartnerAbsent":
      return "연계 동료가 전투에 없습니다.";
    case "comboPartnerNotReady":
      return "연계 동료가 아직 준비되지 않았습니다.";
    case "comboPartnerMp":
      return "연계 동료의 MP가 부족합니다.";
  }
}

/** 연계기(듀얼·트리플 테크)의 참가 배우. 정규화가 2~3명일 때만 남기므로 그 밖이면 일반 기술이다. */
export function comboActorIdsOf(skill: Pick<SkillRecord, "comboActorIds"> | undefined): readonly ActorId[] | undefined {
  const ids = skill?.comboActorIds;
  return ids && ids.length >= 2 ? ids : undefined;
}

/** 연계 판정에 쓰는 전투 참가 배우 한 명. ready 는 게이지 만충(strict 는 이번 라운드 미행동)이다. */
export interface BattleComboParticipant {
  readonly recordId: string;
  readonly hp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly stateIds: readonly string[];
  readonly ready: boolean;
  /** 이 동료 장비의 MP 절반 효과 — 연계기에서 각자 내는 MP 도 절반이다. */
  readonly halfMpCost?: boolean;
}

/**
 * 스킬 사용 가능 여부의 배우용 단일 권위. 일반 기술은 battleSkillUseFailure 와 같고,
 * 연계기는 시전자가 연계 멤버이면 배우지 않아도 되며 동료 전원의 생존·준비·MP 를 본다.
 * 런타임(명령 적법성)과 전투 메뉴가 같은 함수를 써야 메뉴에 보인 기술이 실행에서 거부되지 않는다.
 */
export function battleActorSkillFailure(
  project: Project,
  user: BattleSkillUser & { readonly recordId: string },
  skillId: SkillId,
  party: readonly BattleComboParticipant[],
  /** 파티 공용 게이지 현재값. 시스템에서 켠 경우에만 추격 연계기 적법성에 쓴다. */
  partyGauge?: number,
): BattleSkillUseFailure | undefined {
  const skill = project.database.skills.find((record) => record.id === skillId);
  const combo = comboActorIdsOf(skill);
  const partyFailure = skill && (partyGauge ?? 0) < battleSkillPartyGaugeCost(project, skill) ? "insufficientPartyGauge" as const : undefined;
  if (!skill || !combo) return battleSkillUseFailure(project, user, skillId) ?? partyFailure;
  if (!combo.includes(user.recordId as ActorId)) return "notLearned";
  const own = battleSkillUseFailure(project, user, skillId, { requireLearned: false });
  if (own) return own;
  const members = combo.map((actorId) => party.find((entry) => entry.recordId === actorId));
  if (members.some((member) => !member || member.hp <= 0)) return "comboPartnerAbsent";
  for (const member of members) {
    if (!member || member.recordId === user.recordId) continue;
    if (!member.ready || !canBattlerAct(project, member) || stateBlocksSkillUse(project, member)) return "comboPartnerNotReady";
    if (member.mp < battleSkillMpCost(skill, member.maxMp, member.halfMpCost === true)) return "comboPartnerMp";
  }
  return partyFailure;
}

/**
 * 이 배우가 시전할 수 있는 연계기 — 연계 멤버이고 동료 전원이 참전 중인 것만(동료가 전투에 없으면 목록에서 숨긴다).
 * 이미 배운 목록(known)에 있는 id 는 뺀다.
 */
export function comboSkillIdsFor(project: Project, actorRecordId: string, partyRecordIds: readonly string[], known: readonly SkillId[] = []): SkillId[] {
  return project.database.skills
    .filter((skill) => {
      const combo = comboActorIdsOf(skill);
      return combo !== undefined && combo.includes(actorRecordId as ActorId) && combo.every((id) => partyRecordIds.includes(id)) && !known.includes(skill.id);
    })
    .map((skill) => skill.id);
}

/** 스냅샷의 참전 배우를 연계 참가자로. 게이지는 strict 에서도 미행동 배우만 100 이다. */
export function comboParticipantsFromSnapshot(snapshot: Pick<BattleSnapshot, "actors">): BattleComboParticipant[] {
  return snapshot.actors.map((actor) => ({
    recordId: actor.recordId, hp: actor.hp, mp: actor.mp, maxMp: actor.maxMp, stateIds: actor.stateIds, ready: actor.gauge >= 100,
    ...(actor.equipmentEffects?.halfMpCost ? { halfMpCost: true } : {}),
  }));
}

/** Includes the casting round; end-of-round decrement leaves N subsequent blocked rounds. */
export function startBattleSkillCooldown(user: Pick<MutableBattler, "skillCooldowns">, skill: SkillRecord): void {
  if ((skill.cooldownTurns ?? 0) > 0) (user.skillCooldowns ??= {})[skill.id] = skill.cooldownTurns! + 1;
}
export function advanceBattleSkillCooldowns(battlers: readonly Pick<MutableBattler, "skillCooldowns">[]): void {
  for (const battler of battlers) for (const id of Object.keys(battler.skillCooldowns ?? {})) {
    const remaining = battler.skillCooldowns![id] - 1;
    if (remaining > 0) battler.skillCooldowns![id] = remaining;
    else delete battler.skillCooldowns![id];
  }
}
