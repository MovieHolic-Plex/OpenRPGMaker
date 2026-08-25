import {
  calendarDayKey,
  initialGameTime,
  minutesUntilDayEnd,
  resolveTimeSystem,
  setGameTimeClock,
  timePhaseFor,
  type TimePhase,
} from "@/project/gameTime";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { StepResult } from "@/player/interpreter";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import { advanceTimeAcrossDayBoundaries, transitionToNextDay } from "@/player/dayTransition";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { fadeCamera, TRANSFER_FADE_DURATION_MS } from "@/player/playSceneMapCommands";
import { PLAY_RESOLUTION } from "@/player/playResolution";

const TIME_FIXED_STEP_MS = 1000;
const TIME_TINT_DEPTH = 850_000;
const TIME_TINT_TRANSITION_MS = 1500;

export type TimeTintVisual = {
  readonly color: number;
  readonly alpha: number;
};

export function installTimeTintLayer(scene: PlaySceneContext): void {
  if (scene.timeTintGraphics) return;
  const graphics = scene.add.graphics();
  graphics.setScrollFactor(0);
  graphics.setDepth(TIME_TINT_DEPTH);
  scene.timeTintGraphics = graphics;
  scene.timeTintPhase = undefined;
  scene.timeTintDisplayed = { color: 0xffffff, alpha: 0 };
  scene.timeTintTransition = null;
  syncTimeTintLayer(scene);
}

export function updateGameTime(scene: PlaySceneContext, deltaMs: number): void {
  const project = store.getCurrent();
  const system = resolveTimeSystem(project);
  if (!system) {
    scene.timeFixedAccumulatorMs = 0;
    scene.timeMinuteAccumulator = 0;
    return;
  }
  scene.session.gameTime ??= initialGameTime(system);
  if (!scene.session.gameTime || isGameTimePausedForRuntime(scene)) return;

  scene.timeFixedAccumulatorMs += Math.max(0, deltaMs);
  while (scene.timeFixedAccumulatorMs >= TIME_FIXED_STEP_MS) {
    scene.timeFixedAccumulatorMs -= TIME_FIXED_STEP_MS;
    scene.timeMinuteAccumulator += system.minutesPerRealSecond;
    const wholeMinutes = Math.floor(scene.timeMinuteAccumulator);
    if (wholeMinutes <= 0) continue;
    scene.timeMinuteAccumulator -= wholeMinutes;
    if (system.forceSleep && minutesUntilDayEnd(scene.session.gameTime, system) <= wholeMinutes) {
      observeScheduledTimeTransition(scene, scene.sleepUntilMorning(), "forced-sleep");
      return;
    }
    const advanced = advanceTimeAcrossDayBoundaries(project, scene.session, wholeMinutes);
    if (!advanced.ok) {
      scene.timeFixedAccumulatorMs = 0;
      scene.timeMinuteAccumulator = 0;
      showDayTransitionFailure(scene, advanced.reason);
      return;
    }
    scene.clearRuntimeOverlay("day-transition-error");
  }
}

export function updateTimeTint(scene: PlaySceneContext, deltaMs: number): void {
  installTimeTintLayer(scene);
  const project = store.getCurrent();
  const system = resolveTimeSystem(project);
  if (!system || !scene.session.gameTime) {
    hideTimeTint(scene);
    return;
  }
  const phase = timePhaseFor(scene.session.gameTime);
  if (!phase) {
    hideTimeTint(scene);
    return;
  }
  const target = timeTintVisualForPhase(phase);
  const current = scene.timeTintDisplayed ?? target;
  if (scene.timeTintPhase !== phase) {
    scene.timeTintPhase = phase;
    scene.timeTintTransition = {
      from: current,
      to: target,
      elapsedMs: 0,
      durationMs: TIME_TINT_TRANSITION_MS,
    };
  }
  const transition = scene.timeTintTransition;
  if (transition) {
    transition.elapsedMs = Math.min(transition.durationMs, transition.elapsedMs + Math.max(0, deltaMs));
    const progress = transition.durationMs === 0 ? 1 : transition.elapsedMs / transition.durationMs;
    scene.timeTintDisplayed = interpolateTint(transition.from, transition.to, progress);
    if (progress >= 1) {
      scene.timeTintDisplayed = transition.to;
      scene.timeTintTransition = null;
    }
  } else {
    scene.timeTintDisplayed = target;
  }
  syncTimeTintLayer(scene);
}

export async function sleepUntilMorningScene(
  scene: PlaySceneContext,
  runDayEndCommands: (commands: readonly Command[]) => Promise<void>
): Promise<boolean> {
  const project = store.getCurrent();
  const system = resolveTimeSystem(project);
  if (!system) return false;
  scene.session.gameTime ??= initialGameTime(system);
  if (!scene.session.gameTime || scene.timeSleepInProgress) return false;
  scene.timeSleepInProgress = true;
  try {
    const sourceDayKey = calendarDayKey(scene.session.gameTime);
    const preflight = transitionToNextDay(project, structuredClone(scene.session), sourceDayKey);
    if (!preflight.ok) {
      showDayTransitionFailure(scene, preflight.reason);
      return false;
    }
    await fadeCamera(scene, "out", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
    const beforeHook = structuredClone(scene.session);
    const hook = system.onDayEnd ? project.commonEvents.find((event) => event.id === system.onDayEnd) : undefined;
    try {
      if (hook?.commands.length) await runDayEndCommands(hook.commands);
      const transition = transitionToNextDay(project, scene.session, sourceDayKey);
      if (!transition.ok) {
        await recoverFailedSleep(scene, beforeHook, transition.reason);
        return false;
      }
    } catch (cause) {
      const detail = cause instanceof Error && cause.message ? `:${cause.message}` : "";
      await recoverFailedSleep(scene, beforeHook, `day-end-hook${detail}`);
      return false;
    }
    scene.clearRuntimeOverlay("day-transition-error");
    // 커서 산술이 하루치 틱을 만들어 준다. 여기서 advanceFarmPlotsForDay 를 또 부르면 이중 계산이다.
    scene.timeFixedAccumulatorMs = 0;
    scene.timeMinuteAccumulator = 0;
    scene.refreshRuntimeSurfaces();
    scene.syncRuntimeState();
    await fadeCamera(scene, "in", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
    return true;
  } finally {
    scene.timeSleepInProgress = false;
  }
}

export async function applyAdvanceTimeStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "advanceTime" }>
): Promise<void> {
  const project = store.getCurrent();
  const system = resolveTimeSystem(project);
  if (!system) return;
  scene.session.gameTime ??= initialGameTime(system);
  if (!scene.session.gameTime) return;
  const days = Math.max(0, Math.trunc(step.days ?? 0));
  for (let index = 0; index < days; index += 1) {
    if (!await scene.sleepUntilMorning()) throw new Error("Day transition failed during authored day advance");
  }
  const minutes = Math.max(0, Math.trunc(step.minutes ?? 0));
  if (minutes <= 0) return;
  if (system.forceSleep && minutesUntilDayEnd(scene.session.gameTime, system) <= minutes) {
    if (!await scene.sleepUntilMorning()) throw new Error("Day transition failed during forced sleep");
    return;
  }
  const advanced = advanceTimeAcrossDayBoundaries(project, scene.session, minutes);
  if (!advanced.ok) {
    showDayTransitionFailure(scene, advanced.reason);
    throw new Error(`Day transition failed: ${advanced.reason}`);
  }
  scene.clearRuntimeOverlay("day-transition-error");
  scene.syncRuntimeState();
}

export function applySetTimeStep(scene: PlaySceneContext, step: Extract<StepResult, { kind: "setTime" }>): void {
  const system = resolveTimeSystem(store.getCurrent());
  if (!system) return;
  scene.session.gameTime ??= initialGameTime(system);
  if (!scene.session.gameTime) return;
  scene.session.gameTime = setGameTimeClock(scene.session.gameTime, step.hour, step.minute, system);
  scene.syncRuntimeState();
}

export function observeScheduledTimeTransition(
  scene: Pick<PlaySceneContext, "showRuntimeOverlay">,
  task: Promise<boolean | void>,
  reason: "forced-sleep" | "scheduled-sleep" | "scheduled-advance",
): Promise<boolean> {
  return task.then((result) => {
    if (result === false) {
      showDayTransitionFailure(scene, reason);
      return false;
    }
    return true;
  }).catch((cause: unknown) => {
    const detail = cause instanceof Error && cause.message ? `:${cause.message}` : "";
    showDayTransitionFailure(scene, `${reason}${detail}`);
    return false;
  });
}

export function isGameTimePausedForRuntime(scene: Pick<PlaySceneContext, "game" | "session" | "timeSleepInProgress">): boolean {
  if (scene.timeSleepInProgress) return true;
  if (isCutsceneInputLocked(scene.session)) return true;
  const root = scene.game.canvas.parentElement?.closest(".play-stage") ?? scene.game.canvas.ownerDocument;
  return root.querySelector("[data-testid='main-menu'], [data-testid='battle-scene'], [data-testid='ending-screen'], [data-testid='game-over-screen']") !== null;
}

function hideTimeTint(scene: PlaySceneContext): void {
  scene.timeTintGraphics?.clear();
  scene.timeTintGraphics?.setVisible(false);
  scene.timeTintPhase = undefined;
  scene.timeTintTransition = null;
}

function syncTimeTintLayer(scene: PlaySceneContext): void {
  const graphics = scene.timeTintGraphics;
  const tint = scene.timeTintDisplayed;
  if (!graphics || !tint) return;
  graphics.clear();
  if (tint.alpha <= 0) {
    graphics.setVisible(false);
    return;
  }
  const camera = scene.cameras.main;
  graphics.setVisible(true);
  graphics.fillStyle(tint.color, tint.alpha);
  graphics.fillRect(0, 0, camera.width || PLAY_RESOLUTION.width, camera.height || PLAY_RESOLUTION.height);
}

export function timeTintVisualForPhase(phase: TimePhase): TimeTintVisual {
  switch (phase) {
    case "morning":
      return { color: 0xffd37a, alpha: 0.08 };
    case "day":
      return { color: 0xffffff, alpha: 0 };
    case "evening":
      return { color: 0xff8a3d, alpha: 0.16 };
    case "night":
      return { color: 0x09142f, alpha: 0.34 };
  }
}

function interpolateTint(from: TimeTintVisual, to: TimeTintVisual, progress: number): TimeTintVisual {
  const t = Math.max(0, Math.min(1, progress));
  return {
    color: interpolateColor(from.color, to.color, t),
    alpha: from.alpha + (to.alpha - from.alpha) * t,
  };
}

function interpolateColor(from: number, to: number, progress: number): number {
  const fr = (from >> 16) & 255;
  const fg = (from >> 8) & 255;
  const fb = from & 255;
  const tr = (to >> 16) & 255;
  const tg = (to >> 8) & 255;
  const tb = to & 255;
  const r = Math.round(fr + (tr - fr) * progress);
  const g = Math.round(fg + (tg - fg) * progress);
  const b = Math.round(fb + (tb - fb) * progress);
  return (r << 16) | (g << 8) | b;
}

function showDayTransitionFailure(scene: Pick<PlaySceneContext, "showRuntimeOverlay">, reason: string): void {
  scene.showRuntimeOverlay("day-transition-error", `새날 처리를 완료하지 못했습니다 (${reason})`);
}

async function recoverFailedSleep(
  scene: PlaySceneContext,
  beforeHook: PlaySceneContext["session"],
  reason: string,
): Promise<void> {
  restoreSession(scene.session, beforeHook);
  showDayTransitionFailure(scene, reason);
  scene.refreshRuntimeSurfaces();
  scene.syncRuntimeState();
  await fadeCamera(scene, "in", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
}

function restoreSession(target: PlaySceneContext["session"], source: PlaySceneContext["session"]): void {
  for (const key of Object.keys(target)) Reflect.deleteProperty(target, key);
  Object.assign(target, source);
}
