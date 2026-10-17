// 포켓몬식 특성(ability). 종(MonsterSpeciesRecord.ability) 하나에 선언형 효과 한 개를 붙인다.
// 자유 코드가 아니라 아래 일곱 종류의 매개변수 효과만 있다 — 도구 스키마가 enum 으로 모두 막고, 엔진은 이 파일의 순수 함수만 부른다.
// 지금은 gen1 전투 모델(몬스터 수집)에서만 적용한다. 전투 중 필드가 아니라 종 정의에서 읽으므로 저장 형태 변화는 종 레코드의 선택 필드 하나다.
import type { MonsterAbility, MonsterAbilityKind, MonsterAbilityStat, MonsterAbilityStatus, Project } from "@/project/types";

export const MONSTER_ABILITY_KINDS: readonly MonsterAbilityKind[] = [
  "immuneType", "resistType", "boostLowHp", "immuneStatus", "contactStatus", "statMultiplier", "endure",
];
/** 주요 상태 다섯. (혼란·맹독 같은 새 상태는 해당 상태가 들어온 뒤 이 목록에 더한다.) */
export const MONSTER_ABILITY_STATUSES: readonly MonsterAbilityStatus[] = ["poison", "burn", "sleep", "freeze", "paralysis"];
/** attack = 물리 공격, defense = 물리 방어, mind = 특수 공격·특수 방어(이 프로젝트는 mind 하나가 둘 다). */
export const MONSTER_ABILITY_STATS: readonly MonsterAbilityStat[] = ["attack", "defense", "mind"];

export const MONSTER_ABILITY_KIND_LABELS: Readonly<Record<MonsterAbilityKind, string>> = {
  immuneType: "타입 무효(·흡수)",
  resistType: "타입 반감",
  boostLowHp: "위기 때 같은 타입 강화",
  immuneStatus: "상태 면역",
  contactStatus: "접촉 시 상태 부여",
  statMultiplier: "능력치 배율",
  endure: "한 번 버티기",
};

const STATUS_LABELS: Readonly<Record<MonsterAbilityStatus, string>> = { poison: "독", burn: "화상", sleep: "수면", freeze: "얼음", paralysis: "마비" };
const STAT_LABELS: Readonly<Record<MonsterAbilityStat, string>> = { attack: "공격", defense: "방어", mind: "특수" };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, number));
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** 필수 매개변수가 빠진 효과는 버린다(undefined) — 반쪽짜리 특성이 조용히 아무 일도 안 하게 두지 않는다. */
export function normalizeMonsterAbility(raw: unknown): MonsterAbility | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const kind = record.kind as MonsterAbilityKind;
  const name = text(record.name, 20);
  if (!name || !MONSTER_ABILITY_KINDS.includes(kind)) return undefined;
  const description = text(record.description, 120);
  const base = { name, ...(description ? { description } : {}), kind } as const;
  const type = text(record.type, 40);
  const status = MONSTER_ABILITY_STATUSES.includes(record.status as MonsterAbilityStatus) ? record.status as MonsterAbilityStatus : undefined;
  const stat = MONSTER_ABILITY_STATS.includes(record.stat as MonsterAbilityStat) ? record.stat as MonsterAbilityStat : undefined;
  switch (kind) {
    case "immuneType": {
      if (!type) return undefined;
      const healPercent = clampInt(record.healPercent, 0, 100, 0);
      return { ...base, type, ...(healPercent > 0 ? { healPercent } : {}) };
    }
    case "resistType":
      return type ? { ...base, type, percent: clampInt(record.percent, 0, 99, 50) } : undefined;
    case "boostLowHp":
      return type ? { ...base, type, percent: clampInt(record.percent, 101, 400, 150) } : undefined;
    case "immuneStatus":
      return status ? { ...base, status } : undefined;
    case "contactStatus":
      return status ? { ...base, status, percent: clampInt(record.percent, 1, 100, 30) } : undefined;
    case "statMultiplier":
      return stat ? { ...base, stat, percent: clampInt(record.percent, 25, 400, 150) } : undefined;
    case "endure":
      return base;
  }
}

/** 설정 화면·도구 응답용 한 줄 설명. 저작자가 description 을 쓰면 그것이 우선이다. */
export function abilityEffectText(ability: MonsterAbility, typeName: (id: string) => string = (id) => id): string {
  if (ability.description) return ability.description;
  switch (ability.kind) {
    case "immuneType": return `${typeName(ability.type!)} 타입 기술을 받지 않는다${ability.healPercent ? ` (최대 HP ${ability.healPercent}% 회복)` : ""}.`;
    case "resistType": return `${typeName(ability.type!)} 타입 피해가 ${ability.percent}% 로 줄어든다.`;
    case "boostLowHp": return `HP 가 1/3 이하일 때 ${typeName(ability.type!)} 타입 기술의 피해가 ${ability.percent}% 가 된다.`;
    case "immuneStatus": return `${STATUS_LABELS[ability.status!]} 상태에 걸리지 않는다.`;
    case "contactStatus": return `물리 공격을 받으면 ${ability.percent}% 확률로 공격자에게 ${STATUS_LABELS[ability.status!]} 상태를 건다.`;
    case "statMultiplier": return `${STAT_LABELS[ability.stat!]} 능력이 ${ability.percent}% 가 된다.`;
    case "endure": return "HP 가 가득 찬 상태에서 쓰러질 피해를 받아도 HP 1 로 버틴다.";
  }
}

export function abilityForSpeciesId(project: Project, speciesId: string | undefined): MonsterAbility | undefined {
  if (!speciesId) return undefined;
  return project.database.monsterSpecies?.find((species) => species.id === speciesId)?.ability;
}

/** 배틀러의 특성. 플레이어 몬스터·야생·트레이너 몬스터 모두 종 id 로 찾는다(적은 enemy.speciesId). */
export function abilityOfBattler(project: Project, battler: { readonly speciesId?: string; readonly recordId: string }): MonsterAbility | undefined {
  const speciesId = battler.speciesId ?? project.database.enemies.find((enemy) => enemy.id === battler.recordId)?.speciesId;
  return abilityForSpeciesId(project, speciesId);
}

/** 이 타입 기술이 특성으로 막히는가. 막히면 흡수 회복 비율(0 이면 그냥 무효)을 돌려준다. */
export function abilityTypeImmunity(ability: MonsterAbility | undefined, moveType: string | undefined): { readonly healPercent: number } | undefined {
  if (ability?.kind !== "immuneType" || !moveType || ability.type !== moveType) return undefined;
  return { healPercent: ability.healPercent ?? 0 };
}

/** 공격 쪽 능력치 배율(%). 물리면 attack, 특수면 mind. */
export function abilityOffensePercent(ability: MonsterAbility | undefined, magical: boolean): number {
  if (ability?.kind !== "statMultiplier") return 100;
  return ability.stat === (magical ? "mind" : "attack") ? ability.percent ?? 100 : 100;
}

/** 방어 쪽 능력치 배율(%). 물리면 defense, 특수면 mind. */
export function abilityDefensePercent(ability: MonsterAbility | undefined, magical: boolean): number {
  if (ability?.kind !== "statMultiplier") return 100;
  return ability.stat === (magical ? "mind" : "defense") ? ability.percent ?? 100 : 100;
}

/** 최종 피해 배율(%): 공격자의 위기 강화 × 방어자의 타입 반감. 1 이상 피해는 최소 1 로 유지한다(호출부). */
export function abilityDamagePercent(
  attacker: { readonly ability?: MonsterAbility; readonly hp: number; readonly maxHp: number },
  defender: { readonly ability?: MonsterAbility },
  moveType: string | undefined,
): number {
  let percent = 100;
  const boost = attacker.ability;
  if (boost?.kind === "boostLowHp" && moveType && boost.type === moveType && attacker.hp * 3 <= attacker.maxHp) percent = Math.round(percent * (boost.percent ?? 150) / 100);
  const resist = defender.ability;
  if (resist?.kind === "resistType" && moveType && resist.type === moveType) percent = Math.round(percent * (resist.percent ?? 50) / 100);
  return percent;
}

export function scaleDamageByPercent(damage: number, percent: number): number {
  if (damage <= 0 || percent === 100) return damage;
  return Math.max(1, Math.floor(damage * percent / 100));
}

export function abilityBlocksStatus(ability: MonsterAbility | undefined, status: string | undefined): boolean {
  return ability?.kind === "immuneStatus" && status !== undefined && ability.status === status;
}

/** 물리 피해를 받은 뒤 공격자에게 거는 상태. */
export function abilityContactStatus(ability: MonsterAbility | undefined): { readonly status: MonsterAbilityStatus; readonly percent: number } | undefined {
  return ability?.kind === "contactStatus" && ability.status ? { status: ability.status, percent: ability.percent ?? 30 } : undefined;
}

/** 한 번 버티기: 가득 찬 HP 에서 쓰러질 피해면 HP 1 이 남는 피해로 줄인다. 안 걸리면 그대로. */
export function abilityEndureDamage(ability: MonsterAbility | undefined, hpBefore: number, maxHp: number, damage: number): { readonly damage: number; readonly endured: boolean } {
  if (ability?.kind === "endure" && hpBefore >= maxHp && hpBefore > 1 && damage >= hpBefore) return { damage: hpBefore - 1, endured: true };
  return { damage, endured: false };
}
