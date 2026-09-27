/**
 * 롤링 HP 미터(마더2/EarthBound 식, system.battleRollingHp).
 *
 * 전투 규칙(battle/runtime.ts)은 피해를 즉시 확정한다. 이 모듈은 **표시와 전투 종료 시점의 결산**만 바꾼다:
 *  - 표시 HP 는 실제 HP 쪽으로 초당 `perSecond` 만큼 흘러간다(피해는 내려가고 회복은 올라간다).
 *  - 실제 HP 가 0 인데 미터가 아직 0 에 닿지 않은 아군은 「쓰러지는 중(dying)」이다.
 *  - 결과 화면이 뜨는 순간 미터를 멈춘다(freeze). 승리·도주로 끝났으면 미터에 남은 HP 로 살아남는다.
 *    패배는 결산하지 않는다 — 규칙 엔진이 이미 전멸을 선언했다.
 *
 * 시각은 호출자가 넘긴다(`advance(nowMs)`). rAF 는 `startRollingHpTicker` 만 쓴다 — 모델 자체는
 * 시계가 없어 테스트가 시간을 직접 밀 수 있다.
 */
import type { BattleResult, BattleSnapshot } from "@/battle/runtime";

export const DEFAULT_ROLLING_HP_PER_SECOND = 40;
export const ROLLING_HP_SPEED_LIMITS = { min: 1, max: 999 } as const;

type RollingEntry = {
  displayed: number;
  target: number;
  maxHp: number;
};

export type RollingHpMeter = {
  /** 목표(실제 HP)를 갱신하고 지금 표시할 값을 돌려준다. 처음 보는 배틀러는 목표에서 시작한다. */
  setTarget(id: string, hp: number, maxHp: number): number;
  /** 지난 호출 이후 흐른 시간만큼 미터를 굴린다. 값이 바뀌었으면 true. */
  advance(nowMs: number): boolean;
  /** 굴리지 않고 기준 시각만 옮긴다 — 미터가 쉬던 시간을 한꺼번에 굴리지 않게. */
  resetClock(nowMs: number): void;
  /** 화면에 그릴 정수 HP(올림 — 1 이 남았으면 1 로 보인다). 모르는 id 면 undefined. */
  displayed(id: string): number | undefined;
  /** 실제 HP 는 0 인데 미터가 아직 남은 상태. */
  isDying(id: string): boolean;
  /** 아직 목표에 닿지 않은 미터가 있는가(티커가 계속 돌아야 하는가). */
  isRolling(): boolean;
  /** 결과 화면 진입 — 이후 advance/setTarget 은 미터를 움직이지 않는다. */
  freeze(): void;
  readonly frozen: boolean;
};

export function normalizeRollingHpSpeed(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_ROLLING_HP_PER_SECOND;
  return Math.max(ROLLING_HP_SPEED_LIMITS.min, Math.min(ROLLING_HP_SPEED_LIMITS.max, Math.round(numeric)));
}

export function createRollingHpMeter(options: { readonly perSecond?: number; readonly nowMs?: number } = {}): RollingHpMeter {
  const perSecond = normalizeRollingHpSpeed(options.perSecond);
  const entries = new Map<string, RollingEntry>();
  let lastMs: number | undefined = options.nowMs;
  let frozen = false;

  const clampHp = (hp: number, maxHp: number): number => Math.max(0, Math.min(Math.max(0, maxHp), hp));

  return {
    setTarget(id, hp, maxHp) {
      const target = clampHp(hp, maxHp);
      const entry = entries.get(id);
      if (!entry) {
        entries.set(id, { displayed: target, target, maxHp });
        return Math.ceil(target);
      }
      if (!frozen) {
        entry.target = target;
        entry.maxHp = maxHp;
        // 최대 HP 가 줄면(능력치 변화) 미터가 최대치를 넘지 않게 자른다.
        entry.displayed = clampHp(entry.displayed, maxHp);
      }
      return Math.ceil(entry.displayed);
    },
    advance(nowMs) {
      const previous = lastMs;
      lastMs = nowMs;
      if (frozen || previous === undefined) return false;
      const elapsed = Math.max(0, nowMs - previous);
      if (elapsed === 0) return false;
      const step = perSecond * (elapsed / 1000);
      let changed = false;
      for (const entry of entries.values()) {
        if (entry.displayed === entry.target) continue;
        const before = Math.ceil(entry.displayed);
        entry.displayed = entry.displayed > entry.target
          ? Math.max(entry.target, entry.displayed - step)
          : Math.min(entry.target, entry.displayed + step);
        if (Math.ceil(entry.displayed) !== before) changed = true;
      }
      return changed;
    },
    resetClock(nowMs) {
      lastMs = nowMs;
    },
    displayed(id) {
      const entry = entries.get(id);
      return entry ? Math.ceil(entry.displayed) : undefined;
    },
    isDying(id) {
      const entry = entries.get(id);
      return entry !== undefined && entry.target <= 0 && Math.ceil(entry.displayed) > 0;
    },
    isRolling() {
      if (frozen) return false;
      for (const entry of entries.values()) if (entry.displayed !== entry.target) return true;
      return false;
    },
    freeze() {
      frozen = true;
    },
    get frozen() {
      return frozen;
    },
  };
}

/**
 * 결과 확정 시 세션에 되돌려 쓸 스냅샷. 승리·도주면 아직 굴러 내려가던 미터 값을 HP 로 인정한다
 * (치명타를 맞고도 미터가 0 에 닿기 전에 이기면 살아남는다). 회복이 올라가던 중이면 실제 HP 를 둔다 —
 * 미터는 플레이어에게 유리한 쪽으로만 결산한다. 패배는 손대지 않는다.
 */
export function applyRollingHpSurvival(
  result: BattleResult,
  snapshot: BattleSnapshot,
  meter: RollingHpMeter | undefined,
): BattleSnapshot {
  if (!meter || (result !== "victory" && result !== "escape")) return snapshot;
  let changed = false;
  const actors = snapshot.actors.map((actor) => {
    const shown = meter.displayed(actor.recordId) ?? meter.displayed(actor.id);
    if (shown === undefined) return actor;
    const real = Math.max(0, actor.hp);
    const settled = Math.min(actor.maxHp, Math.max(real, Math.floor(shown)));
    if (settled === actor.hp) return actor;
    changed = true;
    return { ...actor, hp: settled, defeated: settled <= 0 };
  });
  return changed ? { ...snapshot, actors } : snapshot;
}

type FrameScheduler = {
  readonly request: (callback: (nowMs: number) => void) => number;
  readonly cancel: (id: number) => void;
};

function defaultScheduler(): FrameScheduler | undefined {
  if (typeof requestAnimationFrame !== "function" || typeof cancelAnimationFrame !== "function") return undefined;
  return { request: (callback) => requestAnimationFrame(callback), cancel: (id) => cancelAnimationFrame(id) };
}

/**
 * 미터가 굴러가는 동안에만 프레임을 돌린다. `kick()` 은 목표가 바뀐 뒤 부른다(이미 돌고 있으면 무시).
 * 스케줄러가 없으면(노드 테스트) 티커는 아무 일도 하지 않고, 호출자가 `advance` 를 직접 부른다.
 */
export function startRollingHpTicker(
  meter: RollingHpMeter,
  render: () => void,
  scheduler: FrameScheduler | undefined = defaultScheduler(),
): { kick(): void; stop(): void } {
  let frameId = 0;
  let stopped = false;
  const frame = (nowMs: number): void => {
    frameId = 0;
    if (stopped) return;
    if (meter.advance(nowMs)) render();
    if (meter.isRolling()) frameId = scheduler!.request(frame);
  };
  return {
    kick() {
      if (stopped || !scheduler || frameId !== 0 || !meter.isRolling()) return;
      frameId = scheduler.request((nowMs) => {
        // 첫 프레임은 기준 시각만 잡는다 — 목표가 바뀐 뒤 쉬던 시간을 한 번에 굴리지 않는다.
        meter.resetClock(nowMs);
        frame(nowMs);
      });
    },
    stop() {
      stopped = true;
      if (frameId !== 0) scheduler?.cancel(frameId);
      frameId = 0;
    },
  };
}
