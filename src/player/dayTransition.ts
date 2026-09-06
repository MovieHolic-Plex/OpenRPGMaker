import { LifeReconciliationError, reconcileLifeState } from "@/project/lifeRecovery";
import { restoreEnergy, type EnergyChangeResult } from "@/project/energy";
import {
  advanceGameTime,
  calendarDayKey,
  minutesUntilDayEnd,
  resolveTimeSystem,
  setGameTimeClock,
  sleepGameTimeUntilMorning,
  type GameTime,
} from "@/project/gameTime";
import { syncMakersToGameTime, type MakerAdvanceResult } from "@/project/makers";
import type { PlaySession } from "@/project/session";
import { settleShipping, type ShippingSettlementResult } from "@/project/shipping";
import { applyDailyWeatherForDate } from "@/project/dailyWeather";
import { advanceFarmAnimalProduction, type FarmAnimalAdvanceResult } from "@/project/farmAnimals";
import type { DailyWeatherState } from "@/project/session";
import type { Project } from "@/project/types";
import { syncFarmPlotsToDate } from "@/player/farming";
import { waterFarmPlotsForDailyWeather } from "@/player/farmingWeather";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { weatherToRuntimeString } from "@/player/weather/weatherModel";
import { advanceSeasonalForage, type ForageAdvanceResult } from "@/project/seasonalForage";
import { isGameTime } from "@/player/saveSlotValidation";

export const DAY_TRANSITION_STAGES = ["recovery", "shipping", "calendar", "dailyWeather", "rainWatering", "farm", "forage", "energy", "makers", "animals"] as const;
export type DayTransitionStage = (typeof DAY_TRANSITION_STAGES)[number];

export type DayTransitionReceipt = {
  readonly sourceDayKey: string;
  readonly destinationDayKey: string;
  readonly stages: readonly DayTransitionStage[];
  readonly shipping: ShippingSettlementResult;
  readonly weather?: DailyWeatherState;
  readonly wateredPlots: number;
  readonly forage: ForageAdvanceResult;
  readonly energy: EnergyChangeResult;
  readonly makers: MakerAdvanceResult;
  readonly animals: FarmAnimalAdvanceResult;
};

export type DayTransitionResult =
  | { readonly ok: true; readonly receipt: DayTransitionReceipt }
  | {
      readonly ok: false;
      readonly reason: "disabled" | "missing-time" | "invalid-time" | "stale-day-key" | "already-transitioned" | "recovery" | "shipping" | "forage" | "energy" | "makers" | "animals";
      readonly stage?: DayTransitionStage;
      readonly sourceKind?: string;
      readonly sourceId?: string;
    };

export type AdvanceTimeAcrossDayBoundariesResult =
  | { readonly ok: true; readonly time: GameTime; readonly receipts: readonly DayTransitionReceipt[] }
  | { readonly ok: false; readonly reason: "disabled" | "missing-time" | "invalid-time" | "invalid-minutes" | "transition-failed" };

/** Advances ordinary clock minutes while delegating every crossed boundary to transitionToNextDay. */
export function advanceTimeAcrossDayBoundaries(
  project: Project,
  session: PlaySession,
  minutes: number,
): AdvanceTimeAcrossDayBoundariesResult {
  const system = resolveTimeSystem(project);
  if (!system) return { ok: false, reason: "disabled" };
  if (!session.gameTime) return { ok: false, reason: "missing-time" };
  if (!Number.isSafeInteger(minutes) || minutes < 0) return { ok: false, reason: "invalid-minutes" };

  if (minutes === 0) return { ok: true, time: session.gameTime, receipts: [] };
  if (!isGameTime(session.gameTime)) return { ok: false, reason: "invalid-time" };
  let draft: PlaySession;
  try { draft = reconcileLifeState(project, session); }
  catch (error) {
    if (!(error instanceof LifeReconciliationError)) throw error;
    return { ok: false, reason: "transition-failed" };
  }
  const receipts: DayTransitionReceipt[] = [];
  let remaining = minutes;
  while (remaining > 0) {
    const untilBoundary = minutesUntilDayEnd(draft.gameTime!, system);
    if (remaining < untilBoundary) {
      draft.gameTime = advanceGameTime(draft.gameTime!, remaining, system).time;
      remaining = 0;
      break;
    }
    const sourceDayKey = calendarDayKey(draft.gameTime!);
    const transition = transitionToNextDay(project, draft, sourceDayKey);
    if (!transition.ok) return { ok: false, reason: "transition-failed" };
    receipts.push(transition.receipt);
    remaining -= untilBoundary;
  }
  const makers = syncMakersToGameTime(project, draft);
  if (!makers.ok && makers.reason !== "disabled") return { ok: false, reason: "transition-failed" };
  replaceSession(session, draft);
  return { ok: true, time: structuredClone(draft.gameTime!), receipts };
}

/** Set only the clock, preserving ready jobs and cancelling incompatible jobs at the prior clock. */
export function setTimeWithMakers(
  project: Project,
  session: PlaySession,
  clock: { readonly hour: number; readonly minute?: number },
): AdvanceTimeAcrossDayBoundariesResult {
  const system = resolveTimeSystem(project);
  if (!system) return { ok: false, reason: "disabled" };
  if (!session.gameTime) return { ok: false, reason: "missing-time" };
  if (!isGameTime(session.gameTime) || !Number.isFinite(clock.hour) || !Number.isFinite(clock.minute ?? 0)) {
    return { ok: false, reason: "invalid-time" };
  }
  let draft: PlaySession;
  try { draft = reconcileLifeState(project, session); }
  catch (error) {
    if (!(error instanceof LifeReconciliationError)) throw error;
    return { ok: false, reason: "transition-failed" };
  }
  draft.gameTime = setGameTimeClock(session.gameTime, clock.hour, clock.minute, system);
  const makers = syncMakersToGameTime(project, draft);
  if (!makers.ok && makers.reason !== "disabled") return { ok: false, reason: "transition-failed" };
  replaceSession(session, draft);
  return { ok: true, time: draft.gameTime, receipts: [] };
}

/**
 * Advances one authored day as a transaction. Every stage runs on a draft and
 * the live session is replaced only after the final maker validation succeeds.
 */
export function transitionToNextDay(
  project: Project,
  session: PlaySession,
  sourceDayKey: string,
): DayTransitionResult {
  const system = resolveTimeSystem(project);
  if (!system) return { ok: false, reason: "disabled" };
  if (!session.gameTime) return { ok: false, reason: "missing-time" };
  if (!isGameTime(session.gameTime)) return { ok: false, reason: "invalid-time", stage: "calendar" };
  const normalizedSource = sourceDayKey.trim();
  if (session.dayTransitionLastDayKey === normalizedSource) {
    return { ok: false, reason: "already-transitioned" };
  }
  if (!normalizedSource || calendarDayKey(session.gameTime) !== normalizedSource) {
    return { ok: false, reason: "stale-day-key" };
  }

  let draft: PlaySession;
  try { draft = reconcileLifeState(project, session); }
  catch (error) {
    if (!(error instanceof LifeReconciliationError)) throw error;
    return { ok: false, reason: "recovery", stage: "recovery", sourceKind: error.sourceKind, sourceId: error.sourceId };
  }
  const shipping = settleShipping(project, draft, normalizedSource);
  if (!shipping.ok && shipping.reason !== "disabled" && shipping.reason !== "already-settled") {
    return { ok: false, reason: "shipping", stage: "shipping" };
  }

  draft.gameTime = sleepGameTimeUntilMorning(draft.gameTime!, system).time;
  if (!isGameTime(draft.gameTime)) return { ok: false, reason: "invalid-time", stage: "calendar" };
  const weather = applyDailyWeatherForDate(project, draft, draft.gameTime);
  if (weather) ensureM2Runtime(draft).screen.weather = weatherToRuntimeString(weather);
  else if (draft.m2Runtime) draft.m2Runtime.screen.weather = "none";
  const wateredPlots = waterFarmPlotsForDailyWeather(draft, draft.gameTime);
  syncFarmPlotsToDate(project, draft, system);

  const forage = advanceSeasonalForage(project, draft, draft.gameTime);
  if (!forage.ok && forage.reason !== "disabled" && forage.reason !== "already-advanced") {
    return { ok: false, reason: "forage", stage: "forage" };
  }

  const energy = restoreEnergy(project, draft, project.system.energy?.restorePerDay);
  if (!energy.ok && energy.reason !== "disabled") {
    return { ok: false, reason: "energy", stage: "energy" };
  }

  const makers = syncMakersToGameTime(project, draft);
  if (!makers.ok && makers.reason !== "disabled") {
    return { ok: false, reason: "makers", stage: "makers" };
  }

  const animals = advanceFarmAnimalProduction(project, draft, normalizedSource);
  if (!animals.ok && animals.reason !== "disabled") {
    return { ok: false, reason: "animals", stage: "animals" };
  }

  draft.dayTransitionLastDayKey = normalizedSource;
  replaceSession(session, draft);
  return {
    ok: true,
    receipt: {
      sourceDayKey: normalizedSource,
      destinationDayKey: calendarDayKey(draft.gameTime),
      stages: DAY_TRANSITION_STAGES,
      shipping,
      ...(weather ? { weather } : {}),
      wateredPlots,
      forage,
      energy,
      makers,
      animals,
    },
  };
}

function replaceSession(target: PlaySession, source: PlaySession): void {
  Object.assign(target, source);
}
