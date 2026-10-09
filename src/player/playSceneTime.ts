import {
  calendarDayKey,
  initialGameTime,
  minutesUntilDayEnd,
  resolveTimeSystem,
  timePhaseFor,
  type TimePhase,
} from "@/project/gameTime";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { StepResult } from "@/player/interpreter";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import {
  advanceTimeAcrossDayBoundaries,
  setTimeWithMakers,
  transitionToNextDay,
  type DayTransitionResult,
} from "@/player/dayTransition";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { hasSessionLifeRecoveryClaims } from "@/player/lifeLedger";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { fadeCamera, TRANSFER_FADE_DURATION_MS } from "@/player/playSceneMapCommands";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import type { PlaySession } from "@/project/session";

export type DayTransitionFailureView = {
  readonly reason: string;
  readonly stage?: string;
  readonly problemId?: string;
  readonly recoveryEntry?: string;
};

/** Scene surface required to present date-error UI (no silent Partial/catch fallback). */
export type DayTransitionFailureScene = {
  readonly showRuntimeOverlay: PlaySceneContext["showRuntimeOverlay"];
  readonly game: PlaySceneContext["game"];
  readonly session?: PlaySession;
};

export function formatDayTransitionFailureMessage(view: DayTransitionFailureView): string {
  const parts = [view.reason];
  if (view.stage) parts.push(`stage:${view.stage}`);
  if (view.problemId) parts.push(`problem:${view.problemId}`);
  if (view.recoveryEntry) parts.push(`recovery:${view.recoveryEntry}`);
  return `새날 처리를 완료하지 못했습니다 (${parts.join(" ")})`;
}

function dayTransitionFailureFromResult(
  result: Extract<DayTransitionResult, { ok: false }> | {
    readonly reason: string;
    readonly stage?: string;
    readonly sourceKind?: string;
    readonly sourceId?: string;
  },
): DayTransitionFailureView {
  const problemId = result.sourceKind && result.sourceId
    ? `${result.sourceKind}/${result.sourceId}`
    : result.sourceKind ?? result.sourceId;
  return {
    reason: result.reason,
    ...(result.stage ? { stage: result.stage } : {}),
    ...(problemId ? { problemId } : {}),
    recoveryEntry: "life-ledger:recovery",
  };
}

function resolveDialogueHost(scene: DayTransitionFailureScene): HTMLElement | undefined {
  // Browser/runtime contract only. Non-DOM unit hosts skip the rich overlay path.
  if (typeof HTMLElement === "undefined") return undefined;
  return dialogueHost(scene as unknown as import("phaser").Scene);
}

function resolveOpenLifeRecoveryLedger(scene: DayTransitionFailureScene): (() => void) | undefined {
  const registry = scene.game.registry;
  if (!registry || typeof registry.get !== "function") return undefined;
  const open = registry.get("openLifeRecoveryLedger");
  return typeof open === "function" ? () => { open(); } : undefined;
}

type DayTransitionErrorOverlay = HTMLElement & { __oprnDisposeCursor?: () => void };

/** Drop owned cursor listeners before removing the date-error overlay. */
export function disposeDayTransitionErrorOverlay(host: HTMLElement | undefined | null): void {
  if (!host) return;
  const overlay = host.querySelector("[data-testid='day-transition-error']") as DayTransitionErrorOverlay | null;
  if (!overlay) return;
  overlay.__oprnDisposeCursor?.();
  overlay.__oprnDisposeCursor = undefined;
  overlay.remove();
}

/** Installs stage/problem markers; recovery entry is actionable only when claims exist and menu open is registered. */
export function presentDayTransitionFailure(
  scene: DayTransitionFailureScene,
  failure: string | DayTransitionFailureView,
): void {
  const view: DayTransitionFailureView = typeof failure === "string"
    ? { reason: failure, recoveryEntry: "life-ledger:recovery" }
    : { recoveryEntry: "life-ledger:recovery", ...failure };
  const message = formatDayTransitionFailureMessage(view);
  const host = resolveDialogueHost(scene);
  if (!host) {
    scene.showRuntimeOverlay("day-transition-error", message);
    return;
  }

  // Replace any prior date-error UI and release its cursor ownership first.
  disposeDayTransitionErrorOverlay(host);

  const overlay = document.createElement("div") as DayTransitionErrorOverlay;
  overlay.className = "runtime-overlay";
  overlay.dataset.testid = "day-transition-error";
  if (view.stage) overlay.dataset.stage = view.stage;
  if (view.problemId) overlay.dataset.problemId = view.problemId;
  overlay.dataset.recoveryEntry = view.recoveryEntry ?? "life-ledger:recovery";

  const body = document.createElement("div");
  body.className = "runtime-overlay-message";
  body.textContent = message;
  overlay.append(body);

  const hasClaims = scene.session ? hasSessionLifeRecoveryClaims(scene.session) : false;
  const openLedger = resolveOpenLifeRecoveryLedger(scene);
  const actionable = hasClaims && openLedger !== undefined;
  overlay.dataset.recoveryActionable = actionable ? "true" : "false";

  if (actionable && openLedger) {
    const entry = document.createElement("button");
    entry.type = "button";
    entry.dataset.testid = "day-transition-recovery-entry";
    entry.dataset.recoveryEntry = view.recoveryEntry ?? "life-ledger:recovery";
    entry.dataset.recoveryActionable = "true";
    entry.textContent = "복구 장부";

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.dataset.testid = "day-transition-error-dismiss";
    dismiss.textContent = "닫기";

    const release = (): void => {
      overlay.__oprnDisposeCursor?.();
      overlay.__oprnDisposeCursor = undefined;
      if (overlay.isConnected) overlay.remove();
    };

    entry.addEventListener("click", () => {
      release();
      openLedger();
    });
    dismiss.addEventListener("click", () => {
      release();
    });

    overlay.append(entry, dismiss);
    host.append(overlay);
    // Keyboard: confirm opens ledger once; cancel dismisses without reopening. Disposer retained.
    const disposeCursor = attachCursorMenu(overlay, { items: [entry], cancelEl: dismiss });
    overlay.__oprnDisposeCursor = disposeCursor;
    return;
  }

  host.append(overlay);
}

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

  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  scene.timeFixedAccumulatorMs += deltaMs;
  const steps = Math.floor(scene.timeFixedAccumulatorMs / TIME_FIXED_STEP_MS);
  if (steps === 0) return;
  scene.timeFixedAccumulatorMs -= steps * TIME_FIXED_STEP_MS;
  const minuteCarry = scene.timeMinuteAccumulator;
  scene.timeMinuteAccumulator += steps * system.minutesPerRealSecond;
  const wholeMinutes = Math.floor(scene.timeMinuteAccumulator);
  if (wholeMinutes <= 0) return;
  scene.timeMinuteAccumulator -= wholeMinutes;
  const untilEnd = minutesUntilDayEnd(scene.session.gameTime, system);
  if (system.forceSleep && untilEnd <= wholeMinutes) {
    const before = structuredClone(scene.session);
    // Preserve the last completed fixed step seen by onDayEnd, not the start of a large frame.
    const priorSteps = Math.max(0, Math.ceil((untilEnd - minuteCarry) / system.minutesPerRealSecond) - 1);
    const priorMinutes = Math.floor(minuteCarry + priorSteps * system.minutesPerRealSecond);
    const advanced = advanceTimeAcrossDayBoundaries(project, scene.session, priorMinutes);
    if (!advanced.ok) {
      scene.timeFixedAccumulatorMs = 0;
      scene.timeMinuteAccumulator = 0;
      showDayTransitionFailure(scene, dayTransitionFailureFromResult(advanced));
      return;
    }
    const rollback = (): void => {
      restoreSession(scene.session, before);
      scene.refreshRuntimeSurfaces();
      scene.syncRuntimeState();
    };
    observeScheduledTimeTransition(scene, (onFailurePresented) => scene.sleepUntilMorning(onFailurePresented).then((ok) => {
      if (!ok) rollback();
      return ok;
    }, (error: unknown) => { rollback(); throw error; }), "forced-sleep");
    return;
  }
  // One frame is one transaction, including all crossed days and residual minutes.
  const advanced = advanceTimeAcrossDayBoundaries(project, scene.session, wholeMinutes);
  if (!advanced.ok) {
    scene.timeFixedAccumulatorMs = 0;
    scene.timeMinuteAccumulator = 0;
    showDayTransitionFailure(scene, dayTransitionFailureFromResult(advanced));
    return;
  }
  scene.clearRuntimeOverlay("day-transition-error");
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
  runDayEndCommands: (commands: readonly Command[]) => Promise<void>,
  onFailurePresented?: () => void,
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
      showDayTransitionFailure(scene, dayTransitionFailureFromResult(preflight), onFailurePresented);
      return false;
    }
    await fadeCamera(scene, "out", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
    const beforeHook = structuredClone(scene.session);
    const hook = system.onDayEnd ? project.commonEvents.find((event) => event.id === system.onDayEnd) : undefined;
    try {
      if (hook?.commands.length) await runDayEndCommands(hook.commands);
      const transition = transitionToNextDay(project, scene.session, sourceDayKey);
      if (!transition.ok) {
        await recoverFailedSleep(scene, beforeHook, dayTransitionFailureFromResult(transition), onFailurePresented);
        return false;
      }
    } catch (cause) {
      const detail = cause instanceof Error && cause.message ? `:${cause.message}` : "";
      await recoverFailedSleep(scene, beforeHook, `day-end-hook${detail}`, onFailurePresented);
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
  step: Extract<StepResult, { kind: "advanceTime" }>,
  onFailurePresented?: () => void,
): Promise<void> {
  const project = store.getCurrent();
  const system = resolveTimeSystem(project);
  if (!system) return;
  scene.session.gameTime ??= initialGameTime(system);
  if (!scene.session.gameTime) return;
  if (![step.days ?? 0, step.minutes ?? 0].every(Number.isFinite)) throw new Error("Invalid time advance");
  const before = structuredClone(scene.session);
  try {
    const days = Math.max(0, Math.trunc(step.days ?? 0));
    for (let index = 0; index < days; index += 1) {
      if (!await scene.sleepUntilMorning(onFailurePresented)) throw new Error("Day transition failed during authored day advance");
    }
    const minutes = Math.max(0, Math.trunc(step.minutes ?? 0));
    if (minutes <= 0) return;
    if (system.forceSleep && minutesUntilDayEnd(scene.session.gameTime, system) <= minutes) {
      if (!await scene.sleepUntilMorning(onFailurePresented)) throw new Error("Day transition failed during forced sleep");
      return;
    }
    const advanced = advanceTimeAcrossDayBoundaries(project, scene.session, minutes);
    if (!advanced.ok) {
      showDayTransitionFailure(scene, dayTransitionFailureFromResult(advanced), onFailurePresented);
      throw new Error(`Day transition failed: ${advanced.reason}`);
    }
    scene.clearRuntimeOverlay("day-transition-error");
    scene.syncRuntimeState();
  } catch (error) {
    restoreSession(scene.session, before);
    scene.refreshRuntimeSurfaces();
    scene.syncRuntimeState();
    throw error;
  }
}

export function applySetTimeStep(scene: PlaySceneContext, step: Extract<StepResult, { kind: "setTime" }>): void {
  const project = store.getCurrent();
  const system = resolveTimeSystem(project);
  if (!system) return;
  scene.session.gameTime ??= initialGameTime(system);
  const changed = setTimeWithMakers(project, scene.session, step);
  if (!changed.ok) {
    showDayTransitionFailure(scene, changed.reason);
    throw new Error(`Clock change failed: ${changed.reason}`);
  }
  scene.clearRuntimeOverlay("day-transition-error");
  scene.syncRuntimeState();
}

export async function observeScheduledTimeTransition(
  scene: DayTransitionFailureScene,
  task: (onFailurePresented: () => void) => Promise<boolean | void>,
  reason: "forced-sleep" | "scheduled-sleep" | "scheduled-advance",
): Promise<boolean> {
  // Acknowledgement belongs to this operation, not the scene's possibly stale or
  // overlapping overlay. Create it before starting even synchronously failing work.
  let failurePresented = false;
  try {
    const result = await task(() => { failurePresented = true; });
    if (result === false) {
      if (!failurePresented) showDayTransitionFailure(scene, reason);
      return false;
    }
    return true;
  } catch (cause: unknown) {
    const detail = cause instanceof Error && cause.message ? `:${cause.message}` : "";
    if (!failurePresented) showDayTransitionFailure(scene, `${reason}${detail}`);
    return false;
  }
}

export function isGameTimePausedForRuntime(scene: Pick<PlaySceneContext, "game" | "session" | "timeSleepInProgress">): boolean {
  if (scene.timeSleepInProgress) return true;
  if (isCutsceneInputLocked(scene.session)) return true;
  const root = scene.game.canvas.parentElement?.closest(".play-stage") ?? scene.game.canvas.ownerDocument;
  return root.querySelector("[data-testid='main-menu'], [data-testid='world-atlas'], [data-testid='battle-scene'], [data-testid='ending-screen'], [data-testid='game-over-screen']") !== null;
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

function showDayTransitionFailure(
  scene: DayTransitionFailureScene,
  failure: string | DayTransitionFailureView,
  onFailurePresented?: () => void,
): void {
  presentDayTransitionFailure(scene, failure);
  onFailurePresented?.();
}

async function recoverFailedSleep(
  scene: PlaySceneContext,
  beforeHook: PlaySceneContext["session"],
  failure: string | DayTransitionFailureView,
  onFailurePresented?: () => void,
): Promise<void> {
  restoreSession(scene.session, beforeHook);
  showDayTransitionFailure(scene, failure, onFailurePresented);
  scene.refreshRuntimeSurfaces();
  scene.syncRuntimeState();
  await fadeCamera(scene, "in", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
}

function restoreSession(target: PlaySceneContext["session"], source: PlaySceneContext["session"]): void {
  for (const key of Object.keys(target)) Reflect.deleteProperty(target, key);
  Object.assign(target, source);
}
