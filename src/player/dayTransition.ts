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
  | {
      readonly ok: false;
      readonly reason: "disabled" | "missing-time" | "invalid-time" | "invalid-minutes" | "transition-failed";
      readonly stage?: DayTransitionStage;
      readonly sourceKind?: string;
      readonly sourceId?: string;
    };

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
  // 같은 날 안에서 시계만 흐르는 경우(자연 시계의 거의 모든 틱)는 세션 전체 복제·생활 상태 재조정을
  // 건너뛴다. 실측 없이도 비용 구조는 명확하다 — reconcileLifeState 는 structuredClone(session)
  // 에 공간 배치·동물 검증까지 돌리고, 자연 시계는 이것을 **1초마다** 부른다. 날짜 경계를 넘지
  // 않으면 바뀌는 것은 시각과 제작기 상태뿐이라, 그 둘만 초안으로 계산해 원자적으로 커밋한다.
  if (minutes < minutesUntilDayEnd(session.gameTime, system)) {
    const fast = advanceClockWithinDay(project, session, minutes, system);
    if (fast) return fast;
  }
  let draft: PlaySession;
  try { draft = reconcileLifeState(project, session); }
  catch (error) {
    if (!(error instanceof LifeReconciliationError)) throw error;
    return {
      ok: false,
      reason: "transition-failed",
      stage: "recovery",
      sourceKind: error.sourceKind,
      sourceId: error.sourceId,
    };
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
    if (!transition.ok) {
      return {
        ok: false,
        reason: "transition-failed",
        stage: transition.stage,
        sourceKind: transition.sourceKind,
        sourceId: transition.sourceId,
      };
    }
    receipts.push(transition.receipt);
    remaining -= untilBoundary;
  }
  const makers = syncMakersToGameTime(project, draft);
  if (!makers.ok && makers.reason !== "disabled") {
    return { ok: false, reason: "transition-failed", stage: "makers" };
  }
  replaceSession(session, draft);
  return { ok: true, time: structuredClone(draft.gameTime!), receipts };
}

/**
 * 날짜 경계를 넘지 않는 시계 전진. 제작기 인스턴스 사전만 얕게 복제해 초안으로 쓴다. 제작기 검증이
 * 실패하면 라이브 세션을 건드리지 않고 null 을 내서 재조정을 거치는 원래 경로로 넘긴다 — 저장에서
 * 온 옛 형태를 재조정이 격리해 주는 경우까지 결과가 예전과 같다.
 */
function advanceClockWithinDay(
  project: Project,
  session: PlaySession,
  minutes: number,
  system: NonNullable<ReturnType<typeof resolveTimeSystem>>,
): AdvanceTimeAcrossDayBoundariesResult | null {
  const time = advanceGameTime(session.gameTime!, minutes, system).time;
  // 재조정이 시계 틱에서 실제로 하는 일은 사라진 정의·바뀐 시간 기준의 제작 작업을 회수함으로
  // 옮기는 것이다(lifeStateReconciliation §makerInstances). 그런 작업이 하나라도 있으면 빠른 경로를
  // 포기한다. 나머지 재조정 대상(배송·꾸러미·배치·동물)은 저장 경계와 날짜 경계에서만 바뀐다.
  if (!makerJobsCurrent(project, session)) return null;
  const makerInstances = session.makerInstances ? { ...session.makerInstances } : undefined;
  const draft = { gameTime: time, makerInstances } as PlaySession;
  const makers = syncMakersToGameTime(project, draft);
  if (!makers.ok && makers.reason !== "disabled") return null;
  session.gameTime = time;
  if (makers.ok && makers.readyInstanceIds.length > 0) session.makerInstances = makerInstances!;
  return { ok: true, time: structuredClone(time), receipts: [] };
}

function makerJobsCurrent(project: Project, session: PlaySession): boolean {
  const jobs = session.makerInstances;
  if (!jobs) return true;
  const time = resolveTimeSystem(project);
  for (const job of Object.values(jobs)) {
    if (!project.system.makers?.some((maker) => maker.id === job.makerId)) return false;
    const basis = job.contract?.timeBasis;
    if (basis && (!time || basis.dayStartHour !== time.dayStartHour || basis.dayEndHour !== time.dayEndHour
      || basis.daysPerSeason !== time.daysPerSeason)) return false;
  }
  return true;
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
