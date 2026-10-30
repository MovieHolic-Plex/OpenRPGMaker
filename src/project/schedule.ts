/**
 * 주간 일정표(G4). 데이터 = `project.database.schedules`, 상태 = `session.schedulePlans/scheduleUses/scheduleRun`.
 *
 * - `planSchedule` : 슬롯마다 활동을 고르는 오버레이. 고른 활동 id 목록을 `schedulePlans[scheduleId]` 에 저장한다.
 * - `runSchedule`  : 저장된 계획을 슬롯 순서대로 실행한다. 활동의 공용 이벤트를 부르고 사용 횟수를 올린다.
 *
 * 없음 = 기존 JSON 바이트 동일: `schedules` 가 없으면 정규화도 직렬화도 아무것도 더하지 않는다.
 */
import type { Condition } from "./types/events";
import type {
  ProjectDatabaseRecords,
  ScheduleActivityIcon,
  ScheduleActivityRecord,
  ScheduleRecord,
  ScheduleSlotRecord,
} from "./types/database";

export const SCHEDULE_SLOT_LIMIT = 14;
export const SCHEDULE_ACTIVITY_LIMIT = 40;
export const SCHEDULE_RECORD_LIMIT = 40;
export const SCHEDULE_MAX_USES_LIMIT = 9999;

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeIcon(value: unknown): ScheduleActivityIcon | undefined {
  if (!value || typeof value !== "object") return undefined;
  const icon = value as { kind?: unknown; itemId?: unknown; tilesetId?: unknown; tileId?: unknown };
  if (icon.kind === "item") {
    const itemId = cleanText(icon.itemId);
    return itemId ? { kind: "item", itemId } : undefined;
  }
  if (icon.kind === "tile") {
    const tilesetId = cleanText(icon.tilesetId);
    if (!tilesetId || typeof icon.tileId !== "number" || !Number.isInteger(icon.tileId) || icon.tileId < 0) return undefined;
    return { kind: "tile", tilesetId, tileId: icon.tileId };
  }
  return undefined;
}

function normalizeActivity(raw: ScheduleActivityRecord): ScheduleActivityRecord {
  const hint = cleanText(raw.hint);
  const icon = normalizeIcon(raw.icon);
  const maxUses = typeof raw.maxUses === "number" && Number.isFinite(raw.maxUses)
    ? Math.min(SCHEDULE_MAX_USES_LIMIT, Math.max(1, Math.floor(raw.maxUses)))
    : undefined;
  return {
    id: cleanText(raw.id),
    label: cleanText(raw.label),
    description: cleanText(raw.description),
    ...(hint ? { hint } : {}),
    ...(icon ? { icon } : {}),
    ...(raw.condition ? { condition: raw.condition as Condition } : {}),
    ...(maxUses !== undefined ? { maxUses } : {}),
    commonEventId: cleanText(raw.commonEventId),
  };
}

export function normalizeScheduleRecord(raw: ScheduleRecord): ScheduleRecord {
  const slots: ScheduleSlotRecord[] = (Array.isArray(raw.slots) ? raw.slots : [])
    .slice(0, SCHEDULE_SLOT_LIMIT)
    .map((slot, index) => ({ label: cleanText(slot?.label) || `${index + 1}` }));
  const activities = (Array.isArray(raw.activities) ? raw.activities : [])
    .slice(0, SCHEDULE_ACTIVITY_LIMIT)
    .map(normalizeActivity);
  return { id: cleanText(raw.id), title: cleanText(raw.title) || cleanText(raw.id), slots, activities };
}

export function normalizeScheduleRecords(rows: readonly ScheduleRecord[]): ScheduleRecord[] {
  return rows.map(normalizeScheduleRecord);
}

export function findSchedule(
  database: Pick<ProjectDatabaseRecords, "schedules"> | undefined,
  scheduleId: string,
): ScheduleRecord | undefined {
  return database?.schedules?.find((row) => row.id === scheduleId);
}

/** `slotCount` 가 있으면 그만큼만, 없으면 일정표의 모든 슬롯. 슬롯 정의보다 크면 정의 수로 자른다. */
export function effectiveSlotCount(schedule: ScheduleRecord, slotCount?: number): number {
  const total = schedule.slots.length;
  if (typeof slotCount !== "number" || !Number.isFinite(slotCount)) return total;
  return Math.max(0, Math.min(total, Math.floor(slotCount)));
}

/** 사용 횟수 키 = `scheduleId` → `activityId` → 횟수. */
export type ScheduleUses = Record<string, Record<string, number>>;
export type SchedulePlans = Record<string, string[]>;
export interface ScheduleRunState {
  scheduleId: string;
  /** 다음에 실행할 슬롯(0 기준). */
  index: number;
  /** 시작할 때 고정한 `runSchedule.slotVariableId`. */
  slotVariableId?: string;
}

export function activityUseCount(uses: ScheduleUses | undefined, scheduleId: string, activityId: string): number {
  return uses?.[scheduleId]?.[activityId] ?? 0;
}

export function isActivityExhausted(
  activity: Pick<ScheduleActivityRecord, "id" | "maxUses">,
  uses: ScheduleUses | undefined,
  scheduleId: string,
): boolean {
  return activity.maxUses !== undefined && activityUseCount(uses, scheduleId, activity.id) >= activity.maxUses;
}
