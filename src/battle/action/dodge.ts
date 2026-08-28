// 회피(닷지) 판정 순수 규칙.
// 예전에는 Shift 를 누른 채 걷기만 하면 접촉/근접/투사체/대시 피해를 공짜로 전부 무시했다.
// 이제 회피는 스태미나를 쓰고, 무적은 짧게 정해진 창(i-frame)만 열린다.
// Phaser·씬 접근 없음 — 남은 스태미나/비용/진행 중 여부/경과 시간만 받는다.

export interface DodgeStepInput {
  /** 현재 남은 스태미나. */
  readonly stamina: number;
  /** 회피 1회 비용. 음수는 0으로 클램프. */
  readonly cost: number;
  /** 성공한 회피가 열어주는 무적 창 길이(ms). 음수는 0으로 클램프. */
  readonly iframesMs: number;
  /** 이미 진행 중인 회피의 남은 무적 시간(0이면 진행 중이 아님). */
  readonly activeIframesMs: number;
  /** 이번 프레임 경과 시간(ms). 진행 중인 창을 깎는다. */
  readonly deltaMs: number;
  /** 이번 프레임 회피(대시) 입력이 있었는가. */
  readonly requested: boolean;
}

export interface DodgeStepOutcome {
  /** 이번 프레임에 회피가 새로 시작됐는가. */
  readonly started: boolean;
  /** 비용을 반영한 남은 스태미나. */
  readonly stamina: number;
  /** 이번 프레임 이후 남은 무적 창(ms). */
  readonly iframesRemainingMs: number;
  /** 이번 프레임 피해를 무시하는가. */
  readonly invulnerable: boolean;
}

/** 무적 창을 경과 시간만큼 깎는다. 0 아래로는 내려가지 않는다. */
export function tickDodgeIframes(remainingMs: number, deltaMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  const delta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  return Math.max(0, remainingMs - delta);
}

export function resolveDodgeStep(input: DodgeStepInput): DodgeStepOutcome {
  const remaining = tickDodgeIframes(input.activeIframesMs, input.deltaMs);
  const stamina = Number.isFinite(input.stamina) ? input.stamina : 0;
  // 진행 중인 회피가 남아 있으면 새 회피를 열지 않는다(스태미나 이중 소모 방지).
  if (remaining > 0) return { started: false, stamina, iframesRemainingMs: remaining, invulnerable: true };
  const cost = Number.isFinite(input.cost) ? Math.max(0, input.cost) : 0;
  if (!input.requested || stamina < cost) {
    return { started: false, stamina, iframesRemainingMs: 0, invulnerable: false };
  }
  const window = Number.isFinite(input.iframesMs) ? Math.max(0, input.iframesMs) : 0;
  return {
    started: true,
    stamina: Math.max(0, stamina - cost),
    iframesRemainingMs: window,
    invulnerable: window > 0,
  };
}
