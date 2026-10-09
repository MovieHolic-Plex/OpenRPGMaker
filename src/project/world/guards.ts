import { ProjectFormatError } from "../io/errors";
import {
  WIKI_KINDS, WIKI_BASES, WIKI_SOURCE_KINDS, WIKI_COMBAT_MODES,
  type WikiSource, type WorldWikiMetadata,
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

  const sourceRecords = new Map<string, WikiSource>();
  for (const entity of entities) {
    for (const source of entity.wiki?.sources ?? []) {
      const previous = sourceRecords.get(source.id);
      assert(!previous || JSON.stringify(previous) === JSON.stringify(source), `Conflicting wiki source: ${source.id}`);
      sourceRecords.set(source.id, source);
    }
    for (const id of entity.wiki?.supersedes ?? []) {
      const previous = entities.find((candidate) => candidate.id === id);
      assert(previous !== undefined && id !== entity.id, `Invalid wiki supersedes: ${id}`);
      assert(previous.wiki !== undefined, `Cannot supersede legacy entity: ${id}`);
      assert(entity.wiki?.basis === "explicit" || previous.wiki.basis !== "explicit", `Cannot supersede explicit wiki: ${id}`);
      assert(Math.max(...(entity.wiki?.sources ?? []).map((source) => source.at)) > Math.max(...previous.wiki.sources.map((source) => source.at)), `Stale wiki supersedes: ${id}`);
    }
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
    ...(record.wiki === undefined ? {} : { wiki: normalizeWikiMetadata(record.wiki) }),
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

export function createWikiSource(value: unknown): WikiSource {
  const record = requireRecord("wiki source", value);
  const id = requireString("wiki source.id", record.id);
  const text = requireString("wiki source.text", record.text);
  assert(id.trim().length > 0 && text.trim().length > 0, "Wiki source id/text must not be empty");
  assert(typeof record.at === "number" && Number.isFinite(record.at) && record.at >= 0, "Wiki source.at must be a nonnegative finite number");
  return { id, kind: requireEnum("wiki source.kind", record.kind, WIKI_SOURCE_KINDS), text, at: record.at };
}

export function normalizeWikiMetadata(value: unknown): WorldWikiMetadata {
  const record = requireRecord("wiki", value);
  const kind = requireEnum("wiki.kind", record.kind, WIKI_KINDS);
  const basis = requireEnum("wiki.basis", record.basis, WIKI_BASES);
  const sources = requireArray("wiki.sources", record.sources).map(createWikiSource);
  assert(sources.length > 0 && new Set(sources.map((source) => source.id)).size === sources.length, "Wiki needs unique sources");
  assert(basis !== "explicit" || sources.every((source) => source.kind !== "application"), "Explicit wiki needs user/manual sources");
  assert(basis !== "observed" || sources.every((source) => source.kind === "application"), "Observed wiki needs application sources");
  assert(kind !== "progress" || basis === "observed", "Progress wiki must be observed");
  const topic = record.topic === undefined ? undefined : requireString("wiki.topic", record.topic).trim();
  assert(topic === undefined || topic.length > 0, "Wiki topic must not be empty");
  const combatMode = record.combatMode === undefined ? undefined : requireEnum("wiki.combatMode", record.combatMode, WIKI_COMBAT_MODES);
  assert(combatMode === undefined || kind === "declaration", "Combat mode must be a declaration");
  return {
    kind, basis, sources,
    ...(topic === undefined ? {} : { topic }),
    ...(combatMode === undefined ? {} : { combatMode }),
    ...(record.supersedes === undefined ? {} : { supersedes: requireArray("wiki.supersedes", record.supersedes).map((id) => normalizeWorldId("wiki.supersedes", id)) }),
  };
}
