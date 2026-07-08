// editor/tools/worldTools.ts
// 세계관 AI 툴: query_world / upsert_world_entities / link_world_ref.
// 쓰기 툴은 기존 draft + proposal 파이프라인을 그대로 탄다.

import {
  emptyProjectWorld,
  isWorldEntityType,
  isWorldRefKind,
  normalizeProjectWorld,
  normalizeWorld,
  normalizeWorldId,
  type ProjectWorld,
  type WorldEntity,
  type WorldRef,
} from "@/project/world";
import { WORLD_ENTITY_TYPES, WORLD_REF_KINDS } from "@/project/world/types";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { WORLD_GRAPH_TOOLS } from "./worldGraphTools";

type JsonRecord = Record<string, unknown>;

const queryWorld: ToolDefinition = {
  name: "query_world",
  description: "세계관 개체와 관계를 조회한다. type/tags/text로 필터링해 상세(body/refs/relations)를 읽고, 세계관을 수정하기 전 현재 내용을 확인하라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", enum: WORLD_ENTITY_TYPES as unknown as string[] },
      tags: { type: "array", description: "모두 포함해야 하는 태그 목록", items: { type: "string" } },
      text: { type: "string", description: "id/name/summary/body/tags/refs 텍스트 검색" },
      limit: { type: "integer", description: "반환 개수 제한(기본 50)" },
    },
  },
  run(project, args): ToolExecResult {
    const world = normalizeProjectWorld(project);
    const type = typeof args.type === "string" ? args.type : undefined;
    if (type !== undefined && !isWorldEntityType(type)) throw new ToolError(`알 수 없는 세계관 type: ${type}`, { code: "world-type" });
    const tags = Array.isArray(args.tags) ? (args.tags as string[]).filter((tag) => tag.length > 0) : [];
    const text = typeof args.text === "string" ? args.text.trim().toLowerCase() : "";
    const limit = typeof args.limit === "number" ? Math.max(1, Math.min(200, Math.floor(args.limit))) : 50;
    const entities = world.entities
      .filter((entity) => type === undefined || entity.type === type)
      .filter((entity) => tags.every((tag) => (entity.tags ?? []).includes(tag)))
      .filter((entity) => text.length === 0 || searchableWorldText(entity).includes(text))
      .slice(0, limit);
    const entityIds = new Set(entities.map((entity) => entity.id));
    const relations = world.relations.filter((relation) => entityIds.has(relation.a) || entityIds.has(relation.b));
    return {
      summary: `세계관 ${entities.length}개 조회`,
      data: { entities, relations, total: world.entities.length },
    };
  },
};

const upsertWorldEntities: ToolDefinition = {
  name: "upsert_world_entities",
  description: "세계관 개체를 배치 추가/수정한다. 새 NPC/맵/명명 아이템을 만들 때 같은 제안에 반드시 세계관 갱신을 동봉하라. 잠긴 세계관 개체는 AI가 수정할 수 없다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      entities: {
        type: "array",
        description: "WorldEntity 부분 배열. 신규는 id 생략 가능(type/name/summary 필요, origin 기본 ai). 기존 id는 부분 수정 가능.",
        items: { type: "object" },
      },
    },
    required: ["entities"],
  },
  run(draft, args): ToolExecResult {
    const input = requireRecordArray(args.entities, "entities");
    if (input.length === 0) throw new ToolError("entities는 1개 이상이어야 합니다.", { code: "world-empty-upsert" });

    const world = currentWorld(draft);
    const existingById = new Map(world.entities.map((entity) => [entity.id, entity]));
    const nextById = new Map(world.entities.map((entity) => [entity.id, entity as unknown as JsonRecord]));
    const touchedIds: string[] = [];

    for (const record of input) {
      const explicitId = typeof record.id === "string" && record.id.trim().length > 0
        ? normalizeWorldId("entities.id", record.id)
        : undefined;
      const id = explicitId ?? genId("w");
      const existing = existingById.get(id);
      if (existing?.locked === true) {
        throw new ToolError(`잠긴 세계관 개체는 AI가 수정할 수 없습니다: ${existing.id} (${existing.name})`, {
          code: "world-entity-locked",
        });
      }
      const merged = existing
        ? { ...existing, ...withoutUndefined(record), id }
        : { ...withoutUndefined(record), id, origin: record.origin ?? "ai" };
      assertNewEntityRequiredFields(merged, existing !== undefined);
      nextById.set(id, merged);
      touchedIds.push(id);
    }

    const normalized = normalizeWorld({ entities: [...nextById.values()], relations: world.relations });
    draft.world = normalized;

    const previousById = new Map(world.entities.map((entity) => [entity.id, JSON.stringify(entity)]));
    const normalizedById = new Map(normalized.entities.map((entity) => [entity.id, entity]));
    const added: string[] = [];
    const modified: string[] = [];
    for (const id of touchedIds) {
      const entity = normalizedById.get(id);
      if (!entity) continue;
      const before = previousById.get(id);
      if (before === undefined) added.push(entity.name);
      else if (before !== JSON.stringify(entity)) modified.push(entity.name);
    }

    return {
      summary: `세계관 추가 ${added.length}/수정 ${modified.length}: ${formatNames([...added, ...modified])}`,
      data: { added, modified, ids: touchedIds },
    };
  },
};

const linkWorldRef: ToolDefinition = {
  name: "link_world_ref",
  description: "기존 세계관 개체에 게임 개체 ref(kind+id)를 연결하거나 해제한다. 새 NPC/맵/명명 아이템 생성 시 upsert_world_entities와 함께 실제 게임 id를 연결하라.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      entityId: { type: "string", description: "세계관 개체 id(w_ prefix 생략 가능)" },
      kind: { type: "string", enum: WORLD_REF_KINDS as unknown as string[] },
      id: { type: "string", description: "연결할 게임 개체 id" },
      action: { type: "string", enum: ["link", "unlink"] },
    },
    required: ["entityId", "kind", "id", "action"],
  },
  run(draft, args): ToolExecResult {
    const world = currentWorld(draft);
    const entityId = normalizeWorldId("entityId", args.entityId);
    const entity = world.entities.find((entry) => entry.id === entityId);
    if (!entity) throw new ToolError(`세계관 개체를 찾을 수 없습니다: ${entityId}`, { code: "world-entity-not-found" });

    const kind = args.kind as string;
    if (!isWorldRefKind(kind)) throw new ToolError(`알 수 없는 ref kind: ${kind}`, { code: "world-ref-kind" });
    const ref: WorldRef = { kind, id: args.id as string };
    if (!gameRefExists(draft, ref)) {
      throw new ToolError(`존재하지 않는 게임 개체 id입니다: ${ref.kind}:${ref.id}`, { code: "world-ref-not-found" });
    }

    const action = args.action as "link" | "unlink";
    const refs = entity.refs ?? [];
    const hasRef = refs.some((entry) => sameRef(entry, ref));
    const nextRefs = action === "link"
      ? hasRef ? refs : [...refs, ref]
      : refs.filter((entry) => !sameRef(entry, ref));
    const entities = world.entities.map((entry) =>
      entry.id === entity.id ? { ...entry, refs: nextRefs } : entry
    );
    draft.world = normalizeWorld({ entities, relations: world.relations });
    const verb = action === "link" ? hasRef ? "이미 연결됨" : "연결" : hasRef ? "해제" : "연결 없음";
    return {
      summary: `세계관 '${entity.name}' ref ${verb}: ${ref.kind}:${ref.id}`,
      data: { entityId, ref, action, changed: action === "link" ? !hasRef : hasRef },
    };
  },
};

function currentWorld(project: Project): ProjectWorld {
  if (project.world === undefined) return emptyProjectWorld();
  return normalizeWorld(project.world);
}

function searchableWorldText(entity: WorldEntity): string {
  return [
    entity.id,
    entity.type,
    entity.name,
    entity.summary,
    entity.body ?? "",
    ...(entity.tags ?? []),
    ...(entity.refs ?? []).map((ref) => `${ref.kind}:${ref.id}`),
  ].join("\n").toLowerCase();
}

function requireRecordArray(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) throw new ToolError(`${label}는 배열이어야 합니다.`, { code: "world-invalid-args" });
  return value.map((entry, index) => {
    if (isRecord(entry)) return entry;
    throw new ToolError(`${label}[${index}]는 객체여야 합니다.`, { code: "world-invalid-args" });
  });
}

function assertNewEntityRequiredFields(record: JsonRecord, existed: boolean): void {
  if (existed) return;
  for (const key of ["type", "name", "summary"]) {
    if (typeof record[key] !== "string" || (record[key] as string).trim().length === 0) {
      throw new ToolError(`신규 세계관 개체에는 ${key}(문자열)가 필요합니다.`, { code: "world-entity-required" });
    }
  }
}

function withoutUndefined(record: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function formatNames(names: readonly string[]): string {
  if (names.length === 0) return "(변경 없음)";
  const listed = names.slice(0, 6).join(", ");
  return names.length > 6 ? `${listed} 외 ${names.length - 6}개` : listed;
}

function gameRefExists(project: Project, ref: WorldRef): boolean {
  switch (ref.kind) {
    case "map":
      return project.maps[ref.id] !== undefined;
    case "event":
      return Object.values(project.maps).some((map) => map.events.some((event) => event.id === ref.id));
    case "item":
      return project.database.items.some((item) => item.id === ref.id);
    case "skill":
      return project.database.skills.some((skill) => skill.id === ref.id);
    case "actor":
      return project.database.actors.some((actor) => actor.id === ref.id);
  }
}

function sameRef(left: WorldRef, right: WorldRef): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const WORLD_TOOLS: readonly ToolDefinition[] = [
  queryWorld,
  upsertWorldEntities,
  linkWorldRef,
  ...WORLD_GRAPH_TOOLS,
];
