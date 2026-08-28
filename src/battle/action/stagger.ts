// 스태거(경직) 순수 규칙.
// 예전에는 적이 선딜(windup) 중에 맞아도 텔레그래프가 그대로 굴러가 예고된 타격이 반드시 터졌다.
// 이제 피격은 진행 중인 행동을 끊고 짧은 경직 창을 열어, 그 동안 적은 행동/이동을 하지 않는다.
// Phaser·씬 접근 없음 — 모드 이름과 시간만 다룬다. 시각 효과 정리는 소비처(씬) 책임.

/** 액션 적의 모드 이름. src/player/actionCombatTypes.ts 의 ActionEnemyMode 와 같은 집합. */
export type ActionModeName = "combat" | "windup" | "dash" | "recover" | "stagger";

/** 기본 경직 길이. 반격 리듬이 느껴질 만큼 짧게(약 8프레임). */
export const DEFAULT_STAGGER_MS = 220;

export interface StaggerHitInput {
  /** 피격 순간의 모드. */
  readonly mode: ActionModeName;
  /** 저작된 경직 길이(ms). 생략/비수치면 기본값, 음수는 0으로 클램프. */
  readonly staggerMs?: number;
}

export interface StaggerHitOutcome {
  readonly mode: "stagger";
  readonly modeTimerMs: number;
  /** 선딜을 끊었는가 — 소비처는 텔레그래프/점멸 트윈을 반드시 없애야 한다. */
  readonly cancelWindup: boolean;
  /** 돌진을 끊었는가 — 소비처는 dash 상태를 버려야 한다. */
  readonly cancelDash: boolean;
}

export interface StaggerTickInput {
  /** 남은 경직 시간. */
  readonly modeTimerMs: number;
  readonly deltaMs: number;
  /** 이번 프레임까지 반영된 남은 공격 쿨다운. */
  readonly attackCooldownMs: number;
  /** 경직이 끝날 때 걸어줄 공격 쿨다운(끊긴 공격이 즉시 재발화하지 않게 한다). */
  readonly armCooldownMs: number;
}

export interface StaggerTickOutcome {
  readonly mode: "stagger" | "combat";
  readonly modeTimerMs: number;
  readonly attackCooldownMs: number;
}

function positive(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

/** 피격 → 경직 전이. 어떤 모드에서 맞았든 경직으로 들어간다. */
export function resolveStaggerOnHit(input: StaggerHitInput): StaggerHitOutcome {
  return {
    mode: "stagger",
    modeTimerMs: positive(input.staggerMs, DEFAULT_STAGGER_MS),
    cancelWindup: input.mode === "windup",
    cancelDash: input.mode === "dash",
  };
}

/** 경직 중에는 공격을 시작하지도, 이동하지도 않는다. */
export function canActInMode(mode: ActionModeName): mode is Exclude<ActionModeName, "stagger"> {
  return mode !== "stagger";
}

/** 경직 창을 깎고, 다 흐르면 쿨다운을 존중한 채 전투로 되돌린다. */
export function tickStagger(input: StaggerTickInput): StaggerTickOutcome {
  const remaining = Math.max(0, positive(input.modeTimerMs, 0) - positive(input.deltaMs, 0));
  const cooldown = positive(input.attackCooldownMs, 0);
  if (remaining > 0) return { mode: "stagger", modeTimerMs: remaining, attackCooldownMs: cooldown };
  return {
    mode: "combat",
    modeTimerMs: 0,
    attackCooldownMs: Math.max(cooldown, positive(input.armCooldownMs, 0)),
  };
}
