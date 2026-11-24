import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import type { JsonSchema, JsonSchemaType } from "@/editor/tools/types";
import { EventCommandEditError } from "@/project/eventCommands/singleCommandOps";
import type { Project } from "@/project/types";
import { plainSummary } from "../plainSummary";
import type { SmallTaskTarget } from "../target";
import { primitiveScope } from "./core/scope";
import { PrimitiveError, STALE_COMMAND_LIST } from "./errors";
import { commandDeletionGuard, PRIMITIVES, smallTaskHost } from "./index";
import { getPrimitive } from "./registry";
import type { PrimitiveContext } from "./types";

const freezeBaseline = import.meta.env?.DEV || (typeof process !== "undefined"
  && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"));

function matchesType(value: unknown, type: JsonSchemaType): boolean {
  switch (type) {
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    case "null": return value === null;
    default: return typeof value === type;
  }
}

export function matchesPrimitiveSchema(schema: JsonSchema, value: unknown): boolean {
  const types = typeof schema.type === "string" ? [schema.type] : schema.type;
  if (types && !types.some(type => matchesType(value, type))) return false;
  if (schema.enum && !schema.enum.includes(value as string | number)) return false;
  if (schema.oneOf && schema.oneOf.filter(choice => matchesPrimitiveSchema(choice, value)).length !== 1) return false;
  if (typeof value === "string") {
    const length = [...value].length;
    return length >= (schema.minLength ?? 0) && length <= (schema.maxLength ?? Infinity)
      && (schema.pattern === undefined || new RegExp(schema.pattern, "u").test(value));
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
  }
  if (Array.isArray(value)) {
    return value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity)
      && (!schema.items || value.every(item => matchesPrimitiveSchema(schema.items!, item)));
  }
  if (value !== null && typeof value === "object") {
    const fields = schema.properties ?? {};
    if (schema.required?.some(key => !Object.hasOwn(value, key) || Reflect.get(value, key) === undefined)) return false;
    return Object.entries(value).every(([key, entry]) => Object.hasOwn(fields, key)
      ? matchesPrimitiveSchema(fields[key]!, entry) : schema.additionalProperties !== false);
  }
  return true;
}

function deepFreezeValue(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) deepFreezeValue(child, seen);
  Object.freeze(value);
}

/**
 * Tileset and uploaded-asset entries are shared by every copy of a project (projectClone.ts) and are almost all of its size. Once an entry
 * is frozen it stays frozen, so later calls skip it instead of re-walking the bundled tilesets (about 0.4 s per call).
 */
const frozenSharedEntries = new WeakSet<object>();

function sharedEntries(project: Project): object[] {
  const entries: object[] = [];
  for (const dictionary of [project.tilesets, project.assets?.uploaded]) {
    if (dictionary === null || typeof dictionary !== "object") continue;
    for (const key of Object.keys(dictionary)) {
      const descriptor = Object.getOwnPropertyDescriptor(dictionary, key);
      if (descriptor && "value" in descriptor && descriptor.value !== null && typeof descriptor.value === "object") entries.push(descriptor.value);
    }
  }
  return entries;
}

function deepFreezeProject(project: Project): void {
  const seen = new WeakSet<object>();
  const entries = sharedEntries(project);
  for (const entry of entries) if (frozenSharedEntries.has(entry)) seen.add(entry);
  deepFreezeValue(project, seen);
  for (const entry of entries) frozenSharedEntries.add(entry);
}

export function runPrimitive(
  project: Project, target: SmallTaskTarget, id: string, args: Record<string, unknown>, selection?: PrimitiveContext["selection"],
  live?: PrimitiveContext["live"],
) {
  const publicRow = PRIMITIVES.find(row => row.id === id);
  const primitive = getPrimitive(id);
  if (!primitive || !publicRow) throw new PrimitiveError("요청한 동작을 찾을 수 없어요.");
  if (!publicRow.targets.includes(target.kind) || !primitive.targets.includes(target.kind)) {
    throw new PrimitiveError("범위 밖: 선택한 대상에 이 동작을 쓸 수 없어요.");
  }
  if (!args || typeof args !== "object" || Array.isArray(args) || !matchesPrimitiveSchema(primitive.args, args)) {
    throw new PrimitiveError("동작에 필요한 값의 형식을 확인해 주세요.");
  }

  // Primitives copy the paths they edit. Check that contract before computing the diff in dev and tests.
  if (freezeBaseline) deepFreezeProject(project);
  const ctx: PrimitiveContext = {
    project, target, selection, live, commandDeletionGuard,
    m2CommandDeleteGuards: smallTaskHost.m2CommandDeleteGuards,
  };
  try {
    const scope = primitiveScope(ctx, primitive, args);
    const after = primitive.apply(ctx, args);
    const result = checkSmallTaskScope(project, after, scope, live);
    if (!result.ok) throw new PrimitiveError(result.reason);
    return { after, sentence: primitive.describe(ctx, args), summary: plainSummary(project, after) };
  } catch (error) {
    if (error instanceof EventCommandEditError) {
      throw new PrimitiveError(error.code === "stale-event-command" ? STALE_COMMAND_LIST : error.message);
    }
    throw error;
  }
}
