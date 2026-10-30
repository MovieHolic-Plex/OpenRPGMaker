// planSchedule / runSchedule 의 인터프리터 쪽 규칙(후보 산출·계획 검증·슬롯 진행).
// 정지(commandCatalog)·재개(resume)·맵 진입 재개(playSceneMapRuntime)가 같은 규칙을 써야 하므로 한 곳에 둔다.
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { Project } from "@/project/types";
import { evalCondition } from "@/project/session";
import {
  activityUseCount,
  effectiveSlotCount,
  findSchedule,
  type ScheduleRunState,
} from "@/project/schedule";
import type { ScheduleActivityIcon } from "@/project/types/database";

type PlanCommand = Extract<Command, { kind: "planSchedule" }>;
type RunCommand = Extract<Command, { kind: "runSchedule" }>;

/** 오버레이가 그리는 활동 카드. 조건이 거짓인 활동은 여기 오지 않는다(숨김). */
export interface SchedulePlanActivity {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly hint?: string;
  readonly icon?: ScheduleActivityIcon;
  /** `maxUses` 가 있을 때만: 아직 더 쓸 수 있는 횟수(0 이면 이미 소진 — 흐리게, 고를 수 없음). */
  readonly remaining?: number;
}

export interface SchedulePlanView {
  readonly scheduleId: string;
  readonly title: string;
  readonly slots: readonly string[];
  readonly activities: readonly SchedulePlanActivity[];
  /** 이전에 저장해 둔 계획 중 아직 유효한 것 — 오버레이를 이 선택으로 시작한다. */
  readonly initial: readonly string[];
}

/** 일정표를 풀어 오버레이용 뷰를 만든다. 일정표가 없거나 슬롯이 0개면 undefined(명령은 건너뛴다). */
export function buildSchedulePlanView(
  project: Project | undefined,
  session: PlaySessionLike,
  command: PlanCommand,
): SchedulePlanView | undefined {
  const schedule = findSchedule(project?.database, command.scheduleId);
  if (!schedule) return undefined;
  const slotTotal = effectiveSlotCount(schedule, command.slotCount);
  if (slotTotal <= 0) return undefined;
  const activities: SchedulePlanActivity[] = [];
  for (const activity of schedule.activities) {
    if (activity.condition && !evalCondition(session, activity.condition)) continue;
    const remaining = activity.maxUses === undefined
      ? undefined
      : Math.max(0, activity.maxUses - activityUseCount(session.scheduleUses, schedule.id, activity.id));
    activities.push({
      id: activity.id,
      label: activity.label,
      description: activity.description,
      ...(activity.hint ? { hint: activity.hint } : {}),
      ...(activity.icon ? { icon: activity.icon } : {}),
      ...(remaining !== undefined ? { remaining } : {}),
    });
  }
  const slots = schedule.slots.slice(0, slotTotal).map((slot) => slot.label);
  const view = { scheduleId: schedule.id, title: schedule.title, slots, activities, initial: [] as string[] };
  return { ...view, initial: sanitizeSchedulePicks(view, session.schedulePlans?.[schedule.id]) };
}

/** 고른 id 목록을 뷰 기준으로 거른다: 보이는 활동만, 슬롯 수까지, 남은 횟수를 넘기지 않는다. */
export function sanitizeSchedulePicks(
  view: Pick<SchedulePlanView, "slots" | "activities">,
  value: unknown,
): string[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map(view.activities.map((activity) => [activity.id, activity]));
  const picks: string[] = [];
  const taken = new Map<string, number>();
  for (const raw of value) {
    if (picks.length >= view.slots.length) break;
    if (typeof raw !== "string") continue;
    const activity = byId.get(raw);
    if (!activity) continue;
    const used = taken.get(raw) ?? 0;
    if (activity.remaining !== undefined && used >= activity.remaining) continue;
    taken.set(raw, used + 1);
    picks.push(raw);
  }
  return picks;
}

/** 오버레이 결과를 세션에 저장한다. 이 일정표의 진행 중이던 실행은 새 계획으로 처음부터. */
export function storeSchedulePlan(
  project: Project | undefined,
  session: PlaySessionLike,
  command: PlanCommand,
  value: unknown,
): void {
  const view = buildSchedulePlanView(project, session, command);
  if (!view) return;
  const picks = sanitizeSchedulePicks(view, value);
  session.schedulePlans = { ...(session.schedulePlans ?? {}), [view.scheduleId]: picks };
  if (session.scheduleRun?.scheduleId === view.scheduleId) delete session.scheduleRun;
}

/**
 * 다음에 실행할 슬롯의 공용 이벤트 id. 슬롯 변수·사용 횟수를 여기서 갱신하고 진행 위치를 1 올린다.
 * 더 실행할 슬롯이 없으면 `scheduleRun` 을 지우고 undefined.
 */
export function advanceScheduleRun(
  project: Project | undefined,
  session: PlaySessionLike,
  command: Pick<RunCommand, "scheduleId" | "slotVariableId">,
): string | undefined {
  let run: ScheduleRunState | undefined = session.scheduleRun;
  if (!run || run.scheduleId !== command.scheduleId) {
    run = {
      scheduleId: command.scheduleId,
      index: 0,
      ...(command.slotVariableId ? { slotVariableId: command.slotVariableId } : {}),
    };
    session.scheduleRun = run;
  }
  const schedule = findSchedule(project?.database, command.scheduleId);
  const plan = session.schedulePlans?.[command.scheduleId] ?? [];
  while (schedule && run.index < plan.length) {
    const slotNumber = run.index + 1;
    run.index += 1;
    const activity = schedule.activities.find((entry) => entry.id === plan[slotNumber - 1]);
    if (!activity) continue;
    if (run.slotVariableId) session.variables[run.slotVariableId] = slotNumber;
    const uses = (session.scheduleUses ??= {});
    const perSchedule = (uses[schedule.id] ??= {});
    perSchedule[activity.id] = (perSchedule[activity.id] ?? 0) + 1;
    return activity.commonEventId;
  }
  delete session.scheduleRun;
  return undefined;
}
