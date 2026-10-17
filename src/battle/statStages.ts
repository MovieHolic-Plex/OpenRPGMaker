// 포켓몬식 능력치 단계(−6~+6). 전투 한 번 동안만 쓰는 배틀러 필드이고 저장하지 않는다 —
// 교체해서 빠지거나 전투가 끝나면 사라진다. 이진 버프 상태(state_attack_up 같은 배율 상태)와는 별개이고 곱으로 겹친다.
// 배율 표는 gen1/damage.ts 의 카트리지 표(25%~400%)를 그대로 쓴다 — 후속 세대의 2/8~8/2 와 극값이 같고 중간값 차이는 1%p 안쪽이다.
import { applyStatStageRatio } from "@/battle/gen1/damage";
import { withJosa } from "@/util/josa";

export const STAT_STAGE_KEYS = ["attack", "defense", "spAttack", "spDefense", "speed", "accuracy", "evasion"] as const;
export type StatStageKey = (typeof STAT_STAGE_KEYS)[number];
export type StatStages = Partial<Record<StatStageKey, number>>;

export const STAT_STAGE_MIN = -6;
export const STAT_STAGE_MAX = 6;

export const STAT_STAGE_LABELS: Readonly<Record<StatStageKey, string>> = {
  attack: "공격",
  defense: "방어",
  spAttack: "특수공격",
  spDefense: "특수방어",
  speed: "스피드",
  accuracy: "명중률",
  evasion: "회피율",
};

/** HUD 약어. 상태 알약(PSN·BRN)과 같은 3글자 영문 관례다. */
export const STAT_STAGE_ABBREVIATIONS: Readonly<Record<StatStageKey, string>> = {
  attack: "ATK",
  defense: "DEF",
  spAttack: "SPA",
  spDefense: "SPD",
  speed: "SPE",
  accuracy: "ACC",
  evasion: "EVA",
};

export function isStatStageKey(value: unknown): value is StatStageKey {
  return typeof value === "string" && (STAT_STAGE_KEYS as readonly string[]).includes(value);
}

export function clampStatStage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(STAT_STAGE_MIN, Math.min(STAT_STAGE_MAX, Math.trunc(value)));
}

export function statStageOf(stages: StatStages | undefined, stat: StatStageKey): number {
  return clampStatStage(stages?.[stat] ?? 0);
}

/** 스탯 값에 단계 배율을 곱한다(내림, 최소 1). 단계 0 이면 값 그대로. */
export function applyStatStage(value: number, stages: StatStages | undefined, stat: StatStageKey): number {
  const stage = statStageOf(stages, stat);
  return stage === 0 ? value : applyStatStageRatio(value, stage);
}

/** 단계 숫자 하나를 값에 곱한다(내림, 최소 1) — 명중률·회피율처럼 두 편의 단계를 합성할 때 쓴다. */
export function scaleByStage(value: number, stage: number): number {
  const clamped = clampStatStage(stage);
  return clamped === 0 ? value : applyStatStageRatio(value, clamped);
}

/** 단계 배율(실수). 확률 보정·예측 계산용. */
export function statStageMultiplier(stages: StatStages | undefined, stat: StatStageKey): number {
  const stage = statStageOf(stages, stat);
  return stage === 0 ? 1 : applyStatStageRatio(10000, stage) / 10000;
}

export function hasStatStages(stages: StatStages | undefined): boolean {
  return Boolean(stages) && STAT_STAGE_KEYS.some((key) => statStageOf(stages, key) !== 0);
}

/** 0 이 아닌 단계만 남긴 사본. 없으면 undefined(스냅샷에 필드를 싣지 않는다). */
export function compactStatStages(stages: StatStages | undefined): StatStages | undefined {
  if (!stages) return undefined;
  const entries = STAT_STAGE_KEYS.flatMap((key) => {
    const stage = statStageOf(stages, key);
    return stage === 0 ? [] : [[key, stage] as const];
  });
  return entries.length ? Object.fromEntries(entries) as StatStages : undefined;
}

export interface StatStageChange {
  readonly stat: StatStageKey;
  readonly before: number;
  readonly after: number;
  /** 실제로 바뀐 폭(요청 delta 가 한계에서 잘린 값). 0 이면 더 이상 오르내리지 않는다. */
  readonly applied: number;
  readonly requested: number;
}

/** 단계를 delta 만큼 옮긴다(−6~+6 에서 멈춤). 새 stages 와 변화 기록을 돌려주고 입력은 바꾸지 않는다. */
export function shiftStatStage(
  stages: StatStages | undefined,
  stat: StatStageKey,
  delta: number,
): { readonly stages: StatStages | undefined; readonly change: StatStageChange } {
  const before = statStageOf(stages, stat);
  const requested = Math.trunc(delta);
  const after = clampStatStage(before + requested);
  const next: StatStages = { ...(stages ?? {}), [stat]: after };
  return {
    stages: compactStatStages(next),
    change: { stat, before, after, applied: after - before, requested },
  };
}

/** 「공격이 올랐다!」 문장. 한계에 걸리면 「공격은 더 이상 오르지 않는다!」. */
export function statStageMessage(name: string, change: StatStageChange): string {
  const label = STAT_STAGE_LABELS[change.stat];
  if (change.applied === 0) {
    return `${name}의 ${withJosa(label, "은/는")} 더 이상 ${change.requested > 0 ? "오르지" : "내려가지"} 않는다!`;
  }
  const size = Math.abs(change.applied);
  const verb = change.applied > 0
    ? (size >= 3 ? "대폭 올랐다!" : size === 2 ? "크게 올랐다!" : "올랐다!")
    : (size >= 3 ? "대폭 내려갔다!" : size === 2 ? "크게 내려갔다!" : "내려갔다!");
  return `${name}의 ${withJosa(label, "이/가")} ${verb}`;
}

/** 기술 설명용 한 줄: 「상대의 공격 −1단계」「자신의 스피드 +2단계 (20%)」. */
export function statStageEffectText(effect: { readonly stat: StatStageKey; readonly stages: number; readonly chance?: number; readonly target?: "target" | "self" }): string {
  const who = effect.target === "self" ? "자신의" : "상대의";
  const chance = effect.chance !== undefined && effect.chance < 100 ? ` (${effect.chance}%)` : "";
  return `${who} ${STAT_STAGE_LABELS[effect.stat]} ${effect.stages > 0 ? "+" : "−"}${Math.abs(effect.stages)}단계${chance}`;
}
