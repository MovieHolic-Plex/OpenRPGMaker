// editor/tools/dbTools.ts
// DB 쓰기 툴: upsert_item / upsert_enemy / upsert_troop / upsert_actor / upsert_skill
//            / upsert_equipment / upsert_class / upsert_state / upsert_common_event
//            / set_session_start / set_title_screen.
// 모든 레코드는 normalize* 계열을 거쳐 스키마 기본값을 채운 뒤 id로 upsert한다.

import { normalizeActorRecord } from "@/project/actorModel";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import type {
  ActorRecord,
  ClassRecord,
  Command,
  CommonEvent,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  Project,
  SkillRecord,
  StateRecord,
  TroopRecord,
} from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

// id 기준으로 배열에 upsert.
function upsertById<T extends { id: string }>(list: T[], record: T): "added" | "modified" {
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index >= 0) {
    list[index] = record;
    return "modified";
  }
  list.push(record);
  return "added";
}

function requireId(record: unknown, label: string): { id: string; name: string } {
  if (typeof record !== "object" || record === null) throw new ToolError(`${label}는 객체여야 합니다.`);
  const value = record as { id?: unknown; name?: unknown };
  if (typeof value.id !== "string" || value.id.length === 0) throw new ToolError(`${label}.id(문자열)가 필요합니다.`);
  if (typeof value.name !== "string" || value.name.length === 0) throw new ToolError(`${label}.name(문자열)가 필요합니다.`);
  return value as { id: string; name: string };
}

function knownIds(records: readonly { readonly id: string }[], limit = 8): string {
  return records.slice(0, limit).map((record) => record.id).join(", ") || "(없음)";
}

const upsertItem: ToolDefinition = {
  name: "upsert_item",
  description: "아이템 레코드를 등록/수정한다(normalizeItemRecord 경유).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { item: { type: "object", description: "ItemRecord 부분(최소 {id,name})" } },
    required: ["item"],
  },
  run(draft, args): ToolExecResult {
    requireId(args.item, "item");
    const record = normalizeItemRecord(args.item as Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">);
    const outcome = upsertById(draft.database.items, record);
    return { summary: `아이템 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const upsertEnemy: ToolDefinition = {
  name: "upsert_enemy",
  description: "적 레코드를 등록/수정한다(normalizeEnemyRecord 경유).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { enemy: { type: "object", description: "EnemyRecord 부분(최소 {id,name})" } },
    required: ["enemy"],
  },
  run(draft, args): ToolExecResult {
    requireId(args.enemy, "enemy");
    const record = normalizeEnemyRecord(args.enemy as Partial<EnemyRecord> & Pick<EnemyRecord, "id" | "name">);
    const outcome = upsertById(draft.database.enemies, record);
    return { summary: `적 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const upsertTroop: ToolDefinition = {
  name: "upsert_troop",
  description: "적 그룹(트룹) 레코드를 등록/수정한다(normalizeTroopRecord 경유).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { troop: { type: "object", description: "TroopRecord 부분(최소 {id,name,enemyIds})" } },
    required: ["troop"],
  },
  run(draft, args): ToolExecResult {
    requireId(args.troop, "troop");
    const record = normalizeTroopRecord(args.troop as Partial<TroopRecord> & Pick<TroopRecord, "id" | "name">);
    const memberCount = record.members?.length ?? record.enemyIds.length;
    if (memberCount === 0) throw new ToolError("트룹에는 최소 1마리의 적(enemyIds/members)이 필요합니다.", { code: "troop-empty" });
    const enemyIds = new Set(draft.database.enemies.map((enemy) => enemy.id));
    const missing = [...new Set(record.enemyIds.filter((enemyId) => !enemyIds.has(enemyId)))];
    if (missing.length > 0) {
      throw new ToolError(`존재하지 않는 enemyId: ${missing.join(", ")} — 허용 예시: ${knownIds(draft.database.enemies)}`, { code: "enemy-not-found" });
    }
    const outcome = upsertById(draft.database.troops, record);
    return { summary: `트룹 '${record.name}'(${memberCount}마리) ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const upsertActor: ToolDefinition = {
  name: "upsert_actor",
  description: "아군 액터 레코드를 등록/수정한다(normalizeActorRecord 경유).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { actor: { type: "object", description: "ActorRecord 부분(최소 {id,name,classId})" } },
    required: ["actor"],
  },
  run(draft, args): ToolExecResult {
    const base = requireId(args.actor, "actor");
    const input = args.actor as { classId?: unknown };
    if (typeof input.classId !== "string" || input.classId.length === 0) {
      throw new ToolError("actor.classId(문자열)가 필요합니다.", { code: "actor-class" });
    }
    const record = normalizeActorRecord(args.actor as Parameters<typeof normalizeActorRecord>[0]);
    const outcome = upsertById(draft.database.actors, record satisfies ActorRecord);
    return { summary: `액터 '${base.name}' ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const upsertSkill: ToolDefinition = {
  name: "upsert_skill",
  description: "스킬 레코드를 등록/수정한다(normalizeSkillRecord 경유).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { skill: { type: "object", description: "SkillRecord 부분(최소 {id,name})" } },
    required: ["skill"],
  },
  run(draft, args): ToolExecResult {
    requireId(args.skill, "skill");
    const record = normalizeSkillRecord(args.skill as Partial<SkillRecord> & Pick<SkillRecord, "id" | "name">);
    const outcome = upsertById(draft.database.skills, record);
    return { summary: `스킬 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const upsertEquipment: ToolDefinition = {
  name: "upsert_equipment",
  description: "장비(무기/방어구) 레코드를 등록/수정한다(normalizeEquipmentRecord 경유).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { equipment: { type: "object", description: "EquipmentRecord 부분(최소 {id,name}, slot: weapon/shield/armor/helmet/accessory)" } },
    required: ["equipment"],
  },
  run(draft, args): ToolExecResult {
    requireId(args.equipment, "equipment");
    const record = normalizeEquipmentRecord(args.equipment as Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">);
    const outcome = upsertById(draft.database.equipment, record);
    return { summary: `장비 '${record.name}'(${record.slot}) ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const upsertClass: ToolDefinition = {
  name: "upsert_class",
  description: "직업(클래스) 레코드를 등록/수정한다(normalizeClassRecord 경유).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { class: { type: "object", description: "ClassRecord 부분(최소 {id,name})" } },
    required: ["class"],
  },
  run(draft, args): ToolExecResult {
    requireId(args.class, "class");
    const record = normalizeClassRecord(args.class as Partial<ClassRecord> & Pick<ClassRecord, "id" | "name">);
    const outcome = upsertById(draft.database.classes, record);
    return { summary: `클래스 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const upsertState: ToolDefinition = {
  name: "upsert_state",
  description: "상태이상(State) 레코드를 등록/수정한다. 지정하지 않은 필드는 온톨로지 기본값을 따른다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { state: { type: "object", description: "StateRecord 부분(최소 {id,name})" } },
    required: ["state"],
  },
  run(draft, args): ToolExecResult {
    requireId(args.state, "state");
    // StateRecord는 id/name 외 전부 optional — 전달된 필드만 얹는다.
    const record = { ...(args.state as StateRecord) };
    const outcome = upsertById(draft.database.states, record);
    return { summary: `상태 '${record.name}' ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const COMMON_EVENT_TRIGGERS = new Set<CommonEvent["trigger"]>(["none", "auto", "parallel"]);

const upsertCommonEvent: ToolDefinition = {
  name: "upsert_common_event",
  description: "커먼 이벤트를 등록/수정한다. trigger: none(호출 전용)/auto/parallel, 조건 스위치 지정 가능.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      trigger: { type: "string", enum: ["none", "auto", "parallel"] },
      conditionSwitchId: { type: "string" },
      commands: { type: "array", description: "Command[]", items: { type: "object" } },
    },
    required: ["id", "name", "commands"],
  },
  run(draft, args): ToolExecResult {
    requireId(args, "common_event");
    const trigger = COMMON_EVENT_TRIGGERS.has(args.trigger as CommonEvent["trigger"])
      ? (args.trigger as CommonEvent["trigger"])
      : "none";
    validateCommandArray(`common_event.${args.id}.commands`, args.commands);
    const record: CommonEvent = {
      id: args.id as string,
      name: args.name as string,
      trigger,
      ...(typeof args.conditionSwitchId === "string" && args.conditionSwitchId ? { conditionSwitchId: args.conditionSwitchId } : {}),
      commands: [...(args.commands as Command[])],
    };
    const outcome = upsertById(draft.commonEvents, record);
    return { summary: `커먼 이벤트 '${record.name}'(${trigger}) ${outcome === "added" ? "추가" : "수정"}`, data: { id: record.id } };
  },
};

const setSessionStart: ToolDefinition = {
  name: "set_session_start",
  description: "게임 시작 상태(골드/인벤토리/파티)를 설정한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      gold: { type: "integer" },
      inventory: { type: "object", description: "{ itemId: 수량 }" },
      partyActorIds: { type: "array", description: "시작 파티 액터 id", items: { type: "string" } },
    },
  },
  run(draft, args): ToolExecResult {
    if (typeof args.gold === "number") draft.session.gold = Math.max(0, Math.trunc(args.gold));
    if (args.inventory && typeof args.inventory === "object") {
      draft.session.inventory = { ...(args.inventory as Record<string, number>) };
    }
    if (Array.isArray(args.partyActorIds)) {
      draft.session.partyActorIds = [...(args.partyActorIds as string[])];
    }
    return { summary: `시작 상태 설정(gold=${draft.session.gold ?? 0}, party=${draft.session.partyActorIds.length}명)` };
  },
};

const setTitleScreen: ToolDefinition = {
  name: "set_title_screen",
  description: "타이틀 화면 제목/메뉴 라벨을 설정한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      menuLabels: { type: "object", description: "{ newGame, continueGame, quit }" },
    },
    required: ["title"],
  },
  run(draft, args): ToolExecResult {
    const title = args.title as string;
    draft.meta = { ...draft.meta, title };
    const current = draft.system.titleScreen;
    if (current) {
      current.title = title;
      const labels = args.menuLabels as Partial<typeof current.menuLabels> | undefined;
      if (labels) current.menuLabels = { ...current.menuLabels, ...labels };
    }
    return { summary: `타이틀 화면 제목 설정: "${title}"` };
  },
};

// (프로그램 소비용) 세션 시작에 아이템을 병합하는 헬퍼.
export function mergeSessionInventory(project: Project, inventory: Record<string, number>): void {
  project.session.inventory = { ...project.session.inventory, ...inventory };
}

export const DB_TOOLS: readonly ToolDefinition[] = [
  upsertItem,
  upsertEnemy,
  upsertTroop,
  upsertActor,
  upsertSkill,
  upsertEquipment,
  upsertClass,
  upsertState,
  upsertCommonEvent,
  setSessionStart,
  setTitleScreen,
];
