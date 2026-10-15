import type { PlaySceneContext, RuntimeTimer } from "@/player/playSceneTypes";
import type { BattleEventStateSnapshot } from "@/battle/types";

const DEFAULT_TIMER_ID = "timer1";

export type TimerStep = {
  readonly kind: "timer";
  readonly action: "set" | "start" | "stop";
  readonly seconds?: number;
  readonly timerId?: "timer1" | "timer2";
};

function resolveTimerId(step: TimerStep): string {
  return step.timerId ?? DEFAULT_TIMER_ID;
}

export function applyTimerStep(scene: PlaySceneContext, step: TimerStep): void {
  const id = resolveTimerId(step);
  switch (step.action) {
    case "set":
      setRuntimeTimer(scene, id, step.seconds ?? 0, false);
      return;
    case "start":
      setRuntimeTimer(scene, id, startSeconds(scene, step, id), true);
      return;
    case "stop":
      setRuntimeTimer(scene, id, currentSeconds(scene, id), false);
      return;
  }
}

export function updateRuntimeTimers(scene: PlaySceneContext, deltaMs: number): void {
  for (const [id, timer] of scene.runtimeTimers.entries()) {
    if (!timer.active) continue;
    timer.remaining = Math.max(0, timer.remaining - deltaMs / 1000);
    scene.session.timers[id] = displaySeconds(timer);
    if (timer.remaining === 0) {
      timer.active = false;
      recordTimerActive(scene.session, id, false);
    }
  }
}

export function runtimeTimerActivity(timers: ReadonlyMap<string, RuntimeTimer>): Record<string, boolean> {
  const active: Record<string, boolean> = {};
  for (const [id, timer] of timers.entries()) {
    active[id] = timer.active;
  }
  return active;
}

/** Apply only authored writes; untouched field timers keep their live countdown. */
export function applyBattleTimerWrites(
  scene: Pick<PlaySceneContext, "session" | "runtimeTimers">,
  state: BattleEventStateSnapshot,
): void {
  for (const [id, seconds] of Object.entries(state.timerWrites ?? {})) {
    const remaining = normalizeSeconds(seconds);
    const active = state.timerActivityWrites?.[id] ?? scene.runtimeTimers.get(id)?.active ?? false;
    scene.session.timers[id] = remaining;
    scene.runtimeTimers.set(id, { remaining, active: active && remaining > 0 });
    recordTimerActive(scene.session, id, active && remaining > 0);
  }
}

function startSeconds(scene: PlaySceneContext, step: TimerStep, id: string): number {
  return step.seconds ?? currentSeconds(scene, id);
}

function currentSeconds(scene: PlaySceneContext, id: string): number {
  const runtime = scene.runtimeTimers.get(id);
  if (runtime) return displaySeconds(runtime);
  return normalizeSeconds(scene.session.timers[id] ?? 0);
}

function setRuntimeTimer(scene: PlaySceneContext, id: string, seconds: number, active: boolean): void {
  const normalized = normalizeSeconds(seconds);
  scene.session.timers[id] = normalized;
  scene.runtimeTimers.set(id, { remaining: normalized, active: active && normalized > 0 });
  recordTimerActive(scene.session, id, active && normalized > 0);
}

/** 흐르는 타이머를 세션에 적어 둔다 — 세이브가 이 표를 싣고, 불러오기가 장면 타이머를 다시 짠다. */
function recordTimerActive(session: PlaySessionTimers, id: string, active: boolean): void {
  if (active) (session.timerActive ??= {})[id] = true;
  else if (session.timerActive) delete session.timerActive[id];
}

type PlaySessionTimers = { timerActive?: Record<string, boolean> };

/** 불러온 세션(timers + timerActive)에서 장면 타이머를 다시 만든다. 값이 0 이거나 흐르던 표시가 없으면 멈춘 채다. */
export function restoreRuntimeTimers(scene: Pick<PlaySceneContext, "session" | "runtimeTimers">): void {
  scene.runtimeTimers.clear();
  for (const [id, seconds] of Object.entries(scene.session.timers)) {
    const remaining = normalizeSeconds(seconds);
    scene.runtimeTimers.set(id, { remaining, active: remaining > 0 && scene.session.timerActive?.[id] === true });
  }
}

function normalizeSeconds(seconds: number): number {
  return Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
}

function displaySeconds(timer: RuntimeTimer): number {
  return normalizeSeconds(Math.ceil(timer.remaining));
}
