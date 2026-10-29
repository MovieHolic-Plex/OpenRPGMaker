// editor/tools/argRepair.ts
// 도구 인자 교정·오류 안내의 공통 헬퍼(순수 함수, 프로젝트 불필요).
//
// 2026-10-15 FF6 감사 #34: 역할극 3판에서 upsert_actor description 거부 6회 · classId 누락 6회 · enemy.role/maxHp 거부 ·
// get_database_records {table|kind} 거부 · set_party scope 누락이 같은 인자로 반복됐다. 오류가 「무엇이 틀렸다」만 말하고
// 「이렇게 다시 보내라」를 안 말해서다. 이 모듈이 두 가지를 한곳에서 한다.
//   1. 최상위 인자 별칭 — 모호하지 않은 오타·별칭(snake_case/kebab-case/대소문자, 도구별 사전)은 올바른 이름으로 옮기고
//      「X 는 Y 입니다」 경고를 남긴다(조용한 교정 금지). 옮길 수 없으면 아래 2번으로 거절한다.
//   2. 거절 문구 보강 — 모르는 키에는 가장 가까운 선언 키와 허용 목록, 필수 키 누락에는 스키마에서 만든 예시 호출 JSON.
//
// DB 레코드 안쪽(actor.maxHp 같은 칸)은 dbRecordAliases.ts 가 다룬다. 이 파일은 도구 최상위 인자만 본다.

import type { JsonSchema } from "./types";

/** 도구별 최상위 인자 별칭. 값은 그 도구 스키마가 선언한 이름이어야 한다(아니면 무시). */
export const TOOL_ARG_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  get_database_records: { table: "collection", kind: "collection", type: "collection", name: "collection", db: "collection", category: "collection", records: "collection", id: "ids", recordIds: "ids", record_ids: "ids" },
  set_party: { party: "actorIds", members: "actorIds", actors: "actorIds", memberIds: "actorIds", partyIds: "actorIds", actor_ids: "actorIds", actorIDs: "actorIds" },
  create_map: { map_id: "id", mapId: "id", title: "name", mapName: "name", w: "width", h: "height" },
  find_flag_usage: { id: "flagId", switch: "switchId", variable: "variableId" },
  set_start_position: { map: "mapId", mapID: "mapId" },
  place_vehicle: { vehicle: "vehicleId", kind: "vehicleId", type: "vehicleId" },
  upsert_troop_battle_page: { page: "pages" },
  // 2026-10-30 실조수 e2e: 맵 배경음을 걸며 bgmResourceId 로 한 번 실패한 뒤 resourceId 로 고쳐 불렀다(맵의 bgm 칸 이름을 따라 씀).
  set_game_audio: { bgmResourceId: "resourceId", musicResourceId: "resourceId", seResourceId: "resourceId", soundResourceId: "resourceId", musicId: "resourceId", bgmId: "resourceId", assetId: "resourceId", resource: "resourceId" },
};

function camel(key: string): string {
  return key.replace(/[_-]+([a-zA-Z0-9])/gu, (_all, ch: string) => ch.toUpperCase());
}

/** 편집 거리 ≤ limit 이면 true — 오타 후보 판정용(짧은 키만 본다). */
function nearlyEqual(left: string, right: string, limit = 2): boolean {
  if (Math.abs(left.length - right.length) > limit) return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const held = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = held;
    }
    if (Math.min(...row) > limit) return false;
  }
  return row[b.length]! <= limit;
}

/** 모르는 키에 가장 가까운 선언 키 하나(없으면 undefined). */
export function closestDeclaredKey(key: string, declared: readonly string[]): string | undefined {
  const lower = key.toLowerCase();
  const direct = declared.find((name) => name.toLowerCase() === lower || name.toLowerCase() === camel(lower));
  if (direct) return direct;
  const near = declared.filter((name) => nearlyEqual(key, name, key.length >= 6 ? 2 : 1));
  if (near.length === 1) return near[0];
  const contained = declared.filter((name) => name.length >= 4 && key.length >= 4 && (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())));
  return contained.length === 1 ? contained[0] : undefined;
}

export interface ArgAliasResult {
  readonly args: Record<string, unknown>;
  /** 「'table' 은 'collection' 입니다 — 옮겨서 실행했다」 — 호출 결과 warnings 에 싣는다. */
  readonly notes: readonly string[];
}

/**
 * 스키마에 없는 최상위 인자를 별칭 규칙으로 올바른 이름에 옮긴다. 대상 칸이 이미 있거나 스키마가 additionalProperties:false 가
 * 아니면 건드리지 않는다. 안 옮긴 키는 그대로 두어 validateArgs 가 거절한다(→ describeArgError 가 가장 가까운 이름을 안내).
 */
export function applyArgAliases(toolName: string, schema: JsonSchema, args: Record<string, unknown>): ArgAliasResult {
  if (schema.type !== "object" || schema.additionalProperties !== false) return { args, notes: [] };
  const declared = Object.keys(schema.properties ?? {});
  const unknown = Object.keys(args).filter((key) => !declared.includes(key));
  if (unknown.length === 0) return { args, notes: [] };
  const next: Record<string, unknown> = { ...args };
  const notes: string[] = [];
  const table = TOOL_ARG_ALIASES[toolName] ?? {};
  for (const key of unknown) {
    const target = table[key] && declared.includes(table[key]!) ? table[key]! : declared.find((name) => name.toLowerCase() === camel(key).toLowerCase());
    if (!target || next[target] !== undefined) continue;
    next[target] = next[key];
    delete next[key];
    notes.push(`인자 '${key}' 는 '${target}' 입니다 — 옮겨서 실행했습니다. 다음부터 '${target}' 로 보내세요.`);
  }
  return { args: next, notes };
}

function placeholderFor(schema: JsonSchema | undefined, key: string): unknown {
  if (!schema) return "…";
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "string": return key.toLowerCase().endsWith("id") ? `${key.replace(/Id$/u, "").toLowerCase() || "id"}_example` : "…";
    case "integer": return typeof schema.minimum === "number" ? schema.minimum : 0;
    case "number": return typeof schema.minimum === "number" ? schema.minimum : 0;
    case "boolean": return true;
    case "array": return schema.items ? [placeholderFor(schema.items, key)] : [];
    case "object": return exampleFromSchema(schema);
    default: return "…";
  }
}

/** 필수 칸만으로 만든 최소 예시 호출 인자(깊이 3까지). 필수가 없으면 처음 두 칸. */
export function exampleFromSchema(schema: JsonSchema, depth = 0): Record<string, unknown> {
  const properties = schema.properties ?? {};
  const keys = (schema.required && schema.required.length > 0 ? schema.required : Object.keys(properties).slice(0, 2)).slice(0, 6);
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = depth >= 3 ? "…" : placeholderFor(properties[key], key);
  return out;
}

/**
 * validateArgs 가 낸 한 줄 오류를 「그대로 고쳐 다시 보낼 수 있는」 문구로 보강한다.
 * - 허용되지 않은 인자: 가장 가까운 선언 키 + 허용 목록.
 * - 필수 인자 누락: (도구가 예시를 안 줬을 때) 스키마에서 만든 예시 호출 JSON.
 * 다른 문구는 그대로 돌려준다.
 */
export function describeArgError(message: string, schema: JsonSchema, args: Readonly<Record<string, unknown>>, hasExample: boolean): string {
  const declared = Object.keys(schema.properties ?? {});
  const unknown = /^허용되지 않은 인자: (.+)$/u.exec(message);
  if (unknown) {
    const key = unknown[1]!;
    const near = closestDeclaredKey(key, declared);
    const list = declared.length <= 14 ? declared.join(", ") : `${declared.slice(0, 14).join(", ")} 외 ${declared.length - 14}개`;
    return `${message} — ${near ? `'${key}' 는 '${near}' 입니다. ` : ""}이 도구가 받는 인자: ${list || "(없음)"}`;
  }
  const missing = /^필수 인자 누락: (.+)$/u.exec(message);
  if (missing && !hasExample) {
    const example = exampleFromSchema(schema);
    const given = Object.fromEntries(Object.entries(args).filter(([key]) => declared.includes(key)).slice(0, 3));
    return `${message} — 호출 예시: ${JSON.stringify({ ...example, ...given })}`;
  }
  return message;
}
