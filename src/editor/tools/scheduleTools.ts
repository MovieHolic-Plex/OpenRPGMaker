// editor/tools/scheduleTools.ts
// 주간 일정표(planSchedule / runSchedule 명령이 쓰는 database.schedules) 전용 도구 — list_schedules(읽기) · upsert_schedule(쓰기).
//
// 일정표 = 슬롯(월~일 같은 칸) + 활동 카드(고르면 공통 이벤트를 부른다). 한 번 호출로 표 전체를 교체/생성한다.
// 스키마는 고정 속성 + additionalProperties:false 만 쓴다(Gemini 가 열린 객체·빈 문자열 enum 을 400 으로 거절한다).

import {
  SCHEDULE_ACTIVITY_LIMIT,
  SCHEDULE_MAX_USES_LIMIT,
  SCHEDULE_RECORD_LIMIT,
  SCHEDULE_SLOT_LIMIT,
  normalizeScheduleRecord,
} from "@/project/schedule";
import type { Condition, Project, ScheduleActivityRecord, ScheduleRecord } from "@/project/types";
import { ToolError, type ToolDefinition } from "./types";

const VARIABLE_OPS = ["==", ">=", "<=", ">", "<", "!="] as const;
type VariableOp = (typeof VARIABLE_OPS)[number];

function summaryRow(record: ScheduleRecord) {
  return {
    id: record.id,
    title: record.title,
    slots: record.slots.map((slot) => slot.label),
    activities: record.activities.map((activity) => ({
      id: activity.id,
      label: activity.label,
      commonEventId: activity.commonEventId,
      ...(activity.maxUses !== undefined ? { maxUses: activity.maxUses } : {}),
      ...(activity.condition ? { condition: activity.condition.kind } : {}),
    })),
  };
}

const listSchedules: ToolDefinition = {
  name: "list_schedules",
  description:
    "주간 일정표(database.schedules) 목록: id·제목·슬롯 라벨·활동(id·이름·부르는 공통 이벤트). 「일정 계획」(planSchedule)·「일정 실행」(runSchedule) 명령에 넣을 scheduleId 를 확인할 때 쓴다.",
  mode: "read",
  domains: ["database"],
  parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  run(project) {
    const rows = (project.database.schedules ?? []).map(summaryRow);
    return { summary: rows.length ? `일정표 ${rows.length}개` : "일정표가 없습니다", data: { schedules: rows } };
  },
};

function readText(value: unknown, label: string, required: boolean): string {
  if (value === undefined || value === null) {
    if (required) throw new ToolError(`${label} 가 필요합니다.`, { code: "invalid-args" });
    return "";
  }
  if (typeof value !== "string") throw new ToolError(`${label} 는 문자열이어야 합니다.`, { code: "invalid-args" });
  const text = value.trim();
  if (required && !text) throw new ToolError(`${label} 가 비어 있습니다.`, { code: "invalid-args" });
  return text;
}

function buildCondition(project: Project, raw: Record<string, unknown>, where: string): Condition | undefined {
  const switchId = typeof raw.conditionSwitchId === "string" ? raw.conditionSwitchId.trim() : "";
  const variableId = typeof raw.conditionVariableId === "string" ? raw.conditionVariableId.trim() : "";
  if (switchId && variableId) {
    throw new ToolError(`${where}: 조건은 스위치 또는 변수 중 하나만 걸 수 있습니다.`, { code: "invalid-args" });
  }
  if (switchId) {
    if (!project.switches.some((row) => row.id === switchId)) {
      throw new ToolError(`${where}: 스위치 '${switchId}' 가 없습니다(list_switches 로 확인).`, { code: "invalid-args" });
    }
    return { kind: "switch", switchId, value: raw.conditionSwitchValue !== false };
  }
  if (variableId) {
    if (!project.variables.some((row) => row.id === variableId)) {
      throw new ToolError(`${where}: 변수 '${variableId}' 가 없습니다(list_variables 로 확인).`, { code: "invalid-args" });
    }
    const op = (VARIABLE_OPS as readonly string[]).includes(String(raw.conditionVariableOp))
      ? (raw.conditionVariableOp as VariableOp)
      : ">=";
    const value = typeof raw.conditionVariableValue === "number" && Number.isFinite(raw.conditionVariableValue)
      ? Math.floor(raw.conditionVariableValue)
      : 1;
    return { kind: "variable", variableId, op, value };
  }
  return undefined;
}

function buildActivity(project: Project, raw: unknown, index: number): ScheduleActivityRecord {
  const where = `activities[${index}]`;
  if (!raw || typeof raw !== "object") throw new ToolError(`${where} 가 객체가 아닙니다.`, { code: "invalid-args" });
  const row = raw as Record<string, unknown>;
  const id = readText(row.id, `${where}.id`, true);
  const commonEventId = readText(row.commonEventId, `${where}.commonEventId`, true);
  if (!project.commonEvents.some((event) => event.id === commonEventId)) {
    throw new ToolError(`${where}: 공통 이벤트 '${commonEventId}' 가 없습니다(list_common_events 로 확인).`, { code: "invalid-args" });
  }
  const activity: ScheduleActivityRecord = {
    id,
    label: readText(row.label, `${where}.label`, true),
    description: readText(row.description, `${where}.description`, false),
    commonEventId,
  };
  const hint = readText(row.hint, `${where}.hint`, false);
  if (hint) activity.hint = hint;
  const iconItemId = readText(row.iconItemId, `${where}.iconItemId`, false);
  if (iconItemId) {
    if (!project.database.items.some((item) => item.id === iconItemId)) {
      throw new ToolError(`${where}: 아이콘 아이템 '${iconItemId}' 가 없습니다(get_database_records items 로 확인).`, { code: "invalid-args" });
    }
    activity.icon = { kind: "item", itemId: iconItemId };
  }
  if (row.maxUses !== undefined && row.maxUses !== null) {
    if (typeof row.maxUses !== "number" || !Number.isFinite(row.maxUses) || row.maxUses < 1) {
      throw new ToolError(`${where}.maxUses 는 1 이상의 정수여야 합니다(무제한이면 생략).`, { code: "invalid-args" });
    }
    activity.maxUses = Math.min(SCHEDULE_MAX_USES_LIMIT, Math.floor(row.maxUses));
  }
  const condition = buildCondition(project, row, where);
  if (condition) activity.condition = condition;
  return activity;
}

const upsertSchedule: ToolDefinition = {
  name: "upsert_schedule",
  description: [
    "주간 일정표 한 개를 만들거나(없는 id) 통째로 교체한다(있는 id). 슬롯(예: 월~금 칸)과 활동 카드를 정의하면,",
    "이벤트 명령 「일정 계획」(planSchedule {scheduleId, slotCount?})이 화면을 띄워 플레이어가 슬롯마다 활동을 고르게 하고,",
    "「일정 실행」(runSchedule {scheduleId, slotVariableId?})이 고른 활동의 공통 이벤트를 슬롯 순서대로 부른다(슬롯 번호는 slotVariableId 변수에 1부터).",
    "활동의 commonEventId 는 반드시 존재하는 공통 이벤트여야 한다(없으면 먼저 만든다). 조건(스위치 또는 변수)이 거짓이면 카드가 숨고, maxUses 에 닿으면 흐려져 못 고른다.",
    `한도: 슬롯 ${SCHEDULE_SLOT_LIMIT}·활동 ${SCHEDULE_ACTIVITY_LIMIT}·일정표 ${SCHEDULE_RECORD_LIMIT}. 확인은 list_schedules.`,
  ].join(" "),
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "일정표 id(영문 소문자·숫자·_). 이 id 를 planSchedule/runSchedule 의 scheduleId 에 넣는다" },
      title: { type: "string", description: "화면 상단에 보일 제목(예: 이번 주 일정)" },
      slots: {
        type: "array",
        description: "슬롯 칩 목록(채우는 순서). 예: 월·화·수·목·금",
        items: {
          type: "object",
          properties: { label: { type: "string", description: "칩에 보일 짧은 글자" } },
          required: ["label"],
          additionalProperties: false,
        },
      },
      activities: {
        type: "array",
        description: "고를 수 있는 활동 카드 목록",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "활동 id(일정표 안에서 유일)" },
            label: { type: "string", description: "카드 제목" },
            description: { type: "string", description: "카드 설명" },
            hint: { type: "string", description: "카드 아래 한 줄 힌트(예: 체력 +2, 피로 +1). 없으면 생략" },
            commonEventId: { type: "string", description: "이 활동을 고른 슬롯에서 실행할 공통 이벤트 id" },
            iconItemId: { type: "string", description: "카드 아이콘으로 쓸 아이템 id. 없으면 생략" },
            maxUses: { type: "number", description: "플레이 전체에서 이 활동을 쓸 수 있는 최대 횟수(1 이상). 무제한이면 생략" },
            conditionSwitchId: { type: "string", description: "이 스위치가 conditionSwitchValue 일 때만 카드가 보인다. 없으면 생략" },
            conditionSwitchValue: { type: "boolean", description: "스위치 조건의 기대값(기본 true)" },
            conditionVariableId: { type: "string", description: "이 변수 비교가 참일 때만 카드가 보인다. 스위치 조건과 함께 못 쓴다" },
            conditionVariableOp: { type: "string", enum: [...VARIABLE_OPS], description: "변수 비교 연산자(기본 >=)" },
            conditionVariableValue: { type: "number", description: "변수 비교 값(기본 1)" },
          },
          required: ["id", "label", "description", "commonEventId"],
          additionalProperties: false,
        },
      },
    },
    required: ["id", "title", "slots", "activities"],
    additionalProperties: false,
  },
  run(project, args) {
    const id = readText(args.id, "id", true);
    const title = readText(args.title, "title", true);
    if (!Array.isArray(args.slots) || args.slots.length === 0) {
      throw new ToolError("slots 는 한 개 이상의 {label} 배열이어야 합니다.", { code: "invalid-args" });
    }
    if (args.slots.length > SCHEDULE_SLOT_LIMIT) {
      throw new ToolError(`슬롯은 ${SCHEDULE_SLOT_LIMIT}개까지입니다(받은 ${args.slots.length}개).`, { code: "invalid-args" });
    }
    if (!Array.isArray(args.activities)) throw new ToolError("activities 는 배열이어야 합니다.", { code: "invalid-args" });
    if (args.activities.length > SCHEDULE_ACTIVITY_LIMIT) {
      throw new ToolError(`활동은 ${SCHEDULE_ACTIVITY_LIMIT}개까지입니다(받은 ${args.activities.length}개).`, { code: "invalid-args" });
    }
    const slots = (args.slots as unknown[]).map((slot, index) => {
      const label = slot && typeof slot === "object" ? (slot as Record<string, unknown>).label : slot;
      return { label: readText(label, `slots[${index}].label`, true) };
    });
    const activities = (args.activities as unknown[]).map((row, index) => buildActivity(project, row, index));
    const seen = new Set<string>();
    for (const activity of activities) {
      if (seen.has(activity.id)) throw new ToolError(`활동 id '${activity.id}' 가 겹칩니다.`, { code: "invalid-args" });
      seen.add(activity.id);
    }
    const record = normalizeScheduleRecord({ id, title, slots, activities });
    const list = (project.database.schedules ??= []);
    const at = list.findIndex((row) => row.id === id);
    if (at < 0 && list.length >= SCHEDULE_RECORD_LIMIT) {
      throw new ToolError(`일정표는 ${SCHEDULE_RECORD_LIMIT}개까지입니다.`, { code: "invalid-args" });
    }
    if (at >= 0) list[at] = record;
    else list.push(record);
    const warnings: string[] = [];
    if (activities.length < slots.length) {
      warnings.push(`활동(${activities.length})이 슬롯(${slots.length})보다 적습니다 — maxUses 가 없으면 같은 활동을 반복해 고를 수 있습니다.`);
    }
    return {
      summary: `일정표 '${record.title}'(${id}) ${at >= 0 ? "수정" : "추가"} — 슬롯 ${slots.length} · 활동 ${activities.length}`,
      data: summaryRow(record),
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const SCHEDULE_TOOLS: readonly ToolDefinition[] = [listSchedules, upsertSchedule];
