import type { PlaySceneContext, RuntimeTimer } from "@/player/playSceneTypes";

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
    if (timer.remaining === 0) timer.active = false;
  }
}

export function runtimeTimerActivity(timers: ReadonlyMap<string, RuntimeTimer>): Record<string, boolean> {
  const active: Record<string, boolean> = {};
  for (const [id, timer] of timers.entries()) {
    active[id] = timer.active;
  }
  return active;
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
}

function normalizeSeconds(seconds: number): number {
  return Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
}

function displaySeconds(timer: RuntimeTimer): number {
  return normalizeSeconds(Math.ceil(timer.remaining));
}
