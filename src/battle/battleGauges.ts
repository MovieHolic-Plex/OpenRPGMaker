// 전투 자원 게이지 — 리미트(배우별), 기력(제2 기술 자원, 배우별), 파티 공용 게이지.
//
// 셋 다 system 설정으로 켠다(생략 = 없음). 끈 프로젝트에서는 이 모듈의 어느 함수도 배틀러를
// 건드리지 않아, 기존 전투의 숫자·rng 스트림이 바이트 단위로 같다.
//
// 이름이 tp 가 아닌 이유: 이 저장소의 TP 는 기술 습득 포인트(rewards.tp, actorTechPoints)다.
// 제2 자원은 내부 이름 resource2, 화면 이름 「기력」으로 둔다.
import type { MutableBattler } from "@/battle/battleBattlers";
import type {
  BattleLimitGaugeConfig,
  BattlePartyGaugeConfig,
  BattleResource2Config,
  Project,
} from "@/project/types";

export const LIMIT_GAUGE_MAX = 100;
const DEFAULT_LIMIT_TAKEN_RATE = 100;
const DEFAULT_LIMIT_DEALT_GAIN = 5;
const DEFAULT_RESOURCE2_MAX = 100;
const DEFAULT_RESOURCE2_DEALT_GAIN = 5;
const DEFAULT_RESOURCE2_TAKEN_GAIN = 10;
const DEFAULT_PARTY_GAUGE_MAX = 100;
const DEFAULT_PARTY_GAUGE_GAIN = 10;

export function limitGaugeConfig(project: Pick<Project, "system">): BattleLimitGaugeConfig | undefined {
  const config = project.system.limitGauge;
  return config?.enabled ? config : undefined;
}

export function resource2Config(project: Pick<Project, "system">): BattleResource2Config | undefined {
  const config = project.system.resource2;
  return config?.enabled ? config : undefined;
}

export function partyGaugeConfig(project: Pick<Project, "system">): BattlePartyGaugeConfig | undefined {
  const config = project.system.partyGauge;
  return config?.enabled ? config : undefined;
}

export function resource2Max(project: Pick<Project, "system">): number {
  return Math.max(1, Math.trunc(resource2Config(project)?.max ?? DEFAULT_RESOURCE2_MAX));
}

export function partyGaugeMax(project: Pick<Project, "system">): number {
  return Math.max(1, Math.trunc(partyGaugeConfig(project)?.max ?? DEFAULT_PARTY_GAUGE_MAX));
}

/** 전투 시작 시 아군 배틀러에 게이지 필드를 심는다. 끈 게이지는 필드 자체를 만들지 않는다. */
export function seedBattleGauges(project: Pick<Project, "system">, actors: readonly MutableBattler[]): void {
  const limit = limitGaugeConfig(project);
  const resource2 = resource2Config(project);
  for (const actor of actors) {
    if (limit) actor.limitGauge = 0;
    if (resource2) actor.resource2 = clamp(Math.trunc(resource2.start ?? 0), 0, resource2Max(project));
  }
}

export function initialPartyGauge(project: Pick<Project, "system">): number | undefined {
  return partyGaugeConfig(project) ? 0 : undefined;
}

export interface BattleHitGaugeInput {
  readonly user: MutableBattler;
  readonly target: MutableBattler;
  /** 실제로 깎인 HP(0 이상). */
  readonly amount: number;
  /** HP 가 깎이기 전 대상의 최대 HP. */
  readonly targetMaxHp: number;
  readonly userIsActor: boolean;
  readonly targetIsActor: boolean;
}

/**
 * 명중한 피해 한 번이 게이지에 주는 효과. 돌려주는 값은 파티 게이지 증가량(아군 공격일 때만).
 * 피해 0(무효·흡수)은 아무것도 채우지 않는다 — 맞지 않은 공격으로 리미트가 차면 이상하다.
 */
export function applyBattleHitGauges(project: Pick<Project, "system">, input: BattleHitGaugeInput): number {
  if (input.amount <= 0) return 0;
  const limit = limitGaugeConfig(project);
  if (limit) {
    if (input.targetIsActor && input.target.limitGauge !== undefined && input.target.hp > 0) {
      const rate = limit.takenRate ?? DEFAULT_LIMIT_TAKEN_RATE;
      const gain = (input.amount / Math.max(1, input.targetMaxHp)) * rate;
      input.target.limitGauge = clamp(input.target.limitGauge + gain, 0, LIMIT_GAUGE_MAX);
    }
    if (input.userIsActor && input.user.limitGauge !== undefined) {
      input.user.limitGauge = clamp(input.user.limitGauge + (limit.dealtGain ?? DEFAULT_LIMIT_DEALT_GAIN), 0, LIMIT_GAUGE_MAX);
    }
  }
  const resource2 = resource2Config(project);
  if (resource2) {
    const max = resource2Max(project);
    if (input.userIsActor && input.user.resource2 !== undefined) {
      input.user.resource2 = clamp(input.user.resource2 + (resource2.dealtGain ?? DEFAULT_RESOURCE2_DEALT_GAIN), 0, max);
    }
    if (input.targetIsActor && input.target.resource2 !== undefined && input.target.hp > 0) {
      input.target.resource2 = clamp(input.target.resource2 + (resource2.takenGain ?? DEFAULT_RESOURCE2_TAKEN_GAIN), 0, max);
    }
  }
  const party = partyGaugeConfig(project);
  return party && input.userIsActor && !input.targetIsActor ? Math.max(0, party.gainPerHit ?? DEFAULT_PARTY_GAUGE_GAIN) : 0;
}

export function clampPartyGauge(project: Pick<Project, "system">, value: number): number {
  return clamp(value, 0, partyGaugeMax(project));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
