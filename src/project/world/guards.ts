import { ProjectFormatError } from "../io/errors";
import {
  WORLD_ENTITY_TYPES,
  WORLD_REF_KINDS,
  WORLD_RELATION_KINDS,
  type ProjectWorld,
  type WorldEntity,
  type WorldEntityType,
  type WorldOrigin,
  type WorldRef,
  type WorldRefKind,
  type WorldRelation,
  type WorldRelationKind,
} from "./types";

const WORLD_ID_PREFIX = "w_";
const WORLD_ORIGINS: readonly WorldOrigin[] = ["user", "ai", "interview"];
type JsonRecord = Record<string, unknown>;

export function emptyProjectWorld(): ProjectWorld {
  return { entities: [], relations: [] };
}

export function normalizeProjectWorld(project: unknown): ProjectWorld {
  const record = requireRecord("project", project);
  if (record.world === undefined) return emptyProjectWorld();
  return normalizeWorld(record.world);
}

export function normalizeWorld(value: unknown, label = "world"): ProjectWorld {
  const world = requireRecord(label, value);
  const entities = requireArray(`${label}.entities`, world.entities).map((entry, index) =>
    normalizeWorldEntity(`${label}.entities[${index}]`, entry)
  );
  const entityIds = new Set<string>();
  for (const entity of entities) {
    assert(!entityIds.has(entity.id), `${label}.entities.id가 중복되었습니다: ${entity.id}`);
    entityIds.add(entity.id);
  }

  const relations = requireArray(`${label}.relations`, world.relations).map((entry, index) =>
    normalizeWorldRelation(`${label}.relations[${index}]`, entry, entityIds)
  );
  return { entities, relations };
}

export function normalizeWorldId(label: string, value: unknown): string {
  const rawId = requireString(label, value);
  const id = rawId.startsWith(WORLD_ID_PREFIX) ? rawId : `${WORLD_ID_PREFIX}${rawId}`;
  assert(id.length > WORLD_ID_PREFIX.length, `${label}가 비어 있습니다.`);
  return id;
}

function normalizeWorldEntity(label: string, value: unknown): WorldEntity {
  const record = requireRecord(label, value);
  const type = requireEnum(`${label}.type`, record.type, WORLD_ENTITY_TYPES);
  const origin = requireEnum(`${label}.origin`, record.origin, WORLD_ORIGINS);
  const tags = record.tags === undefined ? undefined : normalizeStringArray(`${label}.tags`, record.tags);
  const refs = record.refs === undefined
    ? undefined
    : requireArray(`${label}.refs`, record.refs).map((entry, index) => normalizeWorldRef(`${label}.refs[${index}]`, entry));
  return {
    id: normalizeWorldId(`${label}.id`, record.id),
    type,
    name: requireString(`${label}.name`, record.name),
    summary: requireString(`${label}.summary`, record.summary),
    ...(record.body === undefined ? {} : { body: requireString(`${label}.body`, record.body) }),
    ...(tags === undefined ? {} : { tags }),
    ...(refs === undefined ? {} : { refs }),
    origin,
    ...(record.locked === undefined ? {} : { locked: requireBoolean(`${label}.locked`, record.locked) }),
  };
}

function normalizeWorldRef(label: string, value: unknown): WorldRef {
  const record = requireRecord(label, value);
  return {
    kind: requireEnum(`${label}.kind`, record.kind, WORLD_REF_KINDS),
    id: requireString(`${label}.id`, record.id),
  };
}

function normalizeWorldRelation(label: string, value: unknown, entityIds: ReadonlySet<string>): WorldRelation {
  const record = requireRecord(label, value);
  const a = normalizeWorldId(`${label}.a`, record.a);
  const b = normalizeWorldId(`${label}.b`, record.b);
  assert(entityIds.has(a), `${label}.a가 entities에 없습니다: ${a}`);
  assert(entityIds.has(b), `${label}.b가 entities에 없습니다: ${b}`);
  return {
    a,
    b,
    kind: requireEnum(`${label}.kind`, record.kind, WORLD_RELATION_KINDS),
    ...(record.note === undefined ? {} : { note: requireString(`${label}.note`, record.note) }),
  };
}

function normalizeStringArray(label: string, value: unknown): readonly string[] {
  return requireArray(label, value).map((entry, index) => requireString(`${label}[${index}]`, entry));
}

function requireEnum<T extends string>(label: string, value: unknown, allowed: readonly T[]): T {
  const raw = requireString(label, value);
  assert((allowed as readonly string[]).includes(raw), `${label}이 잘못되었습니다.`);
  return raw as T;
}

function requireRecord(label: string, value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new ProjectFormatError(`${label}가 객체가 아닙니다.`);
}

function requireArray(label: string, value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new ProjectFormatError(`${label}가 배열이 아닙니다.`);
}

function requireString(label: string, value: unknown): string {
  if (typeof value === "string") return value;
  throw new ProjectFormatError(`${label}가 문자열이 아닙니다.`);
}

function requireBoolean(label: string, value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new ProjectFormatError(`${label}가 boolean이 아닙니다.`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ProjectFormatError(message);
}

export function isWorldEntityType(value: string): value is WorldEntityType {
  return (WORLD_ENTITY_TYPES as readonly string[]).includes(value);
}

export function isWorldRefKind(value: string): value is WorldRefKind {
  return (WORLD_REF_KINDS as readonly string[]).includes(value);
}

export function isWorldRelationKind(value: string): value is WorldRelationKind {
  return (WORLD_RELATION_KINDS as readonly string[]).includes(value);
}
